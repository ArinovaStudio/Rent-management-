import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { occupancy } from "@/lib/occupancy";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import { propertiesBase } from "@/lib/routes";
import { amenityCharges } from "@/lib/amenity-charges";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Live", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;

const pill = "rounded-full bg-cream px-4 py-2 text-sm hover:bg-cream/70";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const isManager = me.role === "PROPERTY_MANAGER";
  const canManage = isManager || canManageProperties(me.role, await getVerificationStatus(me.id));

  const { saved } = await searchParams;
  const properties = await prisma.property.findMany({
    where: me.role === "SUPER_ADMIN" ? {} : isManager ? { managers: { some: { managerId: me.id } } } : { OR: [{ ownerId: me.id }, { coOwners: { some: { userId: me.id } } }] },
    include: {
      rooms: {
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            select: { id: true, occupants: true },
          },
        },
      },
      owner: { select: { name: true } },
      coOwners: { select: { userId: true, user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const isAssignedCoOwner = properties.some((p) => p.coOwners.some((co) => co.userId === me.id));
  if (!canManage && !isAssignedCoOwner) redirect("/dashboard");
  const base = propertiesBase(me.role);
  const name = (me as unknown as { name?: string }).name ?? "Account";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader
        title="Properties"
        sub={isManager ? "Properties you manage." : "Manage your listings, rooms and tenants."}
        action={
          !isManager && canManage && (
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
            const isCoOwner = p.coOwners.some((co) => co.userId === me.id) && p.ownerId !== me.id;
            const { cap, occ, full, wholeUnit, unlimited } = occupancy(p, p.rooms);
            const priced = new Map(amenityCharges(p).list.map((x) => [x.name, x.charge]));
            const pct = cap ? Math.min(100, Math.round((occ / cap) * 100)) : 0;
            return (
              <Panel key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{p.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {TYPE_LABEL[p.type]}{p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""} · {p.city}
                      {me.role === "SUPER_ADMIN" && ` · Owner: ${p.owner.name}`}
                      {isCoOwner && " · Co-owner access"}
                    </p>
                  </div>
                  <Chip tone={toneFor(p.status)}>{STATUS_LABEL[p.status]}</Chip>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{wholeUnit ? (unlimited ? `${occ} ${occ === 1 ? "person" : "people"} living here` : `${occ}/${cap} people living here`) : (p.type === "BUILDING" ? `${occ}/${cap} flats rented` : `Occupancy ${occ}/${cap}`)}</span>
                    <span className="text-muted-foreground">{wholeUnit ? (occ === 0 ? "Vacant" : full ? "Full" : "Rented") : full ? "No rooms available" : `${cap - occ} available`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-cream">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {p.amenities.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {p.amenities.map((a) => (
                      <span key={a} className="rounded-full bg-cream px-3 py-1">{a} · {priced.has(a) ? `₹${priced.get(a)!.toLocaleString("en-IN")}/mo` : "Included"}</span>
                    ))}
                  </div>
                )}
                {!p.isActive && <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Inactive{p.inactiveNote ? `: ${p.inactiveNote}` : ""}</p>}

                {p.status === "REJECTED" && p.reviewNote && (
                  <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">Rejected: {p.reviewNote}</p>
                )}
                {p.status === "NEEDS_MORE_INFO" && p.reviewNote && (
                  <p className="mt-4 rounded-2xl bg-cream px-4 py-3 text-sm">More information needed: {p.reviewNote}</p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {p.mapUrl && <a className={pill} href={p.mapUrl} target="_blank" rel="noreferrer">View on map</a>}
                  {!isManager && !isCoOwner && <Link className={pill} href={`${base}/${p.id}/edit`}>Edit</Link>}
                  {!isManager && !isCoOwner && <Link className={pill} href={`${base}/${p.id}/managers`}>Managers</Link>}
                  {isCoOwner
                    ? <Link className={pill} href={`${base}/${p.id}/co-owner-documents`}>Submit co-owner proof documents</Link>
                    : <Link className={pill} href={`${base}/${p.id}/rooms`}>Room status & allocations</Link>}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
