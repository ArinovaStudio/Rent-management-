import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";

const TYPES = ["ELECTRICITY", "WATER"] as const;

async function load(id: string) {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const allocation = await prisma.allocation.findUnique({ where: { id }, include: { room: { include: { property: true } } } });
  if (!allocation || !(await canOperateProperty(me, allocation.room.property))) {
    return { error: NextResponse.json({ error: "You can't manage this resident." }, { status: 403 }) };
  }
  return { me, allocation };
}

// Generates a new bill. Older bills are never replaced.
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
  if (String(b.amount ?? "").trim() === "" || !Number.isInteger(amount) || amount < 0 || amount > 10_000_000) {
    return NextResponse.json({ error: "Enter the bill amount in whole rupees." }, { status: 400 });
  }

  // Every generated bill is its own record, so earlier bills stay in the resident's history
  const paid = b.paid === true;
  const bill = await prisma.residentBill.create({
    data: { allocationId: id, type, period, amount, note: note || null, paid, paidAt: paid ? new Date() : null, createdById: g.me.id },
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

// Changes only the paid / unpaid status of one bill
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await load(id);
  if ("error" in g) return g.error;
  const b = await req.json().catch(() => ({}));
  if (typeof b.paid !== "boolean") return NextResponse.json({ error: "Choose paid or unpaid." }, { status: 400 });
  const bill = await prisma.residentBill.findFirst({ where: { id: String(b.billId ?? ""), allocationId: id }, select: { id: true, paid: true, paidAt: true } });
  if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  const paidAt = b.paid ? (bill.paid ? bill.paidAt ?? new Date() : new Date()) : null;
  const updated = await prisma.residentBill.update({ where: { id: bill.id }, data: { paid: b.paid, paidAt } });
  return NextResponse.json(updated);
}
