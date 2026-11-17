import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BILL_LABEL, billDueDate, fmtDate, monthLabel } from "@/lib/bills";
import { BILL_TERMS, PAYEE } from "@/lib/payment";
import InvoiceView from "@/components/resident/InvoiceView";

export default async function BillPage({ params }: { params: Promise<{ token: string; billId: string }> }) {
  const { token, billId } = await params;
  const bill = await prisma.residentBill.findFirst({
    where: { id: billId, allocation: { accessToken: token } },
    include: { allocation: { include: { room: { include: { property: true } } } } },
  });
  if (!bill) notFound();
  const a = bill.allocation;
  const property = a.room.property;
  const propertyAddress = `${property.address}, ${property.city}`;

  return (
    <InvoiceView
      data={{
        backHref: `/resident/${token}`,
        invoiceNo: `${bill.type.slice(0, 4)}-${bill.period.replace("-", "")}-${bill.id.slice(-4).toUpperCase()}`,
        issueDate: fmtDate(new Date()),
        dueDate: fmtDate(billDueDate(bill.period)),
        paid: bill.paid,
        paidOn: bill.paid ? fmtDate(bill.paidAt ?? bill.updatedAt) : undefined,
        from: { name: property.name, address: propertyAddress },
        to: { name: a.fullName, address: `${a.room.label}, ${propertyAddress}`, phone: a.phone },
        items: [{ title: `${BILL_LABEL[bill.type]} bill`, description: monthLabel(bill.period), rate: bill.amount, taxPct: 0 }],
        note: bill.note,
        terms: BILL_TERMS,
        payee: PAYEE,
      }}
    />
  );
}
