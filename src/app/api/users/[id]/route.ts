import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canDelete } from "@/lib/permissions";
import { removeSensitiveFile } from "@/lib/uploads";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (!canDelete(me, target)) {
    return NextResponse.json({ error: "You can't delete this account." }, { status: 403 });
  }

  // KYC files aren't covered by the database cascade, so collect them before the rows disappear.
  const kycFiles = await prisma.sensitiveDocument.findMany({
    where: { ownerProfile: { user: { OR: [{ id: target.id }, { createdById: target.id }] } } },
    select: { path: true },
  });

  // Delete anyone this user created first, then the user. Refresh tokens and owner profiles cascade automatically.
  await prisma.$transaction([
    prisma.user.deleteMany({ where: { createdById: target.id } }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);
  await Promise.all(kycFiles.map((f) => removeSensitiveFile(f.path)));
  return NextResponse.json({ ok: true });
}