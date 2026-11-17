import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, BedDouble, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { propertiesBase } from "@/lib/routes";
import { AdminShell, Panel } from "@/components/admin/AdminShell";
import AllocationForm, { type FloorSlot, type UnitOption } from "./allocation-form";
import AllocationActions from "./allocation-actions";
import ResidentBills from "./resident-bills";
import { roomCategoryLabel, roomFloor } from "@/lib/room-category";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const catName = (c: { capacity: number; ac: boolean }) => `${c.capacity}-seater${c.ac ? " AC" : ""}`;

export default async function PropertyRoomsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { createdAt: "asc" },
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            include: { documents: true, bills: { orderBy: { period: "desc" } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!property || !(await canOperateProperty(me, property))) notFound();

  const isPg = property.type === "PG";
  const capacity = property.rooms.reduce((s, r) => s + r.capacity, 0);
  const occupied = property.rooms.reduce((s, r) => s + r.allocations.length, 0);
  const available = Math.max(0, capacity - occupied);
  const name = (me as unknown as { name?: string }).name ?? "Account";

  // ---- PG: floor -> category -> beds / occupied ----
  const floorNos = [...new Set(property.rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b);
  const floors: FloorSlot[] = floorNos.map((fl) => {
    const map = new Map<string, FloorSlot["cats"][number]>();
    for (const r of property.rooms.filter((x) => (x.floor ?? 0) === fl)) {
      const key = `${r.capacity}-${r.ac}`;
      const cur = map.get(key) ?? { capacity: r.capacity, ac: r.ac, rent: r.rent, beds: 0, occupied: 0 };
      cur.beds += r.capacity;
      cur.occupied += r.allocations.length;
      map.set(key, cur);
    }
    return { floor: fl, cats: [...map.values()].sort((a, b) => a.capacity - b.capacity || Number(a.ac) - Number(b.ac)) };
  });

  // ---- Apartment / flat: units ----
  const units: UnitOption[] = property.rooms.map((r) => ({
    id: r.id, label: r.label, category: roomCategoryLabel(property, r), floor: roomFloor(property, r),
    rent: r.rent, capacity: r.capacity, occupied: r.allocations.length,
  }));

  // ---- Residents (flat list, grouped by floor in PG) ----
  const residents = property.rooms.flatMap((room) => room.allocations.map((a) => ({ a, room })));
  const residentGroups = isPg
    ? floorNos.map((fl) => ({ title: `Floor ${fl}`, list: residents.filter((x) => (x.room.floor ?? 0) === fl) })).filter((g) => g.list.length > 0)
    : residents.length ? [{ title: "Current residents", list: residents }] : [];

  return (
    <AdminShell role={me.role} name={name}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertiesBase(me.role)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Room status & tenant allocation</p>
        </div>
        <AllocationForm propertyId={property.id} isPg={isPg} floors={floors} units={units} />
      </div>

      <div className="space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">Occupied</p><p className="text-2xl font-medium">{occupied}<span className="text-base text-muted-foreground"> / {capacity}</span></p></div>
          </Panel>
          <Panel className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">{isPg ? "Beds available" : "Available"}</p><p className="text-2xl font-medium">{available}</p></div>
          </Panel>
          <Panel className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
            <div><p className="text-sm text-muted-foreground">{isPg ? "Floors" : "Units"}</p><p className="text-2xl font-medium">{isPg ? floors.length : units.length}</p></div>
          </Panel>
        </div>

        {/* Status */}
        {isPg ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {floors.map((f) => {
              const beds = f.cats.reduce((s, c) => s + c.beds, 0);
              const occ = f.cats.reduce((s, c) => s + c.occupied, 0);
              const maxed = beds > 0 && occ >= beds;
              return (
                <Panel key={f.floor}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Floor {f.floor}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs ${maxed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{maxed ? "Max occupancy" : `${beds - occ} beds free`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-primary" style={{ width: `${beds ? Math.min(100, (occ / beds) * 100) : 0}%` }} /></div>
                  <ul className="mt-4 space-y-2">
                    {f.cats.map((c) => {
                      const left = c.beds - c.occupied;
                      return (
                        <li key={`${c.capacity}-${c.ac}`} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-2.5 text-sm">
                          <span>
                            <span className="block font-medium">{catName(c)}</span>
                            <span className="block text-xs text-muted-foreground">{inr(c.rent)} / person</span>
                          </span>
                          <span className="text-right">
                            <span className="block font-medium">{c.occupied}/{c.beds}</span>
                            <span className={`block text-xs ${left <= 0 ? "text-destructive" : "text-muted-foreground"}`}>{left <= 0 ? "Max occupancy" : `${left} free`}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              );
            })}
          </div>
        ) : (
          <Panel>
            <h2 className="text-lg font-semibold">Units</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {units.map((u) => {
                const full = u.occupied >= u.capacity;
                return (
                  <li key={u.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                    <span>
                      <span className="block font-medium">{u.label}</span>
                      <span className="block text-xs text-muted-foreground">{u.category}{u.floor != null ? ` · Floor ${u.floor}` : ""} · {inr(u.rent)}/month</span>
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs ${full ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{full ? "Occupied" : "Vacant"}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {/* Residents */}
        <Panel>
          <h2 className="text-lg font-semibold">Residents</h2>
          {residentGroups.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No residents allocated yet. Use “Allocate a person” to add one.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {residentGroups.map((g) => (
                <div key={g.title}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title} · {g.list.length}</p>
                  <div className="space-y-3">
                    {g.list.map(({ a, room }) => (
                      <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-cream/60 p-4">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{a.fullName}</p>
                          <p className="text-muted-foreground">{a.phone}{a.email ? ` · ${a.email}` : ""}</p>
                          <p className="text-muted-foreground">
                            {a.roomCategory ?? roomCategoryLabel(property, room)}
                            {(a.floorNumber ?? roomFloor(property, room)) != null ? ` · Floor ${a.floorNumber ?? roomFloor(property, room)}` : ""}
                            {" · "}{room.label} · {inr(a.monthlyRent)}/month
                          </p>
                          <p className="text-muted-foreground">Move-in {a.moveInDate.toLocaleDateString("en-IN")} · {a.documents.length} document(s)</p>
                          <ResidentBills
                            allocationId={a.id}
                            bills={a.bills.map((b) => ({ id: b.id, type: b.type, period: b.period, amount: b.amount, note: b.note, paid: b.paid }))}
                          />
                        </div>
                        <AllocationActions allocationId={a.id} residentUrl={`/resident/${a.accessToken}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
