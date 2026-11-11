import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/session";
import { syncVerificationStatus } from "@/lib/owner-status";
import { removeSensitiveFile } from "@/lib/uploads";

const fail = (req: NextRequest, code: string) =>
  NextResponse.redirect(new URL(`/login?error=${code}`, req.url));

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("oauth_state")?.value) return fail(req, "oauth");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.APP_URL}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail(req, "oauth");
  const { access_token } = await tokenRes.json();

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) return fail(req, "oauth");
  const info = await infoRes.json();
  if (!info.email || !info.email_verified) return fail(req, "oauth");

  const email = String(info.email).toLowerCase();
  const now = new Date();

  // Match by Google id first, then link to an existing account with the same verified email.
  let user = await prisma.user.findUnique({ where: { googleId: info.sub }, include: { ownerProfile: true } });
  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email }, include: { ownerProfile: true } });
    if (!existing) {
      // Brand new Google user: create the account plus an owner profile that still needs onboarding.
      user = await prisma.user.create({
        data: {
          email,
          name: info.name ?? email,
          googleId: info.sub,
          emailVerifiedAt: now,
          ownerProfile: { create: { legalName: String(info.name ?? email).slice(0, 120) } },
        },
        include: { ownerProfile: true },
      });
    } else if (existing.passwordHash && !existing.emailVerifiedAt && existing.ownerProfile) {
      // This account was registered with a password but its email was never verified, so whoever
      // set that password may not own the address. Google just proved the real owner does, so drop
      // the password and every session. If onboarding was never submitted, also restart it from a
      // clean profile so nothing typed in by a squatter is carried over. A submitted profile is kept.
      const reset = !existing.ownerProfile.onboardingCompletedAt;
      const staleFiles = reset
        ? await prisma.sensitiveDocument.findMany({ where: { ownerProfile: { userId: existing.id } }, select: { path: true } })
        : [];
      user = await prisma.$transaction(async (tx) => {
        await tx.refreshToken.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: now } });
        if (reset) await tx.ownerProfile.delete({ where: { userId: existing.id } });
        return tx.user.update({
          where: { id: existing.id },
          data: {
            googleId: info.sub,
            passwordHash: null,
            emailVerifiedAt: now,
            ...(reset
              ? { name: info.name ?? email, ownerProfile: { create: { legalName: String(info.name ?? email).slice(0, 120) } } }
              : {}),
          },
          include: { ownerProfile: true },
        });
      });
      await Promise.all(staleFiles.map((f) => removeSensitiveFile(f.path)));
    } else {
      // Established account (including ones from before onboarding existed): link and keep going.
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { googleId: info.sub, emailVerifiedAt: existing.emailVerifiedAt ?? now },
        include: { ownerProfile: true },
      });
    }
  } else if (!user.emailVerifiedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: now }, include: { ownerProfile: true } });
  }

  // Google proved the email, which may complete the contact checklist.
  await syncVerificationStatus(user.id);

  const unfinished = !!user.ownerProfile && !user.ownerProfile.onboardingCompletedAt;
  const res = NextResponse.redirect(new URL(unfinished ? "/register" : "/dashboard", req.url));
  res.cookies.set("oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
  await startSession(res, user);
  return res;
}
