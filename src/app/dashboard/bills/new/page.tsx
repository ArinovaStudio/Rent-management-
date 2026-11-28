import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { propertiesBase } from "@/lib/routes";
import { fmtDate, rentPeriod } from "@/lib/bills";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { BILL_TERMS, propertyLines, type DraftBill, type InvoiceData } from "@/lib/invoice";
import InvoiceView from "@/app/resident/[token]/invoice-view";

// Where "Generate Bill" on the rooms page lands: /dashboard/bills/new?allocation=<id>&type=ELECTRICITY|WATER
// It is the resident's invoice page, but the month, units and rate are typed in here and the bill is calculated from them.
// Staff only (the dashboard is behind the sign-in), and only for properties this person can run.
export default async function NewBillPage({ searchParams }: { searchParams: Promise<{ allocation?: string; type?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const sp = await searchParams;
  const type = sp.type === "ELECTRICITY" || sp.type === "WATER" ? sp.type : null;
  if (!type || !sp.allocation) notFound();

  const a = await prisma.allocation.findUnique({
    where: { id: sp.allocation },
    include: { room: { include: { property: true } } },
  });
  if (!a || !(await canOperateProperty(me, a.room.property))) notFound();

  const property = a.room.property;
  const floor = a.floorNumber ?? roomFloor(property, a.room);
  const category = a.roomCategory ?? roomCategoryLabel(property, a.room);
  // A bill can be for any month from the move-in month up to the current month, never a future one
  const maxPeriod = rentPeriod();
  const moveInPeriod = rentPeriod(a.moveInDate);
  const minPeriod = moveInPeriod <= maxPeriod ? moveInPeriod : maxPeriod;
  const initialPeriod = maxPeriod;

  const invoice: InvoiceData = {
    invoiceNo: "NEW",
    kind: "BILL",
    periodLabel: "—",
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
    dueDate: "—",
    items: [],
    terms: BILL_TERMS,
    backHref: `${propertiesBase(me.role)}/${property.id}/rooms`,
    backLabel: "Back to rooms",
    payee: { upiId: "", name: property.name, demo: false },
  };
  // Bills of this type that already exist: a month that has one can only be edited, not generated again
  const old = await prisma.residentBill.findMany({ where: { allocationId: a.id, type }, select: { id: true, period: true, amount: true, taxPct: true, note: true, paid: true }, take: 120 });
  const existing = old.map((o) => {
    const m = /^([\d.]+) (?:units|kL) × ₹([\d,.]+)$/.exec(o.note ?? "");
    return { id: o.id, period: o.period, paid: o.paid, taxPct: o.taxPct, units: m ? m[1] : "", rate: m ? m[2].replace(/,/g, "") : "" };
  });
  const draft: DraftBill = { allocationId: a.id, type, category, initialPeriod, minPeriod, maxPeriod, existing };

  return (
    <div className="tw min-h-screen bg-cream/60 text-foreground">
      <main className="px-4 py-8 md:py-12 print:p-0"><InvoiceView invoice={invoice} draft={draft} /></main>
    </div>
  );
}
