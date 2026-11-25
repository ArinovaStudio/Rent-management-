import { notFound } from "next/navigation";
import { Building2, CalendarDays, FileText, Home, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";
import { BILL_LABEL, billDueDate, fmtDate, inr, monthLabel, rentDueDate, rentPeriod } from "@/lib/bills";
import { RENT_TAX_KEY, taxRatesOf, withTax } from "@/lib/invoice";
import ResidentView, { type BillItem, type HistoryItem } from "./resident-view";

const card = "rounded-[1.75rem] bg-background p-5 md:p-6";

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
      bills: { orderBy: [{ period: "desc" }, { createdAt: "desc" }] },
      rentPayments: { orderBy: { period: "desc" } },
    },
  });
  if (!resident) notFound();

  const property = resident.room.property;
  const category = resident.roomCategory ?? roomCategoryLabel(property, resident.room);
  const floor = resident.floorNumber ?? roomFloor(property, resident.room);
  const flat = resident.roomLabel ?? resident.room.label;
  const active = resident.status === "ACTIVE";
  const initials = resident.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  // ---- Rent: this calendar month, plus every earlier month that was paid ----
  const period = rentPeriod();
  const thisMonth = resident.rentPayments.find((p) => p.period === period);
  const paidOn = (d: Date | null, fb: Date) => fmtDate(d ?? fb);
  // Amounts shown here include tax, the same as on the invoice
  const rentTax = thisMonth?.paid ? thisMonth.taxPct : taxRatesOf(resident.taxRates)[RENT_TAX_KEY] ?? 0;
  const rent = {
    covered: resident.monthlyRent === 0,
    label: monthLabel(period),
    amount: withTax(thisMonth?.amount ?? resident.monthlyRent, rentTax),
    paid: !!thisMonth?.paid,
    paidOn: thisMonth?.paid ? paidOn(thisMonth.paidAt, thisMonth.updatedAt) : null,
    dueDate: fmtDate(rentDueDate(resident.moveInDate, period)),
    past: resident.rentPayments.filter((p) => p.paid && p.period !== period).map((p) => ({ period: p.period, label: monthLabel(p.period), amount: withTax(p.amount, p.taxPct), paidOn: paidOn(p.paidAt, p.updatedAt) })),
  };

  // ---- Bills: newest first per type; the first is the current bill, the rest are history ----
  const toItem = (b: (typeof resident.bills)[number]): BillItem => ({
    id: b.id, period: b.period, label: monthLabel(b.period), amount: withTax(b.amount, b.taxPct), note: b.note, paid: b.paid,
    paidOn: b.paid ? paidOn(b.paidAt, b.updatedAt) : null, dueDate: fmtDate(billDueDate(b.period)),
  });
  const bills = {
    ELECTRICITY: resident.bills.filter((b) => b.type === "ELECTRICITY").map(toItem),
    WATER: resident.bills.filter((b) => b.type === "WATER").map(toItem),
  };

  // ---- Payment history: all paid rent months and paid bills together ----
  const history: HistoryItem[] = [
    ...resident.rentPayments.filter((p) => p.paid && !rent.covered).map((p) => ({
      key: `r-${p.id}`, sort: (p.paidAt ?? p.updatedAt).getTime(), kind: "Rent", label: monthLabel(p.period), amount: withTax(p.amount, p.taxPct),
      paidOn: paidOn(p.paidAt, p.updatedAt), href: `/resident/${token}/rent?period=${p.period}`,
    })),
    ...resident.bills.filter((b) => b.paid).map((b) => ({
      key: `b-${b.id}`, sort: (b.paidAt ?? b.updatedAt).getTime(), kind: `${BILL_LABEL[b.type]} bill`, label: monthLabel(b.period), amount: withTax(b.amount, b.taxPct),
      paidOn: paidOn(b.paidAt, b.updatedAt), href: `/resident/${token}/bill/${b.id}`,
    })),
  ].sort((x, y) => y.sort - x.sort);

  return (
    <div className="tw min-h-screen bg-cream/60 text-foreground">
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:py-12">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">R</span>
          <div>
            <p className="text-lg font-medium tracking-tight">Rental <span className="text-muted-foreground">Portal</span></p>
            <p className="text-xs text-muted-foreground">Resident details</p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
          {/* Left: who you are */}
          <aside className="space-y-5 lg:sticky lg:top-6">
            <section className={card}>
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">{initials || "R"}</span>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-medium tracking-tight">{resident.fullName}</h1>
                  <p className="truncate text-sm text-muted-foreground">{property.name} · {flat}</p>
                </div>
              </div>
              <span className={`mt-4 inline-block rounded-full px-3 py-1 text-xs ${active ? "bg-primary/10 text-primary" : "bg-cream text-muted-foreground"}`}>{active ? "Active resident" : "Checked out"}</span>
              <div className="mt-4 grid gap-3">
                <Info icon={Home} label="Room category" value={`${category}${floor != null ? ` · Floor ${floor}` : ""}`} />
                <Info icon={MapPin} label="Address" value={`${property.address}, ${property.city}`} />
                <Info icon={Phone} label="Phone" value={resident.phone} />
                {resident.email && <Info icon={Mail} label="Email" value={resident.email} />}
                <Info icon={CalendarDays} label="Move-in date" value={resident.moveInDate.toLocaleDateString("en-IN")} />
                <Info icon={ShieldCheck} label="Security deposit" value={inr(resident.securityDeposit)} />
              </div>
            </section>

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
          </aside>

          {/* Right: money */}
          <ResidentView token={token} rent={rent} bills={bills} history={history} />
        </div>

        <p className="mt-8 px-2 text-center text-xs text-muted-foreground">This private link is meant only for you. Please don&apos;t share it publicly.</p>
      </main>
    </div>
  );
}
