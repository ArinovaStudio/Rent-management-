import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { BILL_LABEL, billDueDate, fmtDate, inr, monthLabel, nextRentDue } from "@/lib/bills";

export default async function ResidentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const resident = await prisma.allocation.findUnique({
    where: { accessToken: token },
    include: {
      room: { include: { property: true } },
      documents: { orderBy: { createdAt: "desc" } },
      bills: { orderBy: { period: "desc" } },
    },
  });
  if (!resident) notFound();

  const property = resident.room.property;
  const category = resident.roomCategory ?? roomCategoryLabel(property, resident.room);
  const floor = resident.floorNumber ?? roomFloor(property, resident.room);

  return (
    <main className="wide">
      <h1>Resident details</h1>

      <section className="card">
        <strong>{resident.fullName}</strong>
        <div>{property.name} · {resident.room.label}</div>
        <div>Room category: {category}{floor != null ? ` · Floor ${floor}` : ""}</div>
        <div>{property.address}, {property.city}</div>
        <div>Phone: {resident.phone}</div>
        {resident.email && <div>Email: {resident.email}</div>}
        <div>Move-in date: {resident.moveInDate.toLocaleDateString("en-IN")}</div>
        <div>Monthly rent: {inr(resident.monthlyRent)}</div>
        <div>Security deposit: {inr(resident.securityDeposit)}</div>
        <div>Status: {resident.status === "ACTIVE" ? "Active resident" : "Checked out"}</div>
      </section>

      <h2>Rent</h2>
      <section className="card">
        <div className="bill-head"><strong>Monthly rent</strong><span>{inr(resident.monthlyRent)}</span></div>
        <div className="bill-grid">
          <div><span className="hint">Next due date</span><div>{fmtDate(nextRentDue(resident.moveInDate))}</div></div>
          <div><span className="hint">Last payment</span><div>Not recorded yet</div></div>
        </div>
        <div className="bill-actions"><a className="bill-btn" href={`/resident/${token}/rent`}>Pay rent</a></div>
      </section>

      {(["ELECTRICITY", "WATER"] as const).map((t) => {
        const list = resident.bills.filter((b) => b.type === t);
        const last = list[0];
        const payTarget = list.find((b) => !b.paid);
        const lastPaid = list.find((b) => b.paid);
        const totalDue = list.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
        return (
          <div key={t}>
            <h2>{BILL_LABEL[t]}</h2>
            <section className="card">
              {!last ? (
                <p className="hint">No {BILL_LABEL[t].toLowerCase()} bills have been added yet.</p>
              ) : (
                <>
                  <div className="bill-head">
                    <strong>{monthLabel(last.period)} · {inr(last.amount)}</strong>
                    <span className={payTarget ? "bill-due" : "bill-paid"}>{payTarget ? "Due" : "All paid"}</span>
                  </div>
                  <div className="bill-grid">
                    <div><span className="hint">Due date</span><div>{fmtDate(billDueDate((payTarget ?? last).period))}</div></div>
                    <div><span className="hint">Last payment</span><div>{lastPaid ? fmtDate(lastPaid.paidAt ?? lastPaid.updatedAt) : "—"}</div></div>
                    <div><span className="hint">Total due</span><div>{inr(totalDue)}</div></div>
                  </div>
                  {last.note && <div className="hint">{last.note}</div>}
                  <div className="bill-actions">
                    <a className="bill-btn secondary" href={`/resident/${token}/bill/${last.id}`}>View last bill</a>
                    {payTarget && <a className="bill-btn" href={`/resident/${token}/bill/${payTarget.id}`}>Pay bill</a>}
                  </div>
                  <details>
                    <summary>View all bills ({list.length})</summary>
                    <table>
                      <thead><tr><th>Month</th><th>Amount</th><th>Status</th><th>Paid on</th><th></th></tr></thead>
                      <tbody>
                        {list.map((b) => (
                          <tr key={b.id}>
                            <td>{monthLabel(b.period)}</td>
                            <td>{inr(b.amount)}</td>
                            <td>{b.paid ? "Paid" : "Due"}</td>
                            <td>{b.paid ? fmtDate(b.paidAt ?? b.updatedAt) : "—"}</td>
                            <td><a href={`/resident/${token}/bill/${b.id}`}>View</a></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              )}
            </section>
          </div>
        );
      })}

      <h2>Your documents</h2>
      {resident.documents.length === 0 ? (
        <p className="muted">No documents have been uploaded.</p>
      ) : (
        <ul>
          {resident.documents.map((doc) => (
            <li key={doc.id}>
              <a href={`/api/resident/${token}/documents/${doc.id}`} target="_blank" rel="noreferrer">{doc.name}</a>
            </li>
          ))}
        </ul>
      )}

      <p className="muted">This private link is intended only for you. Avoid sharing it publicly.</p>
    </main>
  );
}
