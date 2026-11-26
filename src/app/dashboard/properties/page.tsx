import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { occupancy } from "@/lib/occupancy";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import { propertiesBase } from "@/lib/routes";
import { amenityCharges } from "@/lib/amenity-charges";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";
import RaiseIssue from "../issues/raise-issue";
import ActiveToggle from "@/components/admin/ActiveToggle";
import DeletePropertyButton from "@/components/admin/DeletePropertyButton";
import PropertyFilterBar from "@/components/admin/PropertyFilterBar";
import { ACTIVE_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, applyPropertyFilters, hasFilters } from "@/lib/property-filter";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;

const pill = "rounded-full bg-background px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-black/15 transition-colors hover:bg-primary hover:text-primary-foreground hover:ring-primary";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ saved?: string; q?: string; status?: string; type?: string; active?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const isManager = me.role === "PROPERTY_MANAGER";
  // Super Admin / managers never need the verification row; only Property Admins do.
  const canManage =
    isManager || me.role === "SUPER_ADMIN" || canManageProperties(me.role, await getVerificationStatus(me.id));

  const { saved, q, status, type, active } = await searchParams;
  const where =
    me.role === "SUPER_ADMIN" ? {} : isManager ? { managers: { some: { managerId: me.id } } } : { OR: [{ ownerId: me.id }, { coOwners: { some: { userId: me.id } } }] };
  const listFields = {
    id: true, name: true, type: true, city: true, sharing: true, status: true, isActive: true,
    inactiveNote: true, reviewNote: true, mapUrl: true, amenities: true, amenityCharges: true, ownerId: true,
    owner: { select: { name: true } },
    coOwners: { select: { userId: true, user: { select: { name: true } } } },
  } as const;

  // Managers need room/resident rows for RaiseIssue; everyone else only needs an active-allocation count.
  const raw = isManager
    ? await prisma.property.findMany({
        where,
        select: {
          ...listFields,
          rooms: {
            select: {
              id: true, label: true, floor: true, capacity: true, roomType: true,
              allocations: { where: { status: "ACTIVE" }, select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.property.findMany({
        where,
        select: {
          ...listFields,
          rooms: {
            select: {
              capacity: true, roomType: true,
              _count: { select: { allocations: { where: { status: "ACTIVE" } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

  const allProperties = raw.map((p) => ({
    ...p,
    rooms: p.rooms.map((r) =>
      "allocations" in r
        ? {
            capacity: r.capacity,
            roomType: r.roomType,
            activeCount: r.allocations.length,
            issue: { id: r.id, label: r.label, floor: r.floor ?? null, residents: r.allocations.map((a) => ({ id: a.id, name: a.fullName })) },
          }
        : { capacity: r.capacity, roomType: r.roomType, activeCount: r._count.allocations },
    ),
  }));
  const isAssignedCoOwner = allProperties.some((p) => p.coOwners.some((co) => co.userId === me.id));
  if (!canManage && !isAssignedCoOwner) redirect("/dashboard");
  const filters = { q, status, type, active };
  const properties = applyPropertyFilters(allProperties, filters);
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

      {allProperties.length > 0 && (
        <PropertyFilterBar
          groups={[
            { key: "status", label: "Status", options: STATUS_OPTIONS },
            { key: "type", label: "Property type", options: TYPE_OPTIONS },
            { key: "active", label: "Active / Inactive", options: ACTIVE_OPTIONS },
          ]}
        />
      )}

      {properties.length === 0 ? (
        <Panel><p className="text-muted-foreground">{allProperties.length > 0 && hasFilters(filters) ? "No properties match your search or filters." : "No properties yet."}</p></Panel>
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
                  <div className="flex items-center gap-3">
                    {!isCoOwner && <ActiveToggle propertyId={p.id} active={p.isActive} />}
                    <Chip tone={toneFor(p.status)}>{STATUS_LABEL[p.status]}</Chip>
                  </div>
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
                  {isManager && (
                    <RaiseIssue
                      propertyId={p.id}
                      properties={[{
                        id: p.id,
                        name: p.name,
                        recipients: [{ id: p.ownerId, name: p.owner.name, label: "Main owner" }, ...p.coOwners.map((c) => ({ id: c.userId, name: c.user.name, label: "Co-owner" }))],
                        rooms: p.rooms.flatMap((r) => ("issue" in r && r.issue ? [r.issue] : [])),
                      }]}
                    />
                  )}
                  {!isManager && !isCoOwner && <Link className={pill} href={`${base}/${p.id}/edit`}>Edit</Link>}
                  {!isManager && !isCoOwner && <Link className={pill} href={`${base}/${p.id}/managers`}>Managers</Link>}
                  {isCoOwner
                    ? <Link className={pill} href={`${base}/${p.id}/co-owner-documents`}>Submit co-owner proof documents</Link>
                    : <Link className={pill} href={`${base}/${p.id}/rooms`}>Room status & allocations</Link>}
                  {!isCoOwner && <Link className={pill} href={`${base}/${p.id}/ledger`}>Payment ledger</Link>}
                  {!isManager && !isCoOwner && <DeletePropertyButton propertyId={p.id} propertyName={p.name} />}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
