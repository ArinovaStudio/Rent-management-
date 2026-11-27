import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { propertiesBase, propertyHome } from "@/lib/routes";
import { AdminShell, Panel } from "@/components/admin/AdminShell";
import { monthLabel } from "@/lib/bills";
import { withTax } from "@/lib/invoice";
import LedgerTable, { type LedgerRow } from "./ledger-table";

const periodOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shift = (period: string, by: number) => periodOf(new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1 + by, 1));

export default async function PaymentLedgerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const period = sp.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.period) ? sp.period : periodOf(new Date());

  // Auth check is a tiny property row; ledger rows come from allocations directly (skips empty rooms).
  const [property, allocations] = await Promise.all([
    prisma.property.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true } }),
    prisma.allocation.findMany({
      where: { status: "ACTIVE", isHousemate: false, monthlyRent: { gt: 0 }, room: { propertyId: id } },
      select: {
        id: true, fullName: true, phone: true, email: true, monthlyRent: true, floorNumber: true, roomLabel: true,
        room: { select: { floor: true, label: true } },
        rentPayments: { where: { period }, select: { paid: true, paidAt: true, updatedAt: true }, take: 1 },
        bills: {
          orderBy: { period: "desc" },
          select: { id: true, type: true, period: true, amount: true, taxPct: true, paid: true, paidAt: true, updatedAt: true, note: true },
        },
      },
    }),
  ]);
  if (!property || !(await canOperateProperty(me, property))) notFound();

  const rows: LedgerRow[] = allocations
    .slice()
    .sort((a, b) => (a.room.floor ?? 0) - (b.room.floor ?? 0) || a.room.label.localeCompare(b.room.label, undefined, { numeric: true }))
    .map((a) => {
      const pay = a.rentPayments[0];
      return {
        id: a.id, name: a.fullName, phone: a.phone, email: a.email,
        floor: a.floorNumber ?? a.room.floor ?? 0, flat: a.roomLabel ?? a.room.label,
        rent: a.monthlyRent, rentPaid: !!pay?.paid, rentPaidOn: pay?.paid ? (pay.paidAt ?? pay.updatedAt).toLocaleDateString("en-IN") : null,
        bills: a.bills.map((b) => ({ id: b.id, type: b.type, period: b.period, amount: withTax(b.amount, b.taxPct), paid: b.paid, paidOn: b.paid ? (b.paidAt ?? b.updatedAt).toLocaleDateString("en-IN") : null, note: b.note })),
      };
    });
  const floors = [...new Set(rows.map((r) => r.floor))].sort((a, b) => a - b);
  const base = `${propertiesBase(me.role)}/${property.id}/ledger`;
  const navBtn = "flex h-10 w-10 items-center justify-center rounded-full bg-background hover:bg-cream";

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertyHome(me.role, property.id)} aria-label="Back" className={navBtn}><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Payment ledger · who has paid rent and bills</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${base}?period=${shift(period, -1)}`} aria-label="Previous month" className={navBtn}><ChevronLeft className="h-5 w-5" /></Link>
          <span className="min-w-28 text-center font-medium">{monthLabel(period)}</span>
          <Link href={`${base}?period=${shift(period, 1)}`} aria-label="Next month" className={navBtn}><ChevronRight className="h-5 w-5" /></Link>
        </div>
      </div>
      <Panel>
        <LedgerTable floors={floors} rows={rows} period={period} />
      </Panel>
    </AdminShell>
  );
}
