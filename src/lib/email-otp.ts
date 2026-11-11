import { createHash, randomInt, timingSafeEqual } from "crypto";
import { transport } from "./mailer";
import { prisma } from "./db";
import { syncVerificationStatus } from "./owner-status";

const OTP_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // at least 60s between sends
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5; // wrong guesses allowed per code

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export type SendResult = { ok: true } | { ok: false; error: string; retryAfterSec?: number };

export async function sendEmailOtp(user: { id: string; email: string; emailVerifiedAt: Date | null }): Promise<SendResult> {
  if (user.emailVerifiedAt) return { ok: false, error: "Your email is already verified." };

  const now = Date.now();
  const recent = await prisma.emailOtp.findMany({
    where: { userId: user.id, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
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
  // Only the newest code works
  await prisma.emailOtp.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });
  const row = await prisma.emailOtp.create({
    data: { userId: user.id, codeHash: hash(code), expiresAt: new Date(now + OTP_TTL_MS) },
  });

  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      await prisma.emailOtp.delete({ where: { id: row.id } });
      return { ok: false, error: "Email sending isn't configured." };
    }
    console.log(`[dev] SMTP not configured. Email OTP for ${user.email}: ${code}`);
    return { ok: true };
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: user.email,
      subject: "Your verification code",
      text: `Your verification code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.`,
    });
  } catch {
    await prisma.emailOtp.delete({ where: { id: row.id } });
    return { ok: false, error: "Couldn't send the email. Try again shortly." };
  }
  return { ok: true };
}

export async function confirmEmailOtp(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const otp = await prisma.emailOtp.findFirst({
    where: { userId, consumedAt: null },
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

  await prisma.$transaction([
    prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await syncVerificationStatus(userId);
  return { ok: true };
}
