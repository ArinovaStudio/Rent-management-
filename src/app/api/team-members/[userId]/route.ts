import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { applyPersonUpdate } from "@/lib/person-update";

// Read / edit a co-owner or manager from the property form.
// Allowed for: Super Admin, the person who created the account (covers people not linked to a property yet),
// or anyone who can edit the property the person is linked to (pass ?propertyId=).
async function guard(req: Request, params: Promise<{ userId: string }>) {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };

  const { userId } = await params;
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, createdById: true,
      ownerProfile: { select: { phone: true, age: true, photoPath: true, verificationStatus: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, idType: true, idNumberMasked: true, documents: { select: { id: true, originalName: true, type: true }, orderBy: { uploadedAt: "asc" } } } },
    },
  });
  if (!target || (target.role !== "PROPERTY_ADMIN" && target.role !== "PROPERTY_MANAGER")) {
    return { error: NextResponse.json({ error: "Person not found." }, { status: 404 }) };
  }

  // Edit: Super Admin, or the Property Admin who created the account. View: those, plus anyone who can edit a property it is linked to.
  const editable = me.role === "SUPER_ADMIN" || target.createdById === me.id;
  let allowed = editable;
  const propertyId = new URL(req.url).searchParams.get("propertyId");
  if (!allowed && propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, ownerId: true } });
    if (property && property.ownerId !== target.id && canEditProperty(me, property)) {
      const [mgr, co] = await Promise.all([
        prisma.propertyManager.findFirst({ where: { propertyId, managerId: userId }, select: { id: true } }),
        prisma.propertyCoOwner.findFirst({ where: { propertyId, userId }, select: { userId: true } }),
      ]);
      allowed = !!(mgr || co);
    }
  }
  if (!allowed) return { error: NextResponse.json({ error: "You can't edit this person." }, { status: 403 }) };
  return { target, editable };
}

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;
  const { target: u, editable } = g;
  const p = u.ownerProfile;
  return NextResponse.json({
    id: u.id, kind: u.role === "PROPERTY_ADMIN" ? "coOwner" : "manager", name: u.name, email: u.email,
    phone: p?.phone ?? null, age: p?.age ?? null, photoPath: p?.photoPath ?? null, verified: p?.verificationStatus === "VERIFIED",
    addressLine1: p?.addressLine1 ?? null, addressLine2: p?.addressLine2 ?? null, city: p?.city ?? null, state: p?.state ?? null,
    postalCode: p?.postalCode ?? null, idType: p?.idType ?? null, idNumberMasked: p?.idNumberMasked ?? null,
    editable,
    // Documents are only listed for people allowed to open them
    documents: editable ? (p?.documents ?? []).map((d) => ({ id: d.id, name: d.originalName, type: d.type })) : [],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;
  if (!g.editable) return NextResponse.json({ error: "You can only edit people you created." }, { status: 403 });
  return applyPersonUpdate(req, g.target.id);
}
