import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { applyPersonUpdate } from "@/lib/person-update";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id, userId } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!property || !canEditProperty(me, property)) {
    return NextResponse.json({ error: "You can't manage this property." }, { status: 403 });
  }
  if (userId === property.ownerId) {
    return NextResponse.json({ error: "The main owner can't be edited here." }, { status: 403 });
  }

  // Super Admin edits anyone; a Property Admin only the people they created.
  if (me.role !== "SUPER_ADMIN") {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { createdById: true } });
    if (target?.createdById !== me.id) return NextResponse.json({ error: "You can only edit people you created." }, { status: 403 });
  }

  const [mgr, co] = await Promise.all([
    prisma.propertyManager.findFirst({ where: { propertyId: id, managerId: userId }, select: { id: true } }),
    prisma.propertyCoOwner.findFirst({ where: { propertyId: id, userId }, select: { userId: true } }),
  ]);
  if (!mgr && !co) return NextResponse.json({ error: "This person isn't on this property." }, { status: 404 });

  return applyPersonUpdate(req, userId);
}
