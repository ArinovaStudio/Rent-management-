import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { CAN_CREATE } from "@/lib/permissions";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { name, email, password, role } = await req.json().catch(() => ({}));
  if (!CAN_CREATE[me.role].includes(role)) {
    return NextResponse.json({ error: "You can't create this type of account." }, { status: 403 });
  }

  const cleanEmail = String(email ?? "").trim().toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(cleanEmail) || String(password ?? "").length < 8) {
    return NextResponse.json({ error: "Enter a name, a valid email and a password of 8+ characters." }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      createdById: me.id,
    },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json(user, { status: 201 });
}