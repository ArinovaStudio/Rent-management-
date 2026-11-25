import { createHash, randomInt, timingSafeEqual } from "crypto";
import { transport } from "./mailer";
import { prisma } from "./db";
import { syncVerificationStatus } from "./owner-status";

const OTP_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // at least 60s between sends
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

// VERIFY = prove the email address is theirs. PASSWORD = authorise a password change from the profile page.
// Each purpose has its own codes, limits and cooldown, so one can never be used for the other.
export type OtpPurpose = "VERIFY" | "PASSWORD";

export type SendResult = { ok: true } | { ok: false; error: string; retryAfterSec?: number };

export async function sendEmailOtp(
  user: { id: string; email: string; emailVerifiedAt: Date | null },
  purpose: OtpPurpose = "VERIFY"
): Promise<SendResult> {
  if (purpose === "VERIFY" && user.emailVerifiedAt) return { ok: false, error: "Your email is already verified." };

  const now = Date.now();
  const recent = await prisma.emailOtp.findMany({
    where: { userId: user.id, purpose, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length >= MAX_SENDS_PER_HOUR) {
    return { ok: false, error: "Too many codes requested. Try again in an hour." };
  }
  const wait = recent[0] ? recent[0].createdAt.getTime() + RESEND_COOLDOWN_MS - now : 0;
  if (wait > 0) {
    const retryAfterSec = Math.ceil(wait / 1000);
    return { ok: false, error: `Please wait ${retryAfterSec}s before requesting another code.`, retryAfterSec };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Only the newest code of this purpose works
  await prisma.emailOtp.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  const row = await prisma.emailOtp.create({
    data: { userId: user.id, purpose, codeHash: hash(code), expiresAt: new Date(now + OTP_TTL_MS) },
  });

  const subject = purpose === "PASSWORD" ? "Your password change code" : "Your verification code";
  const text =
    purpose === "PASSWORD"
      ? `Your code to change your password is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email and your password stays the same.`
      : `Your verification code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.`;

  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      await prisma.emailOtp.delete({ where: { id: row.id } });
      return { ok: false, error: "Email sending isn't configured." };
    }
    console.log(`[dev] SMTP not configured. Email OTP (${purpose}) for ${user.email}: ${code}`);
    return { ok: true };
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to: user.email, subject, text });
  } catch {
    await prisma.emailOtp.delete({ where: { id: row.id } });
    return { ok: false, error: "Couldn't send the email. Try again shortly." };
  }
  return { ok: true };
}

// Checks the newest code of this purpose. Returns the row id when the code is right (nothing is consumed yet).
async function checkOtp(userId: string, code: string, purpose: OtpPurpose): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const otp = await prisma.emailOtp.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt < new Date()) return { ok: false, error: "That code has expired. Request a new one." };
  if (otp.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Too many wrong attempts. Request a new code." };

  const a = Buffer.from(hash(code));
  const b = Buffer.from(otp.codeHash);
  if (!/^\d{6}$/.test(code) || !timingSafeEqual(a, b)) {
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code." };
  }
  return { ok: true, id: otp.id };
}

export async function confirmEmailOtp(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await checkOtp(userId, code, "VERIFY");
  if (!r.ok) return r;

  await prisma.$transaction([
    prisma.emailOtp.update({ where: { id: r.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await syncVerificationStatus(userId);
  return { ok: true };
}

// Used by the password change: right code => the code is used up and the caller may go on.
export async function consumePasswordOtp(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await checkOtp(userId, code, "PASSWORD");
  if (!r.ok) return r;
  // Claim it once: a second request with the same code gets count 0
  const claimed = await prisma.emailOtp.updateMany({ where: { id: r.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (claimed.count === 0) return { ok: false, error: "That code was already used. Request a new one." };
  return { ok: true };
}
