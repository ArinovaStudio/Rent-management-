import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { isShareableUnit } from "@/lib/occupancy";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Mark a SHARED flat Vacant (more residents can be added) or Non vacant (no more residents). Super Admin / owning Property Admin only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return fail("Not signed in.", 401);

  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!property || !(await canOperateProperty(me, property))) return fail("You can't change flat availability.", 403);

  const body = (await req.json().catch(() => null)) as { roomId?: string; vacant?: boolean } | null;
  if (!body?.roomId || typeof body.vacant !== "boolean") return fail("Invalid request.");

  const room = await prisma.room.findFirst({ where: { id: body.roomId, propertyId: id }, select: { id: true, roomType: true, capacity: true } });
  if (!room) return fail("Flat not found.", 404);
  if (!isShareableUnit(room)) return fail("Only a shared flat can be changed. A single flat is Non vacant while rented.");

  await prisma.room.update({ where: { id: room.id }, data: { closedToNew: !body.vacant } });
  return NextResponse.json({ ok: true });
}
