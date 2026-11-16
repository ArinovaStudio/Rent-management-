import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BILL_LABEL, billDueDate, fmtDate, inr, monthLabel } from "@/lib/bills";

export default async function BillPage({ params }: { params: Promise<{ token: string; billId: string }> }) {
  const { token, billId } = await params;
  const bill = await prisma.residentBill.findFirst({
    where: { id: billId, allocation: { accessToken: token } },
    include: { allocation: { include: { room: { include: { property: true } } } } },
  });
  if (!bill) notFound();
  const a = bill.allocation;
  const property = a.room.property;

  return (
    <main className="wide">
      <p><a href={`/resident/${token}`}>← Back to your details</a></p>
      <h1>{BILL_LABEL[bill.type]} bill · {monthLabel(bill.period)}</h1>

      <section className="card">
        <div className="bill-head">
          <strong>{inr(bill.amount)}</strong>
          <span className={bill.paid ? "bill-paid" : "bill-due"}>{bill.paid ? "Paid" : "Due"}</span>
        </div>
        <div className="bill-grid">
          <div><span className="hint">Bill type</span><div>{BILL_LABEL[bill.type]}</div></div>
          <div><span className="hint">Billing month</span><div>{monthLabel(bill.period)}</div></div>
          <div><span className="hint">Due date</span><div>{fmtDate(billDueDate(bill.period))}</div></div>
          <div><span className="hint">{bill.paid ? "Paid on" : "Payment status"}</span><div>{bill.paid ? fmtDate(bill.paidAt ?? bill.updatedAt) : "Not paid yet"}</div></div>
        </div>
        {bill.note && <div><span className="hint">Note</span><div>{bill.note}</div></div>}
      </section>

      <section className="card">
        <strong>Billed to</strong>
        <div>{a.fullName}</div>
        <div>{property.name} · {a.room.label}</div>
        <div>{property.address}, {property.city}</div>
      </section>

      {!bill.paid && (
        <section className="card">
          <strong>Payment</strong>
          <p className="hint">Online payment will be available here soon.</p>
        </section>
      )}
    </main>
  );
}