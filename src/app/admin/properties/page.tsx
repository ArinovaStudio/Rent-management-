import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import { propertiesBase } from "@/lib/routes";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Apartment", FLAT: "Flat" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Live", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;

const pill = "rounded-full bg-cream px-4 py-2 text-sm hover:bg-cream/70";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const isManager = me.role === "PROPERTY_MANAGER";
  if (!isManager && !canManageProperties(me.role, await getVerificationStatus(me.id))) redirect("/dashboard");

  const { saved } = await searchParams;
  const properties = await prisma.property.findMany({
    where: me.role === "SUPER_ADMIN" ? {} : isManager ? { managers: { some: { managerId: me.id } } } : { ownerId: me.id },
    include: {
      rooms: {
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
      owner: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const base = propertiesBase(me.role);
  const name = (me as unknown as { name?: string }).name ?? "Account";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader
        title="Properties"
        sub={isManager ? "Properties you manage." : "Manage your listings, rooms and tenants."}
        action={
          !isManager && (
            <Link href={`${base}/new`} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink">
              <Plus className="h-4 w-4" />Add property
            </Link>
          )
        }
      />

      {saved === "pending" && <p className="mb-6 rounded-2xl bg-primary/10 px-5 py-3 text-sm text-primary">Saved. It will go live once the Super Admin approves it.</p>}
      {saved === "live" && <p className="mb-6 rounded-2xl bg-primary/10 px-5 py-3 text-sm text-primary">Saved.</p>}

      {properties.length === 0 ? (
        <Panel><p className="text-muted-foreground">No properties yet.</p></Panel>
      ) : (
        <div className="space-y-4">
          {properties.map((p) => {
            const cap = p.rooms.reduce((s, r) => s + r.capacity, 0);
            const occ = p.rooms.reduce((s, r) => s + r.allocations.length, 0);
            const pct = cap ? Math.min(100, Math.round((occ / cap) * 100)) : 0;
            return (
              <Panel key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{p.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {TYPE_LABEL[p.type]}{p.sharing && p.type !== "PG" ? " (sharing)" : ""} · {p.city}
                      {me.role === "SUPER_ADMIN" && ` · Owner: ${p.owner.name}`}
                    </p>
                  </div>
                  <Chip tone={toneFor(p.status)}>{STATUS_LABEL[p.status]}</Chip>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Occupancy {occ}/{cap}</span>
                    <span className="text-muted-foreground">{occ >= cap ? "No rooms available" : `${cap - occ} available`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-cream">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {p.status === "REJECTED" && p.reviewNote && (
                  <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Rejected: {p.reviewNote}</p>
                )}
                {p.status === "NEEDS_MORE_INFO" && p.reviewNote && (
                  <p className="mt-4 rounded-2xl bg-cream px-4 py-3 text-sm">More information needed: {p.reviewNote}</p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {!isManager && <Link className={pill} href={`${base}/${p.id}/edit`}>Edit</Link>}
                  {!isManager && <Link className={pill} href={`${base}/${p.id}/managers`}>Managers</Link>}
                  <Link className={pill} href={`${base}/${p.id}/rooms`}>Room status & allocations</Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}