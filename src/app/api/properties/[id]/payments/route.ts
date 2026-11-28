import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { BILL_LABEL, monthLabel } from "@/lib/bills";
import { withTax } from "@/lib/invoice";

const PAGE_SIZE = 10;
const fmt = (d: Date) => d.toLocaleDateString("en-IN");
const flatNo = (l: string) => l.replace(/^flat\s+/i, "");

// Paid rent + paid bills of ONE floor (optionally one flat), one page of 10 at a time. Only paid entries are history,
// so "Paid by" and "Paid on" are always filled. Amount is what was paid (tax included), same as on the invoice.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!property || !(await canOperateProperty(me, property))) return NextResponse.json({ error: "You can't view this history." }, { status: 403 });

  const url = new URL(req.url);
  const asked = Number(url.searchParams.get("floor"));
  const floor = Number.isFinite(asked) ? asked : 0;
  const floorWhere = floor === 0 ? { OR: [{ floorNumber: null }, { floorNumber: 0 }] } : { floorNumber: floor };

  // Every person who ever lived on this floor (tiny rows), grouped by flat
  const people = await prisma.allocation.findMany({
    where: { room: { propertyId: id }, ...floorWhere },
    select: { id: true, roomId: true, room: { select: { label: true } } },
  });
  const ids = people.map((p) => p.id);
  const byRoom = new Map<string, { label: string; ids: string[] }>();
  for (const p of people) {
    const g = byRoom.get(p.roomId) ?? { label: p.room.label, ids: [] };
    g.ids.push(p.id);
    byRoom.set(p.roomId, g);
  }

  // Counts per person with two GROUP BY queries, then summed per flat
  const [rc, bc] = ids.length === 0 ? [[], []] : await Promise.all([
    prisma.rentPayment.groupBy({ by: ["allocationId"], where: { paid: true, allocationId: { in: ids } }, _count: { _all: true } }),
    prisma.residentBill.groupBy({ by: ["allocationId"], where: { paid: true, allocationId: { in: ids } }, _count: { _all: true } }),
  ]);
  const perPerson = new Map<string, number>();
  for (const g of rc) perPerson.set(g.allocationId, (perPerson.get(g.allocationId) ?? 0) + g._count._all);
  for (const g of bc) perPerson.set(g.allocationId, (perPerson.get(g.allocationId) ?? 0) + g._count._all);
  let floorTotal = 0;
  const flats = [...byRoom.entries()]
    .map(([roomId, g]) => {
      const n = g.ids.reduce((s, i) => s + (perPerson.get(i) ?? 0), 0);
      floorTotal += n;
      return { id: roomId, label: g.label, n };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const roomId = url.searchParams.get("roomId");
  const sel = roomId ? byRoom.get(roomId)?.ids ?? [] : ids;
  const total = roomId ? flats.find((f) => f.id === roomId)?.n ?? 0 : floorTotal;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1), pages);

  type Row = { key: string; at: number; type: string; period: string; flat: string; amount: number; paidBy: string; paidOn: string; note: string | null; href: string };
  let rows: Omit<Row, "at">[] = [];
  if (total > 0 && sel.length > 0) {
    // Newest first from both tables, then merged: only the first page*10 of each can be on this page
    const take = page * PAGE_SIZE;
    const who = { select: { accessToken: true, fullName: true, roomLabel: true, room: { select: { label: true } } } };
    const [rents, bills] = await Promise.all([
      prisma.rentPayment.findMany({
        where: { paid: true, allocationId: { in: sel } }, orderBy: { updatedAt: "desc" }, take,
        select: { id: true, period: true, amount: true, taxPct: true, paidAt: true, updatedAt: true, allocation: who },
      }),
      prisma.residentBill.findMany({
        where: { paid: true, allocationId: { in: sel } }, orderBy: { updatedAt: "desc" }, take,
        select: { id: true, type: true, period: true, amount: true, taxPct: true, note: true, paidAt: true, updatedAt: true, allocation: who },
      }),
    ]);
    const merged: Row[] = [
      ...rents.map((r) => ({
        key: `r-${r.id}`, at: r.updatedAt.getTime(), type: "Rent", period: monthLabel(r.period), flat: flatNo(r.allocation.roomLabel ?? r.allocation.room.label),
        amount: withTax(r.amount, r.taxPct), paidBy: r.allocation.fullName, paidOn: fmt(r.paidAt ?? r.updatedAt), note: null,
        href: `/resident/${r.allocation.accessToken}/rent?period=${r.period}`,
      })),
      ...bills.map((b) => ({
        key: `b-${b.id}`, at: b.updatedAt.getTime(), type: BILL_LABEL[b.type], period: monthLabel(b.period), flat: flatNo(b.allocation.roomLabel ?? b.allocation.room.label),
        amount: withTax(b.amount, b.taxPct), paidBy: b.allocation.fullName, paidOn: fmt(b.paidAt ?? b.updatedAt), note: b.note,
        href: `/resident/${b.allocation.accessToken}/bill/${b.id}`,
      })),
    ];
    rows = merged.sort((a, b) => b.at - a.at).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ at, ...r }) => (void at, r));
  }

  return NextResponse.json({ floor, flats, floorTotal, page, pages, total, pageSize: PAGE_SIZE, rows });
}