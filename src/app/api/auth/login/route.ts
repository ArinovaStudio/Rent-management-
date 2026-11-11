import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const user = await prisma.user.findUnique({
    where: { email: String(email ?? "").trim().toLowerCase() },
    include: { ownerProfile: { select: { onboardingCompletedAt: true } } },
  });

  const valid = user?.passwordHash && (await bcrypt.compare(String(password ?? ""), user.passwordHash));
  if (!user || !valid) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  // Owners who stopped part-way through registration pick up where they left off.
  const unfinished = !!user.ownerProfile && !user.ownerProfile.onboardingCompletedAt;
  const res = NextResponse.json({ ok: true, next: unfinished ? "/register" : "/dashboard" });
  await startSession(res, user);
  return res;
}
