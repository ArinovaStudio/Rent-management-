import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDate, inr, nextRentDue } from "@/lib/bills";

export default async function RentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await prisma.allocation.findUnique({
    where: { accessToken: token },
    include: { room: { include: { property: true } } },
  });
  if (!a) notFound();
  const property = a.room.property;

  return (
    <main className="wide">
      <p><a href={`/resident/${token}`}>← Back to your details</a></p>
      <h1>Rent</h1>

      <section className="card">
        <div className="bill-head"><strong>{inr(a.monthlyRent)} / month</strong></div>
        <div className="bill-grid">
          <div><span className="hint">Next due date</span><div>{fmtDate(nextRentDue(a.moveInDate))}</div></div>
          <div><span className="hint">Last payment</span><div>Not recorded yet</div></div>
          <div><span className="hint">Security deposit</span><div>{inr(a.securityDeposit)}</div></div>
          <div><span className="hint">Move-in date</span><div>{fmtDate(a.moveInDate)}</div></div>
        </div>
      </section>

      <section className="card">
        <strong>Rented property</strong>
        <div>{property.name} · {a.room.label}</div>
        <div>{property.address}, {property.city}</div>
      </section>

      <section className="card">
        <strong>Payment</strong>
        <p className="hint">Online rent payment will be available here soon.</p>
      </section>
    </main>
  );
}