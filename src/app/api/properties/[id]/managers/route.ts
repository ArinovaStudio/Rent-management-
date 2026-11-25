import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { isVerifiedManager } from "@/lib/property-access";
import { notify } from "@/lib/mailer";

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

const TYPE_LABEL: Record<string, string> = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" };

// Tells the manager which property they now run, with the details they need to get started. Best effort: never fails the assignment.
async function emailAssignment(propertyId: string, manager: { name: string; email: string }, assignedBy: string) {
  const p = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      owner: { select: { name: true, email: true } },
      rooms: { select: { floor: true, isActive: true } },
      managers: { select: { id: true } },
    },
  });
  if (!p) return;

  const floors = new Set(p.rooms.map((r) => r.floor ?? 0)).size;
  const unit = p.type === "BUILDING" ? "flats" : p.type === "PG" ? "rooms" : "units";
  const app = process.env.APP_URL?.replace(/\/$/, "");
  const lines = [
    `Hi ${manager.name},`,
    "",
    `${assignedBy} has assigned you to manage a property. You can now see it under Properties when you sign in.`,
    "",
    "Property details",
    `Name: ${p.name}`,
    `Type: ${TYPE_LABEL[p.type] ?? p.type}${p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""}`,
    `Address: ${p.address}, ${p.city}`,
    ...(p.mapUrl ? [`Map: ${p.mapUrl}`] : []),
    `Size: ${p.rooms.length} ${unit}${floors > 1 ? ` across ${floors} floors` : ""}`,
    `Owner: ${p.owner.name} (${p.owner.email})`,
    ...(p.isActive ? [] : [`Status: currently inactive${p.inactiveNote ? ` (${p.inactiveNote})` : ""}. New residents can't be added until it is switched On.`]),
    "",
    "What you can do",
    "- Allocate residents and check them out, and see who lives where",
    "- Generate electricity and water bills and send them to residents",
    "- Mark rent and bills as paid in the Payment Ledger and send payment reminders",
    "- Switch rooms or floors On or Off in Availability",
    "- Raise an issue with the owner from Properties or Issues",
    "You cannot edit the property listing itself. Ask the owner or the Super Admin for that.",
    "",
    app ? `Open the property: ${app}/dashboard/properties/${p.id}/rooms` : "Sign in and open Properties to get started.",
    "",
    "If you were not expecting this, contact the person who assigned you.",
  ];
  await notify(manager.email, `You have been assigned to ${p.name}`, lines.join("\n"));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, params);
  if ("error" in g) return g.error;

  // Email only when the manager is newly assigned, not when the same assignment is saved again
  const already = await prisma.propertyManager.findUnique({
    where: { propertyId_managerId: { propertyId: g.property.id, managerId: g.manager.id } },
    select: { id: true },
  });
  await prisma.propertyManager.upsert({
    where: { propertyId_managerId: { propertyId: g.property.id, managerId: g.manager.id } },
    create: { propertyId: g.property.id, managerId: g.manager.id, assignedById: g.me.id },
    update: {},
  });
  if (!already) await emailAssignment(g.property.id, g.manager, g.me.name);
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