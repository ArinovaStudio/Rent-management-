import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";

const PAGE_SIZE = 10;
const fmt = (d: Date) => d.toLocaleDateString("en-IN");

// Tenant history of a building, one floor and one page of 10 at a time.
// Floor tabs and counts come from one GROUP BY; only the 10 visible rows are loaded.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!property || !(await canOperateProperty(me, property))) return NextResponse.json({ error: "You can't view this history." }, { status: 403 });

  const url = new URL(req.url);
  const base = { status: "CHECKED_OUT" as const, room: { propertyId: id } };

  const groups = await prisma.allocation.groupBy({ by: ["floorNumber"], where: base, _count: { _all: true } });
  const counts = new Map<number, number>();
  for (const g of groups) counts.set(g.floorNumber ?? 0, (counts.get(g.floorNumber ?? 0) ?? 0) + g._count._all);
  const floors = [...counts.entries()].map(([floor, count]) => ({ floor, count })).sort((a, b) => a.floor - b.floor);

  const asked = url.searchParams.get("floor");
  const floor = asked !== null && counts.has(Number(asked)) ? Number(asked) : floors[0]?.floor ?? 0;
  const total = counts.get(floor) ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1), pages);

  const past = total === 0 ? [] : await prisma.allocation.findMany({
    where: { ...base, ...(floor === 0 ? { OR: [{ floorNumber: null }, { floorNumber: 0 }] } : { floorNumber: floor }) },
    select: {
      id: true, roomId: true, fullName: true, phone: true, email: true, isHousemate: true,
      floorNumber: true, roomLabel: true, roomBhk: true, monthlyRent: true, securityDeposit: true,
      moveInDate: true, moveOutDate: true, updatedAt: true,
      room: { select: { label: true, floor: true, bedrooms: true } },
      _count: { select: { documents: true } },
    },
    orderBy: [{ moveOutDate: "desc" }, { updatedAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // "Living together": one query for the rooms on this page, then counted in memory for these rows only
  const roomIds = [...new Set(past.map((a) => a.roomId))];
  const sameRooms = roomIds.length === 0 ? [] : await prisma.allocation.findMany({
    where: { roomId: { in: roomIds } },
    select: { roomId: true, moveInDate: true, moveOutDate: true, updatedAt: true, status: true },
  });
  const endOf = (x: { status: string; moveOutDate: Date | null; updatedAt: Date }) => (x.status === "ACTIVE" ? null : x.moveOutDate ?? x.updatedAt);

  const rows = past.map((a) => {
    const out = a.moveOutDate ?? a.updatedAt;
    const people = sameRooms.filter((b) => {
      const end = endOf(b);
      return b.roomId === a.roomId && b.moveInDate <= out && (end === null || end >= a.moveInDate);
    }).length;
    return {
      id: a.id, name: a.fullName, phone: a.phone, email: a.email, role: a.isHousemate ? "Housemate" : "Main tenant",
      floor: a.floorNumber ?? a.room.floor ?? 0, flat: a.roomLabel ?? a.room.label, bhk: a.roomBhk ?? a.room.bedrooms,
      people, rent: a.monthlyRent, deposit: a.securityDeposit, moveIn: fmt(a.moveInDate), moveOut: fmt(out), docs: a._count.documents,
    };
  });

  return NextResponse.json({ floors, floor, page, pages, total, pageSize: PAGE_SIZE, rows });
}
