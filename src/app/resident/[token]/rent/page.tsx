import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate, monthLabel, nextRentDue } from "@/lib/bills";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { RENT_TERMS, payeeFor, propertyLines, type InvoiceData } from "@/lib/invoice";
import InvoiceView from "../invoice-view";
import { isWholeUnit } from "@/lib/occupancy";
import { amenityCharges } from "@/lib/amenity-charges";

export default async function RentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await prisma.allocation.findUnique({
    where: { accessToken: token },
    include: { room: { include: { property: true } } },
  });
  if (!a) notFound();
  const property = a.room.property;

  const amenity = a.monthlyRent > 0 ? amenityCharges(property) : { list: [], total: 0 };
  const due = nextRentDue(a.moveInDate);
  const period = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
  const category = a.roomCategory ?? roomCategoryLabel(property, a.room);
  const floor = a.floorNumber ?? roomFloor(property, a.room);
  const household = isWholeUnit(property)
    ? await prisma.allocation.count({ where: { roomId: a.roomId, status: "ACTIVE" } })
    : a.occupants;
  
  const invoice: InvoiceData = {
    invoiceNo: `RENT-${token.slice(0, 4).toUpperCase()}-${period.replace("-", "")}`,
    kind: "RENT",
    periodLabel: monthLabel(period),
    status: "DUE",
    paidOn: null,
    from: { name: property.name, lines: propertyLines(property) },
    to: {
      name: a.fullName,
      lines: [`${a.room.label}${floor != null ? ` · Floor ${floor}` : ""}`, ...propertyLines(property)],
      phone: a.phone,
      email: a.email,
    },
    issueDate: fmtDate(new Date()),
    dueDate: fmtDate(due),
    items: [{ title: `Monthly rent · ${monthLabel(period)}`, description: `${category} · ${a.room.label}`, rate: a.monthlyRent, taxPct: 0 }, ...amenity.list.map((x) => ({ title: `${x.name} charge`, description: "Amenity · monthly", rate: x.charge, taxPct: 0 }))],
    terms: RENT_TERMS,
    backHref: `/resident/${token}`,
    splitPeople: household,
    payee: payeeFor(property.name),
  };

  return (
    <div className="tw min-h-screen bg-cream/60 text-foreground">
      <main className="px-4 py-8 md:py-12 print:p-0"><InvoiceView invoice={invoice} /></main>
    </div>
  );
}
