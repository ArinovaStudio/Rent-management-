import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";

// Sets rent paid / unpaid for one month of one main tenant
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const a = await prisma.allocation.findUnique({ where: { id }, include: { room: { include: { property: true } } } });
  if (!a || !(await canOperateProperty(me, a.room.property))) return NextResponse.json({ error: "You can't manage this resident." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const period = String(b.period ?? "");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return NextResponse.json({ error: "Choose a valid month." }, { status: 400 });
  if (typeof b.paid !== "boolean") return NextResponse.json({ error: "Choose paid or unpaid." }, { status: 400 });

  const key = { allocationId_period: { allocationId: id, period } };
  const existing = await prisma.rentPayment.findUnique({ where: key, select: { paid: true, paidAt: true, amount: true } });
  const paidAt = b.paid ? (existing?.paid ? existing.paidAt ?? new Date() : new Date()) : null;
  const row = await prisma.rentPayment.upsert({
    where: key,
    create: { allocationId: id, period, amount: a.monthlyRent, paid: b.paid, paidAt, updatedById: me.id },
    // amount keeps the rent saved the first time, so later rent changes never rewrite an old month
    update: { paid: b.paid, paidAt, updatedById: me.id },
  });
  return NextResponse.json(row);
}
