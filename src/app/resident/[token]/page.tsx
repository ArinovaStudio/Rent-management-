import { notFound } from "next/navigation";
import { Building2, CalendarDays, FileText, Home, Mail, MapPin, Phone, ShieldCheck, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { amenityCharges } from "@/lib/amenity-charges";
import { BILL_LABEL, billDueDate, fmtDate, inr, monthLabel, nextRentDue } from "@/lib/bills";

const card = "rounded-[1.75rem] bg-background p-5 md:p-6";
const pill = "inline-flex items-center rounded-full px-5 py-2.5 text-sm";
const primaryBtn = `${pill} bg-primary text-primary-foreground hover:bg-ink`;
const softBtn = `${pill} bg-cream hover:bg-cream/70`;

function Info({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-cream/60 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

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
  const active = resident.status === "ACTIVE";
  const amenity = resident.monthlyRent > 0 ? amenityCharges(property) : { list: [], total: 0 };
  const initials = resident.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="tw min-h-screen bg-cream/60 text-foreground">
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 md:py-12">
        {/* Header */}
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">R</span>
          <div>
            <p className="text-lg font-medium tracking-tight">Rental <span className="text-muted-foreground">Portal</span></p>
            <p className="text-xs text-muted-foreground">Resident details</p>
          </div>
        </header>

        {/* Profile */}
        <section className={card}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">{initials || "R"}</span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-medium tracking-tight">{resident.fullName}</h1>
              <p className="text-sm text-muted-foreground">{property.name} · {resident.room.label}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs ${active ? "bg-primary/10 text-primary" : "bg-cream text-muted-foreground"}`}>{active ? "Active resident" : "Checked out"}</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Info icon={Home} label="Room category" value={`${category}${floor != null ? ` · Floor ${floor}` : ""}`} />
            <Info icon={MapPin} label="Address" value={`${property.address}, ${property.city}`} />
            <Info icon={Phone} label="Phone" value={resident.phone} />
            {resident.email && <Info icon={Mail} label="Email" value={resident.email} />}
            <Info icon={CalendarDays} label="Move-in date" value={resident.moveInDate.toLocaleDateString("en-IN")} />
          </div>
        </section>

        {/* Rent, amenities and deposit */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">Rent & charges</h2>
                <p className="text-sm text-muted-foreground">Next due {fmtDate(nextRentDue(resident.moveInDate))}</p>
              </div>
            </div>
            <p className="text-2xl font-medium">{inr(resident.monthlyRent + amenity.total)} <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Info icon={Wallet} label="Rent" value={inr(resident.monthlyRent)} />
            <Info icon={Building2} label="Amenities charge" value={amenity.total > 0 ? `${inr(amenity.total)} / month` : "Included"} />
            <Info icon={ShieldCheck} label="Security deposit (one-time)" value={inr(resident.securityDeposit)} />
          </div>
          {amenity.list.length > 0 && (
            <details className="mt-3 rounded-2xl bg-cream/60 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">Amenity charges ({amenity.list.length})</summary>
              <ul className="mt-3 space-y-1 text-sm">
                {amenity.list.map((x) => (
                  <li key={x.name} className="flex justify-between gap-3"><span>{x.name}</span><span>{inr(x.charge)}</span></li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4"><a className={primaryBtn} href={`/resident/${token}/rent`}>Pay rent</a></div>
        </section>

        {/* Bills */}
        {(["ELECTRICITY", "WATER"] as const).map((t) => {
          const list = resident.bills.filter((b) => b.type === t);
          const last = list[0];
          const payTarget = list.find((b) => !b.paid);
          const lastPaid = list.find((b) => b.paid);
          const totalDue = list.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
          return (
            <section key={t} className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{BILL_LABEL[t]}</h2>
                {last && <span className={`rounded-full px-3 py-1 text-xs ${payTarget ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{payTarget ? "Due" : "All paid"}</span>}
              </div>

              {!last ? (
                <p className="mt-3 text-sm text-muted-foreground">No {BILL_LABEL[t].toLowerCase()} bills have been added yet.</p>
              ) : (
                <>
                  <p className="mt-3 text-2xl font-medium">{inr(last.amount)} <span className="text-sm font-normal text-muted-foreground">· {monthLabel(last.period)}</span></p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Due date</p><p className="text-sm font-medium">{fmtDate(billDueDate((payTarget ?? last).period))}</p></div>
                    <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Last payment</p><p className="text-sm font-medium">{lastPaid ? fmtDate(lastPaid.paidAt ?? lastPaid.updatedAt) : "—"}</p></div>
                    <div className="rounded-2xl bg-cream/60 px-4 py-3"><p className="text-xs text-muted-foreground">Total due</p><p className="text-sm font-medium">{inr(totalDue)}</p></div>
                  </div>
                  {last.note && <p className="mt-3 text-sm text-muted-foreground">{last.note}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {payTarget && <a className={primaryBtn} href={`/resident/${token}/bill/${payTarget.id}`}>Pay bill</a>}
                    <a className={softBtn} href={`/resident/${token}/bill/${last.id}`}>View last bill</a>
                  </div>

                  <details className="group mt-4 rounded-2xl bg-cream/60 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium">View all bills ({list.length})</summary>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-muted-foreground">
                          <tr><th className="py-2 pr-4 font-medium">Month</th><th className="py-2 pr-4 font-medium">Amount</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 pr-4 font-medium">Paid on</th><th /></tr>
                        </thead>
                        <tbody>
                          {list.map((b) => (
                            <tr key={b.id} className="border-t border-background">
                              <td className="py-2 pr-4">{monthLabel(b.period)}</td>
                              <td className="py-2 pr-4">{inr(b.amount)}</td>
                              <td className="py-2 pr-4">{b.paid ? "Paid" : "Due"}</td>
                              <td className="py-2 pr-4">{b.paid ? fmtDate(b.paidAt ?? b.updatedAt) : "—"}</td>
                              <td className="py-2 text-right"><a className="text-primary underline" href={`/resident/${token}/bill/${b.id}`}>View</a></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
            </section>
          );
        })}

        {/* Documents */}
        <section className={card}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
            <h2 className="text-lg font-semibold">Your documents</h2>
          </div>
          {resident.documents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No documents have been uploaded.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {resident.documents.map((doc) => (
                <li key={doc.id}>
                  <a href={`/api/resident/${token}/documents/${doc.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm hover:bg-cream">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                    <span className="text-xs text-primary">Open</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="px-2 text-center text-xs text-muted-foreground">This private link is meant only for you. Please don't share it publicly.</p>
      </main>
    </div>
  );
}
