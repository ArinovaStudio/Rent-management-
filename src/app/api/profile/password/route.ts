import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { consumePasswordOtp } from "@/lib/email-otp";
import { validatePassword } from "@/lib/owner-validation";
import { startSession } from "@/lib/session";

// Changes the signed-in user's password.
//  - Account created by an admin (temporary password): body { currentPassword, newPassword }
//  - Account the person signed up for themselves:      body { code, newPassword }  (code from /password/code)
// Every other session of this user is signed out, and this browser gets a fresh one.
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";
  const pwError = validatePassword(newPassword, me.email);
  if (pwError) return NextResponse.json({ error: pwError, field: "newPassword" }, { status: 400 });

  if (me.createdById) {
    const current = typeof b.currentPassword === "string" ? b.currentPassword : "";
    const ok = !!me.passwordHash && (await bcrypt.compare(current, me.passwordHash));
    if (!ok) return NextResponse.json({ error: "Your current password is incorrect.", field: "currentPassword" }, { status: 400 });
    if (current === newPassword) return NextResponse.json({ error: "Choose a password different from the current one.", field: "newPassword" }, { status: 400 });
  } else {
    const code = typeof b.code === "string" ? b.code.trim() : "";
    const r = await consumePasswordOtp(me.id, code);
    if (!r.ok) return NextResponse.json({ error: r.error, field: "code" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
    prisma.refreshToken.updateMany({ where: { userId: me.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  const res = NextResponse.json({ ok: true });
  await startSession(res, { id: me.id, role: me.role, name: me.name });
  return res;
}
