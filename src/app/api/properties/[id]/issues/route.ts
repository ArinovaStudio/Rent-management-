import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { isAssignedManager } from "@/lib/property-access";
import { notify } from "@/lib/mailer";
import { isVerifiedManager } from "@/lib/property-access";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

// Only a manager assigned to this property can raise an issue on it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (me.role !== "PROPERTY_MANAGER") return NextResponse.json({ error: "Only managers can raise issues." }, { status: 403 });

  const { id: propertyId } = await params;
  if (!(await isAssignedManager(me.id, propertyId)) || !(await isVerifiedManager(me.id))) {
    return NextResponse.json({ error: "You aren't assigned to this property." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const title = String(b.title ?? "").trim().slice(0, 150);
  const description = String(b.description ?? "").trim().slice(0, 4000);
  const priority = PRIORITIES.includes(b.priority) ? b.priority : "MEDIUM";
  const roomId = b.roomId ? String(b.roomId) : null;
  if (!title || !description) {
    return NextResponse.json({ error: "Add a title and a description." }, { status: 400 });
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!property) return NextResponse.json({ error: "Property not found." }, { status: 404 });

  if (roomId && !(await prisma.room.findFirst({ where: { id: roomId, propertyId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Choose a room from this property." }, { status: 400 });
  }

  const issue = await prisma.issue.create({
    data: { propertyId, roomId, reportedById: me.id, title, description, priority },
    select: { id: true },
  });

  await notify(
    property.owner.email,
    `New issue at "${property.name}": ${title}`,
    `${me.name} reported an issue (${priority.toLowerCase()} priority):\n\n${title}\n\n${description}\n\nSign in and open Issues on your dashboard to respond.`
  );
  return NextResponse.json(issue, { status: 201 });
}