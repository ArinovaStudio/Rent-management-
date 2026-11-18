import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BILL_LABEL, billDueDate, fmtDate, monthLabel } from "@/lib/bills";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { BILL_TERMS, payeeFor, propertyLines, type InvoiceData } from "@/lib/invoice";
import InvoiceView from "../../invoice-view";
import { isWholeUnit } from "@/lib/occupancy";

export default async function BillPage({ params }: { params: Promise<{ token: string; billId: string }> }) {
  const { token, billId } = await params;
  const bill = await prisma.residentBill.findFirst({
    where: { id: billId, allocation: { accessToken: token } },
    include: { allocation: { include: { room: { include: { property: true } } } } },
  });
  if (!bill) notFound();
  const a = bill.allocation;
  const property = a.room.property;
  const floor = a.floorNumber ?? roomFloor(property, a.room);
  const category = a.roomCategory ?? roomCategoryLabel(property, a.room);
  const household = isWholeUnit(property)
    ? await prisma.allocation.count({ where: { roomId: a.roomId, status: "ACTIVE" } })
    : a.occupants;

  const invoice: InvoiceData = {
    invoiceNo: `${bill.type === "ELECTRICITY" ? "ELEC" : "WATR"}-${bill.period.replace("-", "")}-${bill.id.slice(-4).toUpperCase()}`,
    kind: "BILL",
    periodLabel: monthLabel(bill.period),
    status: bill.paid ? "PAID" : "DUE",
    paidOn: bill.paid ? fmtDate(bill.paidAt ?? bill.updatedAt) : null,
    from: { name: property.name, lines: propertyLines(property) },
    to: {
      name: a.fullName,
      lines: [`${a.room.label}${floor != null ? ` · Floor ${floor}` : ""}`, ...propertyLines(property)],
      phone: a.phone,
      email: a.email,
    },
    issueDate: fmtDate(new Date()),
    dueDate: fmtDate(billDueDate(bill.period)),
    items: [{
      title: `${BILL_LABEL[bill.type]} bill · ${monthLabel(bill.period)}`,
      description: [category, bill.note].filter(Boolean).join(" · "),
      rate: bill.amount,
      taxPct: 0,
    }],
    terms: BILL_TERMS,
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
