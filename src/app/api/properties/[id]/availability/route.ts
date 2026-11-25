import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Switch units On (active) or Off (inactive). What is switched depends on what is sent:
//   {}                                  the whole property
//   { floor }                           every room / flat on that floor
//   { floor, capacity, ac }             every room of one category on that floor (PG: "3-seater AC")
//   { roomId }                          one room / flat
// Inactive units are skipped when allocating. Anything with people living in it can't be switched Off.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not signed in.", 401);

  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || !(await canOperateProperty(me, property))) return fail("You can't manage this property.", 403);

  const body = (await req.json().catch(() => null)) as { roomId?: string; floor?: number; capacity?: number; ac?: boolean; active?: boolean; note?: string } | null;
  if (!body || typeof body.active !== "boolean") return fail("Invalid request.");
  const note = String(body.note ?? "").trim().slice(0, 200) || null;
  const data = { isActive: body.active, inactiveNote: body.active ? null : note };

  // ---- whole property ----
  if (!body.roomId && body.floor === undefined && body.capacity === undefined) {
    if (!body.active) {
      const living = await prisma.allocation.count({ where: { status: "ACTIVE", room: { propertyId: id } } });
      if (living > 0) return fail("People are living in this property. Check them out first, then switch it Off.", 409);
    }
    await prisma.property.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  }

  // ---- one room ----
  // ---- a floor, or one category on a floor ----
  let where: Prisma.RoomWhereInput;
  let what: string;
  if (body.roomId) {
    where = { id: body.roomId, propertyId: id };
    what = "this unit";
  } else {
    if (!Number.isInteger(body.floor)) return fail("Choose a floor.");
    const floorWhere: Prisma.RoomWhereInput = body.floor === 0 ? { OR: [{ floor: 0 }, { floor: null }] } : { floor: body.floor };
    if (body.capacity !== undefined) {
      if (!Number.isInteger(body.capacity) || typeof body.ac !== "boolean") return fail("Choose a room category.");
      where = { propertyId: id, AND: [floorWhere, { capacity: body.capacity, ac: body.ac }] };
      what = "these rooms";
    } else {
      where = { propertyId: id, AND: [floorWhere] };
      what = "this floor";
    }
  }

  const rooms = await prisma.room.findMany({ where, select: { id: true } });
  if (rooms.length === 0) return fail("Nothing found to change.", 404);
  const ids = rooms.map((r) => r.id);

  if (!body.active) {
    const living = await prisma.allocation.count({ where: { status: "ACTIVE", roomId: { in: ids } } });
    if (living > 0) {
      return fail(`${living} ${living === 1 ? "person is" : "people are"} living in ${what}. Check them out first, then switch it Off.`, 409);
    }
  }
  await prisma.room.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ ok: true, changed: ids.length });
}
