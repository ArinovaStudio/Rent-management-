import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canDelete } from "@/lib/permissions";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (!canDelete(me, target)) {
    return NextResponse.json({ error: "You can't delete this account." }, { status: 403 });
  }

  // Delete anyone this user created first, then the user. Refresh tokens cascade automatically.
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { createdById: target.id } }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);
  return NextResponse.json({ ok: true });
}