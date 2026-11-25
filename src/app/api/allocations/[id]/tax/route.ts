import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { RENT_TAX_KEY, amenityTaxKey, cleanPct, taxRatesOf } from "@/lib/invoice";

// Saves the tax % of one invoice line.
//   { target: "RENT", pct }                  rent of this tenant (every month that isn't paid yet)
//   { target: "AMENITY", name, pct }         one amenity charge on the rent invoice
//   { target: "BILL", billId, pct }          one electricity / water bill
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const a = await prisma.allocation.findUnique({ where: { id }, include: { room: { include: { property: true } } } });
  if (!a || !(await canOperateProperty(me, a.room.property))) return NextResponse.json({ error: "You can't manage this resident." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const pct = typeof b.pct === "number" || typeof b.pct === "string" ? cleanPct(b.pct) : null;
  if (pct === null) return NextResponse.json({ error: "Enter a tax between 0 and 100." }, { status: 400 });

  if (b.target === "BILL") {
    const bill = await prisma.residentBill.findFirst({ where: { id: String(b.billId ?? ""), allocationId: id }, select: { id: true, paid: true } });
    if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    if (bill.paid) return NextResponse.json({ error: "This bill is already paid, so its tax can't change." }, { status: 409 });
    await prisma.residentBill.update({ where: { id: bill.id }, data: { taxPct: pct } });
    return NextResponse.json({ ok: true, pct });
  }

  let key: string;
  if (b.target === "RENT") {
    key = RENT_TAX_KEY;
  } else if (b.target === "AMENITY") {
    const name = typeof b.name === "string" ? b.name : "";
    if (!a.room.property.amenities.includes(name)) return NextResponse.json({ error: "Amenity not found." }, { status: 404 });
    key = amenityTaxKey(name);
  } else {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  await prisma.allocation.update({ where: { id }, data: { taxRates: { ...taxRatesOf(a.taxRates), [key]: pct } } });
  return NextResponse.json({ ok: true, pct });
}
