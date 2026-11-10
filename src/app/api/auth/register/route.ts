import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/session";

// Public sign-up creates a Property Admin. Super Admin is seeded; managers get added by admins later.
export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));
  const cleanEmail = String(email ?? "").trim().toLowerCase();

  if (!name || !/^\S+@\S+\.\S+$/.test(cleanEmail) || String(password ?? "").length < 8) {
    return NextResponse.json({ error: "Enter a name, a valid email and a password of 8+ characters." }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { name: String(name).trim(), email: cleanEmail, passwordHash: await bcrypt.hash(password, 12) },
  });
  const res = NextResponse.json({ ok: true }, { status: 201 });
  await startSession(res, user);
  return res;
}
