import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Mark a whole property (no roomId) or one room / flat as active or inactive (e.g. under construction).
// Inactive units are skipped when allocating. A unit with people living in it can't be made inactive.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not signed in.", 401);

  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || !(await canOperateProperty(me, property))) return fail("You can't manage this property.", 403);

  const body = (await req.json().catch(() => null)) as { roomId?: string; active?: boolean; note?: string } | null;
  if (!body || typeof body.active !== "boolean") return fail("Invalid request.");
  const note = String(body.note ?? "").trim().slice(0, 200) || null;

  if (!body.active) {
    const living = await prisma.allocation.count({
      where: { status: "ACTIVE", room: { propertyId: id, ...(body.roomId ? { id: body.roomId } : {}) } },
    });
    if (living > 0) {
      return fail(`People are living ${body.roomId ? "here" : "in this property"}. Check them out first, then mark it inactive.`, 409);
    }
  }

  const data = { isActive: body.active, inactiveNote: body.active ? null : note };
  if (body.roomId) {
    const room = await prisma.room.findFirst({ where: { id: body.roomId, propertyId: id }, select: { id: true } });
    if (!room) return fail("Room not found.", 404);
    await prisma.room.update({ where: { id: room.id }, data });
  } else {
    await prisma.property.update({ where: { id }, data });
  }
  return NextResponse.json({ ok: true });
}
