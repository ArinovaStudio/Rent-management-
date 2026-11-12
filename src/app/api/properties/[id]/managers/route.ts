import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { isVerifiedManager } from "@/lib/property-access";

async function guard(req: Request, params: Promise<{ id: string }>) {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };

  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || !canEditProperty(me, property)) {
    return { error: NextResponse.json({ error: "You can't manage this property." }, { status: 403 }) };
  }

  const { managerId } = await req.json().catch(() => ({}));
  const manager = await prisma.user.findUnique({ where: { id: String(managerId ?? "") } });
  if (!manager || manager.role !== "PROPERTY_MANAGER") {
    return { error: NextResponse.json({ error: "Choose a valid manager." }, { status: 400 }) };
  }
  // A Property Admin can only use managers they created; Super Admin can use any.
  if (me.role === "PROPERTY_ADMIN" && manager.createdById !== me.id) {
    return { error: NextResponse.json({ error: "That manager isn't one of your accounts." }, { status: 403 }) };
  }
  if (!(await isVerifiedManager(manager.id))) {
    return { error: NextResponse.json({ error: "This manager hasn't been verified yet." }, { status: 409 }) };
  }
  return { me, property, manager };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  await prisma.propertyManager.upsert({
    where: { propertyId_managerId: { propertyId: g.property.id, managerId: g.manager.id } },
    create: { propertyId: g.property.id, managerId: g.manager.id, assignedById: g.me.id },
    update: {},
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  await prisma.propertyManager.deleteMany({
    where: { propertyId: g.property.id, managerId: g.manager.id },
  });
  return NextResponse.json({ ok: true });
}