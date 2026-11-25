import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate, monthLabel, rentDueDate, rentPeriod } from "@/lib/bills";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { RENT_TAX_KEY, RENT_TERMS, amenityTaxKey, payeeFor, propertyLines, taxRatesOf, type InvoiceData } from "@/lib/invoice";
import { getSessionUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import InvoiceView from "../invoice-view";
import { isWholeUnit } from "@/lib/occupancy";
import { amenityCharges } from "@/lib/amenity-charges";

export default async function RentPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ period?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const a = await prisma.allocation.findUnique({
    where: { accessToken: token },
    include: { room: { include: { property: true } } },
  });
  if (!a) notFound();
  const property = a.room.property;

  // Current month by default; ?period= opens the invoice of an earlier month
  const period = sp.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.period) ? sp.period : rentPeriod();
  const due = rentDueDate(a.moveInDate, period);
  const paidRow = await prisma.rentPayment.findUnique({ where: { allocationId_period: { allocationId: a.id, period } } });
  // A month that has a saved payment keeps the rent it had then, whatever the rent is now
  const rentAmount = paidRow ? paidRow.amount : a.monthlyRent;
  const amenity = a.monthlyRent > 0 && !paidRow?.paid ? amenityCharges(property) : { list: [], total: 0 };
  const category = a.roomCategory ?? roomCategoryLabel(property, a.room);
  const floor = a.floorNumber ?? roomFloor(property, a.room);
  const household = isWholeUnit(property)
    ? await prisma.allocation.count({ where: { roomId: a.roomId, status: "ACTIVE" } })
    : a.occupants;

  // Tax % per line. A paid month keeps the rent tax it had when it was paid; staff can edit the tax of an unpaid invoice.
  const rates = taxRatesOf(a.taxRates);
  const rentTax = paidRow?.paid ? paidRow.taxPct : rates[RENT_TAX_KEY] ?? 0;
  const me = await getSessionUser();
  const canEditTax = !paidRow?.paid && !!me && (await canOperateProperty(me, property));

  const invoice: InvoiceData = {
    invoiceNo: `RENT-${token.slice(0, 4).toUpperCase()}-${period.replace("-", "")}`,
    kind: "RENT",
    periodLabel: monthLabel(period),
    status: paidRow?.paid ? "PAID" : "DUE",
    paidOn: paidRow?.paid ? fmtDate(paidRow.paidAt ?? paidRow.updatedAt) : null,
    from: { name: property.name, lines: propertyLines(property) },
    to: {
      name: a.fullName,
      lines: [`${a.room.label}${floor != null ? ` · Floor ${floor}` : ""}`, ...propertyLines(property)],
      phone: a.phone,
      email: a.email,
    },
    issueDate: fmtDate(new Date()),
    dueDate: fmtDate(due),
    items: [
      { key: RENT_TAX_KEY, title: `Monthly rent · ${monthLabel(period)}`, description: `${category} · ${a.room.label}`, rate: rentAmount, taxPct: rentTax },
      ...amenity.list.map((x) => ({ key: amenityTaxKey(x.name), title: `${x.name} charge`, description: "Amenity · monthly", rate: x.charge, taxPct: rates[amenityTaxKey(x.name)] ?? 0 })),
    ],
    terms: RENT_TERMS,
    backHref: `/resident/${token}`,
    splitPeople: household,
    payee: payeeFor(property.name),
  };

  return (
    <div className="tw min-h-screen bg-cream/60 text-foreground">
      <main className="px-4 py-8 md:py-12 print:p-0"><InvoiceView invoice={invoice} taxEdit={canEditTax ? { allocationId: a.id } : undefined} /></main>
    </div>
  );
}
