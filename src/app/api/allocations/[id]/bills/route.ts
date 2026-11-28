import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty, operableAllocationSelect } from "@/lib/property-access";
import { cleanPct } from "@/lib/invoice";
import { rentPeriod } from "@/lib/bills";

const TYPES = ["ELECTRICITY", "WATER"] as const;

async function load(id: string) {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const allocation = await prisma.allocation.findUnique({ where: { id }, select: operableAllocationSelect });
  if (!allocation || !(await canOperateProperty(me, allocation.room.property))) {
    return { error: NextResponse.json({ error: "You can't manage this resident." }, { status: 403 }) };
  }
  return { me, allocation };
}

// Generates a new bill. One bill per type per month: if it already exists, the caller must edit it (PATCH) instead.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await load(id);
  if ("error" in g) return g.error;

  const b = await req.json().catch(() => ({}));
  const type = TYPES.find((t) => t === b.type);
  const period = String(b.period ?? "");
  const amount = Number(b.amount);
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";

  if (!type) return NextResponse.json({ error: "Choose electricity or water." }, { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
  // Not for a future month, and not for a month before the resident moved in
  const moveInPeriod = rentPeriod(g.allocation.moveInDate);
  if (period > rentPeriod() || period < moveInPeriod) {
    return NextResponse.json({ error: "Choose a month from the move-in month up to the current month." }, { status: 400 });
  }
  if (String(b.amount ?? "").trim() === "" || !Number.isInteger(amount) || amount < 0 || amount > 10_000_000) {
    return NextResponse.json({ error: "Enter the bill amount in whole rupees." }, { status: 400 });
  }

  // Tax % is optional (0 when left out). `amount` is the amount before tax.
  const taxPct = b.taxPct === undefined || b.taxPct === null ? 0 : cleanPct(b.taxPct);
  if (taxPct === null) return NextResponse.json({ error: "Enter a tax between 0 and 100." }, { status: 400 });

  // Never overwrite or double up: a second bill for the same month and type is refused
  const dup = await prisma.residentBill.findFirst({ where: { allocationId: id, type, period }, select: { id: true } });
  if (dup) return NextResponse.json({ error: "A bill of this type already exists for this month. Edit that bill instead.", existingId: dup.id }, { status: 409 });
  const paid = b.paid === true;
  const bill = await prisma.residentBill.create({
    data: { allocationId: id, type, period, amount, taxPct, note: note || null, paid, paidAt: paid ? new Date() : null, createdById: g.me.id },
  });
  return NextResponse.json(bill, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await load(id);
  if ("error" in g) return g.error;
  const { billId } = await req.json().catch(() => ({}));
  await prisma.residentBill.deleteMany({ where: { id: String(billId ?? ""), allocationId: id } });
  return NextResponse.json({ ok: true });
}

// Changes the paid / unpaid status of one bill, or (when `amount` is sent) edits an unpaid bill's amount, tax and note
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await load(id);
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  const bill = await prisma.residentBill.findFirst({ where: { id: String(b.billId ?? ""), allocationId: id }, select: { id: true, paid: true, paidAt: true } });
  if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  if (b.amount !== undefined) {
    if (bill.paid) return NextResponse.json({ error: "A paid bill can't be edited." }, { status: 409 });
    const amount = Number(b.amount);
    if (String(b.amount).trim() === "" || !Number.isInteger(amount) || amount < 0 || amount > 10_000_000) return NextResponse.json({ error: "Enter the bill amount in whole rupees." }, { status: 400 });
    const taxPct = b.taxPct === undefined || b.taxPct === null ? 0 : cleanPct(b.taxPct);
    if (taxPct === null) return NextResponse.json({ error: "Enter a tax between 0 and 100." }, { status: 400 });
    const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
    return NextResponse.json(await prisma.residentBill.update({ where: { id: bill.id }, data: { amount, taxPct, note: note || null } }));
  }

  if (typeof b.paid !== "boolean") return NextResponse.json({ error: "Choose paid or unpaid." }, { status: 400 });
  const paidAt = b.paid ? (bill.paid ? bill.paidAt ?? new Date() : new Date()) : null;
  const updated = await prisma.residentBill.update({ where: { id: bill.id }, data: { paid: b.paid, paidAt } });
  return NextResponse.json(updated);
}
