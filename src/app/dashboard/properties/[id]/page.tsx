import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { occupancy } from "@/lib/occupancy";
import { amenityCharges } from "@/lib/amenity-charges";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";
import ActiveToggle from "@/components/admin/ActiveToggle";
import DeletePropertyButton from "@/components/admin/DeletePropertyButton";
import RaiseIssue from "@/app/dashboard/issues/raise-issue";
import { propertiesBase } from "@/lib/routes";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Live", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const btn = "rounded-full bg-background px-5 py-2.5 text-sm font-medium shadow-sm ring-1 ring-black/10 transition-colors hover:bg-primary hover:text-primary-foreground hover:ring-primary";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-row gap-y-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xs font-medium">{children}</dd></div>;
}

// The property's main page, same layout for every role: every detail, and the actions that role may use.
export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const isSuper = me.role === "SUPER_ADMIN";
  const isManager = me.role === "PROPERTY_MANAGER";

  const { id } = await params;
  // Only the fields this page renders — no full room/allocation rows, only active-allocation counts.
  const p = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, type: true, address: true, city: true, mapUrl: true,
      bedrooms: true, bathrooms: true, areaSqft: true, floors: true, sharing: true, yearBuilt: true,
      amenities: true, amenityCharges: true, status: true, reviewNote: true, isActive: true, inactiveNote: true, createdAt: true,
      ownerId: true, owner: { select: { name: true, email: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, path: true } },
      managers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, managerId: true, manager: { select: { name: true, email: true } } },
      },
      coOwners: { select: { userId: true, user: { select: { name: true, email: true } } } },
      rooms: {
        orderBy: { createdAt: "asc" },
        select: {
          floor: true, rent: true, isActive: true, capacity: true, roomType: true,
          _count: { select: { allocations: { where: { status: "ACTIVE" } } } },
        },
      },
    },
  });
  if (!p) notFound();
  // Super Admin: any property. Manager: ones they manage. Property Admin: ones they own or co-own.
  const isOwner = p.ownerId === me.id;
  const isCoOwner = !isSuper && !isManager && !isOwner && p.coOwners.some((c) => c.userId === me.id);
  if (!isSuper && !(isManager && p.managers.some((m) => m.managerId === me.id)) && !isOwner && !isCoOwner) notFound();
  const canEdit = isSuper || isOwner;

  // A manager raises issues with the owners: only they need room and resident rows.
  const issueRooms = isManager
    ? await prisma.room.findMany({
        where: { propertyId: p.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true, floor: true, allocations: { where: { status: "ACTIVE" }, select: { id: true, fullName: true } } },
      })
    : [];

  const listBase = propertiesBase(me.role);
  const base = `${listBase}/${p.id}`;
  const roomsForOcc = p.rooms.map((r) => ({
    capacity: r.capacity,
    roomType: r.roomType,
    activeCount: r._count.allocations,
  }));
  const { cap, occ, full, wholeUnit, unlimited } = occupancy(p, roomsForOcc);
  const pct = cap ? Math.min(100, Math.round((occ / cap) * 100)) : 0;
  const priced = new Map(amenityCharges(p).list.map((x) => [x.name, x.charge]));
  const typeText = `${TYPE_LABEL[p.type]}${p.sharing && p.type !== "PG" && p.type !== "BUILDING" ? " (sharing)" : ""}`;
  const occText = wholeUnit
    ? (unlimited ? `${occ} ${occ === 1 ? "person" : "people"} living here` : `${occ}/${cap} people living here`)
    : (p.type === "BUILDING" ? `${occ}/${cap} flats rented` : `${occ}/${cap} beds filled`);

  // One line per floor
  const floorNos = [...new Set(p.rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b);
  const floorRows = floorNos.map((fl) => {
    const rs = p.rooms.filter((r) => (r.floor ?? 0) === fl);
    const rents = rs.map((r) => r.rent).filter((n) => n > 0);
    return {
      fl, count: rs.length, on: rs.filter((r) => r.isActive).length, living: rs.reduce((s, r) => s + r._count.allocations, 0),
      rent: rents.length ? (Math.min(...rents) === Math.max(...rents) ? inr(rents[0]) : `${inr(Math.min(...rents))} – ${inr(Math.max(...rents))}`) : "—",
    };
  });

  return (
    <AdminShell role={me.role} name={(me as unknown as { name?: string }).name ?? "Account"}>
      <Link href={listBase} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All properties</Link>
      <PageHeader title={p.name} sub={<span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{typeText} · {p.address}, {p.city}</span>} action={isCoOwner ? undefined : <ActiveToggle propertyId={p.id} active={p.isActive} />} />

      {/* Every action */}
      <div className="mb-6 flex flex-wrap gap-2">
        {isCoOwner ? (
          <Link className={btn} href={`${base}/co-owner-documents`}>Submit co-owner proof documents</Link>
        ) : (
          <>
            <Link className={btn} href={`${base}/rooms`}>Room status &amp; allocations</Link>
            <Link className={btn} href={`${base}/ledger`}>Payment ledger</Link>
          </>
        )}
        {canEdit && <Link className={btn} href={`${base}/edit`}>Edit</Link>}
        {canEdit && <Link className={btn} href={`${base}/managers`}>Managers</Link>}
        {p.mapUrl && <a className={btn} href={p.mapUrl} target="_blank" rel="noreferrer">View on map</a>}
        {isManager && (
          <RaiseIssue
            propertyId={p.id}
            properties={[{
              id: p.id,
              name: p.name,
              recipients: [{ id: p.ownerId, name: p.owner.name, label: "Main owner" }, ...p.coOwners.map((c) => ({ id: c.userId, name: c.user.name, label: "Co-owner" }))],
              rooms: issueRooms.map((r) => ({ id: r.id, label: r.label, floor: r.floor ?? null, residents: r.allocations.map((a) => ({ id: a.id, name: a.fullName })) })),
            }]}
          />
        )}
        {canEdit && <DeletePropertyButton propertyId={p.id} propertyName={p.name} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-6">
          <Panel>
            {p.images.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {p.images.map((i, n) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i.id} src={`/api/uploads/${i.path}`} alt="" loading={n === 0 ? "eager" : "lazy"} decoding="async" className={`w-full rounded-2xl object-cover ${n === 0 ? "h-64 sm:col-span-3" : "h-32"}`} />
                ))}
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-2xl bg-cream text-muted-foreground"><Building2 className="h-12 w-12" /></div>
            )}
            {p.description && <p className="mt-5 whitespace-pre-wrap text-sm">{p.description}</p>}
          </Panel>

          {floorRows.length > 0 && (
            <Panel>
              <h2 className="mb-4 text-xl font-semibold">Floors</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="pb-2 font-normal">Floor</th><th className="pb-2 font-normal">{p.type === "BUILDING" ? "Flats" : "Rooms"}</th><th className="pb-2 font-normal">Switched On</th><th className="pb-2 font-normal">Living</th><th className="pb-2 font-normal">Rent / month</th></tr></thead>
                  <tbody>
                    {floorRows.map((f) => (
                      <tr key={f.fl} className="border-t border-cream"><td className="py-2">Floor {f.fl}</td><td>{f.count}</td><td>{f.on}/{f.count}</td><td>{f.living}</td><td>{f.rent}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {p.amenities.length > 0 && (
            <Panel>
              <h2 className="mb-4 text-xl font-semibold">Amenities</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {p.amenities.map((a) => <span key={a} className="rounded-full bg-cream px-3 py-1">{a} · {priced.has(a) ? `${inr(priced.get(a)!)}/mo` : "Included"}</span>)}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel>
            <div className="mb-4 flex flex-wrap gap-2">
              <Chip tone={toneFor(p.status)}>{STATUS_LABEL[p.status]}</Chip>
              {!p.isActive && <Chip tone="bad">Inactive</Chip>}
            </div>
            {!p.isActive && p.inactiveNote && <p className="mb-4 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{p.inactiveNote}</p>}
            {p.reviewNote && <p className="mb-4 rounded-2xl bg-cream px-4 py-2 text-sm">Review note: {p.reviewNote}</p>}
            <div className="mb-1 flex justify-between gap-2 text-sm"><span>{occText}</span><span className="text-muted-foreground">{full ? "Full" : ""}</span></div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
            <dl className="grid grid-cols-2 gap-x-2 gap-y-3">
              <Fact label="Owner">{p.owner.name}</Fact>
              {!isManager && <Fact label="Email"><span className="break-all">{p.owner.email}</span></Fact>}
              <Fact label="Floors">{p.floors ?? "—"}</Fact>
              <Fact label="Rooms / units">{p.rooms.length}</Fact>
              {p.areaSqft != null && <Fact label="Area">{p.areaSqft.toLocaleString("en-IN")} sq ft</Fact>}
              {p.bedrooms != null && <Fact label="Bedrooms">{p.bedrooms}</Fact>}
              {p.bathrooms != null && <Fact label="Bathrooms">{p.bathrooms}</Fact>}
              {p.yearBuilt != null && <Fact label="Built">{p.yearBuilt}</Fact>}
              <Fact label="Added">{p.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Fact>
            </dl>
          </Panel>

          {!isManager && (
            <Panel>
              <h2 className="mb-4 text-xl font-semibold">Team</h2>
              <div className="space-y-5">
                {([["Managers", p.managers.map((m) => ({ id: m.id, ...m.manager })), "No managers assigned."], ["Co-owners", p.coOwners.map((c) => ({ id: c.userId, ...c.user })), "No co-owners."]] as const).map(([title, people, empty]) => (
                  <section key={title}>
                    <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">{title}<span className="rounded-full bg-cream px-2 py-0.5 text-xs font-normal text-muted-foreground">{people.length}</span></h3>
                    {people.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
                      <ul className="space-y-2">
                        {people.map((u) => (
                          <li key={u.id} className="flex items-center gap-3 rounded-2xl bg-cream/60 px-3 py-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium text-primary">{u.name.slice(0, 1).toUpperCase()}</span>
                            <span className="min-w-0"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-xs text-muted-foreground">{u.email}</span></span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </AdminShell>
  );
}