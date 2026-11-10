import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/session";

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
  // Match by Google id first, then link to an existing account with the same verified email.
  let user = await prisma.user.findUnique({ where: { googleId: info.sub } });
  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email } });
    user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { googleId: info.sub } })
      : await prisma.user.create({ data: { email, name: info.name ?? email, googleId: info.sub } });
  }

  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set("oauth_state", "", { path: "/api/auth/google", maxAge: 0 });
  await startSession(res, user);
  return res;
}
