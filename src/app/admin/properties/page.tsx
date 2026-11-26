import { occupancy } from "@/lib/occupancy";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, MapPin, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import { propertiesBase } from "@/lib/routes";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";
import ActiveToggle from "@/components/admin/ActiveToggle";
import PropertyFilterBar from "@/components/admin/PropertyFilterBar";
import { ACTIVE_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS, applyPropertyFilters, hasFilters } from "@/lib/property-filter";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Super Admin card: cover photo, name, a short line, three stat tiles, then the On/Off switch and one Open button.
// Whole card opens the property page. Everything else (rooms, ledger, edit, managers, delete) lives on that page.
export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ saved?: string; q?: string; status?: string; type?: string; active?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const isManager = me.role === "PROPERTY_MANAGER";
  // Super Admin always may manage; skip the verification lookup for them.
  if (!isManager && me.role !== "SUPER_ADMIN" && !canManageProperties(me.role, await getVerificationStatus(me.id))) {
    redirect("/dashboard");
  }

  const { saved, q, status, type, active } = await searchParams;
  // Card UI only needs a few property fields + room rent/capacity and an active-allocation count.
  const allProperties = await prisma.property.findMany({
    where: me.role === "SUPER_ADMIN" ? {} : isManager ? { managers: { some: { managerId: me.id } } } : { ownerId: me.id },
    select: {
      id: true, name: true, description: true, type: true, address: true, city: true,
      sharing: true, status: true, isActive: true,
      owner: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { path: true } },
      rooms: {
        select: {
          capacity: true, roomType: true, rent: true,
          _count: { select: { allocations: { where: { status: "ACTIVE" } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const filters = { q, status, type, active };
  const properties = applyPropertyFilters(allProperties, filters);
  const base = propertiesBase(me.role);
  const name = (me as unknown as { name?: string }).name ?? "Account";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader
        title="Properties"
        sub={isManager ? "Properties you manage." : "Click a property to open it."}
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
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => {
            const roomsForOcc = p.rooms.map((r) => ({
              capacity: r.capacity,
              roomType: r.roomType,
              activeCount: r._count.allocations,
            }));
            const { cap, occ, full, wholeUnit, unlimited } = occupancy(p, roomsForOcc);
            const cover = p.images[0]?.path;
            const rents = p.rooms.map((r) => r.rent).filter((n) => n > 0);
            const rentText = rents.length ? (Math.min(...rents) === Math.max(...rents) ? inr(rents[0]) : `${inr(Math.min(...rents))}+`) : "—";
            const typeText = `${TYPE_LABEL[p.type]}${p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""}`;
            const unitWord = p.type === "BUILDING" ? "Flats" : wholeUnit ? "Unit" : "Rooms";
            const occValue = wholeUnit ? (occ === 0 ? "Vacant" : full ? "Full" : "Rented") : unlimited ? `${occ}` : `${occ}/${cap}`;

            return (
              <div key={p.id} className="group relative flex flex-col rounded-[1.75rem] bg-background p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                {/* Whole card opens the property page. Toggle and button sit above it. */}
                <Link href={`${base}/${p.id}`} aria-label={`Open ${p.name}`} className="absolute inset-0 z-0 rounded-[1.75rem]" />

                <div className="pointer-events-none relative h-44 overflow-hidden rounded-2xl bg-cream">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/uploads/${cover}`} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground"><Building2 className="h-12 w-12" /></div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <Chip tone={toneFor(p.status)}>{STATUS_LABEL[p.status]}</Chip>
                    {!p.isActive && <Chip tone="bad">Inactive</Chip>}
                  </div>
                </div>

                <div className="pointer-events-none relative mt-4 flex flex-1 flex-col">
                  <h2 className="truncate text-xl font-semibold">{p.name}</h2>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{typeText} · {p.city}</p>
                  {me.role === "SUPER_ADMIN" && <p className="truncate text-sm text-muted-foreground">Owner: {p.owner.name}</p>}
                  <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{p.description || `${p.address}, ${p.city}`}</p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-cream/70 px-2 py-2.5"><p className="text-[0.7rem] text-muted-foreground">{unitWord}</p><p className="text-base font-semibold">{p.rooms.length}</p></div>
                    <div className="rounded-xl bg-cream/70 px-2 py-2.5"><p className="text-[0.7rem] text-muted-foreground">{wholeUnit ? "Status" : "Filled"}</p><p className="text-base font-semibold">{occValue}</p></div>
                    <div className="rounded-xl bg-cream/70 px-2 py-2.5"><p className="text-[0.7rem] text-muted-foreground">Rent / mo</p><p className="truncate text-base font-semibold">{rentText}</p></div>
                  </div>
                </div>

                <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
                  <ActiveToggle propertyId={p.id} active={p.isActive} />
                  <Link href={`${base}/${p.id}`} className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-ink-foreground transition-colors hover:bg-primary">Open</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
