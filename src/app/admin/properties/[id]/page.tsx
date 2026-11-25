import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { occupancy } from "@/lib/occupancy";
import { amenityCharges } from "@/lib/amenity-charges";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";
import ActiveToggle from "@/components/admin/ActiveToggle";
import DeletePropertyButton from "@/components/admin/DeletePropertyButton";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Flat / Apartment", FLAT: "Flat / Apartment", BUILDING: "Building" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Live", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const btn = "rounded-full bg-background px-5 py-2.5 text-sm font-medium shadow-sm ring-1 ring-black/10 transition-colors hover:bg-primary hover:text-primary-foreground hover:ring-primary";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children}</dd></div>;
}

// The property's main page for the Super Admin: every detail, and every action in one place.
export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "SUPER_ADMIN") notFound();

  const { id } = await params;
  const p = await prisma.property.findUnique({
    where: { id },
    include: {
      rooms: { include: { allocations: { where: { status: "ACTIVE" }, select: { id: true, occupants: true } } }, orderBy: { createdAt: "asc" } },
      owner: { select: { name: true, email: true } },
      images: { orderBy: { sortOrder: "asc" }, select: { id: true, path: true } },
      managers: { include: { manager: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      coOwners: { select: { user: { select: { name: true } } } },
    },
  });
  if (!p) notFound();

  const base = `/admin/properties/${p.id}`;
  const name = (me as unknown as { name?: string }).name ?? "Account";
  const { cap, occ, full, wholeUnit, unlimited } = occupancy(p, p.rooms);
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
      fl, count: rs.length, on: rs.filter((r) => r.isActive).length, living: rs.reduce((s, r) => s + r.allocations.length, 0),
      rent: rents.length ? (Math.min(...rents) === Math.max(...rents) ? inr(rents[0]) : `${inr(Math.min(...rents))} – ${inr(Math.max(...rents))}`) : "—",
    };
  });

  return (
    <AdminShell role={me.role} name={name}>
      <Link href="/admin/properties" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All properties</Link>
      <PageHeader title={p.name} sub={<span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{typeText} · {p.address}, {p.city}</span>} action={<ActiveToggle propertyId={p.id} active={p.isActive} />} />

      {/* Every action */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link className={btn} href={`${base}/rooms`}>Room status &amp; allocations</Link>
        <Link className={btn} href={`${base}/ledger`}>Payment ledger</Link>
        <Link className={btn} href={`${base}/edit`}>Edit</Link>
        <Link className={btn} href={`${base}/managers`}>Managers</Link>
        {p.mapUrl && <a className={btn} href={p.mapUrl} target="_blank" rel="noreferrer">View on map</a>}
        <DeletePropertyButton propertyId={p.id} propertyName={p.name} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
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
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label="Owner">{p.owner.name}</Fact>
              <Fact label="Owner email"><span className="break-all">{p.owner.email}</span></Fact>
              <Fact label="Floors">{p.floors ?? "—"}</Fact>
              <Fact label="Rooms / units">{p.rooms.length}</Fact>
              {p.areaSqft != null && <Fact label="Area">{p.areaSqft.toLocaleString("en-IN")} sq ft</Fact>}
              {p.bedrooms != null && <Fact label="Bedrooms">{p.bedrooms}</Fact>}
              {p.bathrooms != null && <Fact label="Bathrooms">{p.bathrooms}</Fact>}
              {p.yearBuilt != null && <Fact label="Built">{p.yearBuilt}</Fact>}
              <Fact label="Added">{p.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Fact>
            </dl>
          </Panel>

          <Panel>
            <h2 className="mb-3 text-xl font-semibold">Managers</h2>
            {p.managers.length === 0 ? <p className="text-sm text-muted-foreground">No managers assigned.</p> : (
              <ul className="space-y-2 text-sm">
                {p.managers.map((m) => <li key={m.id}><span className="font-medium">{m.manager.name}</span><span className="block break-all text-xs text-muted-foreground">{m.manager.email}</span></li>)}
              </ul>
            )}
            {p.coOwners.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 text-sm font-semibold">Co-owners</h3>
                <p className="text-sm">{p.coOwners.map((c) => c.user.name).join(", ")}</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
