import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import { emailCoOwnerAssignment } from "@/lib/team-emails";
import { removeSensitiveFile } from "@/lib/uploads";
import { MAX_CO_OWNERS } from "@/lib/team-limits";

async function guard(params: Promise<{ id: string }>) {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true } });
  if (!property || !canEditProperty(me, property)) {
    return { error: NextResponse.json({ error: "You can't manage this property." }, { status: 403 }) };
  }
  return { me, property };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if ("error" in g) return g.error;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim();
  const address = String(body.email ?? "").trim().toLowerCase();

  const coOwner = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true, email: true, createdById: true } })
    : address
      ? await prisma.user.findUnique({ where: { email: address }, select: { id: true, role: true, name: true, email: true, createdById: true } })
      : null;
  const status = coOwner ? await getVerificationStatus(coOwner.id) : null;
  // One generic message for email lookups so this can't be used to probe which emails are registered
  if (!coOwner || coOwner.role !== "PROPERTY_ADMIN" || (g.me.role === "PROPERTY_ADMIN" && status !== null && status !== "VERIFIED")) {
    return NextResponse.json({ error: userId ? "Choose a valid Property Admin as co-owner." : "No verified Property Admin was found with that email." }, { status: 400 });
  }
  if (g.me.role === "PROPERTY_ADMIN" && userId && coOwner.createdById !== g.me.id) {
    return NextResponse.json({ error: "You can only add co-owners you created." }, { status: 403 });
  }
  if (coOwner.id === g.property.ownerId) {
    return NextResponse.json({ error: "The primary owner can't also be a co-owner." }, { status: 400 });
  }
  const count = await prisma.propertyCoOwner.count({ where: { propertyId: g.property.id } });
  if (count >= MAX_CO_OWNERS) {
    return NextResponse.json({ error: `A property can have at most ${MAX_CO_OWNERS} co-owners.` }, { status: 409 });
  }
  const existing = await prisma.propertyCoOwner.findUnique({
    where: { propertyId_userId: { propertyId: g.property.id, userId: coOwner.id } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "That person is already a co-owner." }, { status: 409 });

  await prisma.propertyCoOwner.create({ data: { propertyId: g.property.id, userId: coOwner.id, assignedById: g.me.id } });

  const who = (g.me as unknown as { name?: string }).name ?? "A Property Admin";
  await emailCoOwnerAssignment(g.property.id, coOwner, who);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if ("error" in g) return g.error;

  const { userId } = await req.json().catch(() => ({}));
  const row = await prisma.propertyCoOwner.findUnique({
    where: { propertyId_userId: { propertyId: g.property.id, userId: String(userId ?? "") } },
    include: { documents: { select: { path: true } } },
  });
  if (!row) return NextResponse.json({ error: "That co-owner was not found." }, { status: 404 });

  await prisma.propertyCoOwner.delete({ where: { id: row.id } }); // proof rows cascade
  await Promise.all(row.documents.map((d) => removeSensitiveFile(d.path)));

  return NextResponse.json({ ok: true });
}
