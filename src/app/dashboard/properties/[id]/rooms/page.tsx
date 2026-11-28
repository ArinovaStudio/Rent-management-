import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, BedDouble, ChevronDown, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { propertiesBase, propertyHome } from "@/lib/routes";
import { AdminShell, Panel } from "@/components/admin/AdminShell";
import AllocationForm, { type FloorSlot } from "./allocation-form";
import BuildingAllocationForm, { type BuildingFloor } from "./building-allocation-form";
import SharedPersons from "./shared-persons";
import { splitMain } from "@/lib/main-tenant";
import BuildingResidentsTable, { type BuildingResidentRow } from "./building-residents-table";
import AllocationActions from "./allocation-actions";
import RoomOccupants, { type OccupantFloor } from "./room-occupants";
import AvailabilityManager from "./availability-manager";
import GenerateBill, { type BillRoom } from "./generate-bill";
import { roomFloor } from "@/lib/room-category";
import { flatOpen, headcount, isShareableUnit, occupancy } from "@/lib/occupancy";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const catName = (c: { capacity: number; ac: boolean }) => `${c.capacity}-seater${c.ac ? " AC" : ""}`;

export default async function PropertyRoomsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  // Lean select: only fields this page renders. Bills are not shown here (ledger owns those).
  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true, name: true, type: true, sharing: true, floors: true, isActive: true, inactiveNote: true, ownerId: true,
      rooms: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, label: true, capacity: true, ac: true, rent: true, floor: true, roomType: true,
          bedrooms: true, isActive: true, inactiveNote: true, closedToNew: true,
          allocations: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            select: {
              id: true, fullName: true, phone: true, email: true, moveInDate: true, monthlyRent: true,
              floorNumber: true, roomCategory: true, accessToken: true, isHousemate: true, createdAt: true,
              _count: { select: { documents: true } },
            },
          },
        },
      },
    },
  });
  if (!property || !(await canOperateProperty(me, property))) notFound();

  const isPg = property.type === "PG";
  // PG and flats rented room by room are handled by room category. A flat rented as a whole has no room-wise view.
  const isBuilding = property.type === "BUILDING";

  // Tenant history is not loaded with the page. Only the number is counted here (for the button);
  // the popup fetches one floor and one page at a time from /api/properties/[id]/history.
  const historyCount = isBuilding ? await prisma.allocation.count({ where: { status: "CHECKED_OUT", room: { propertyId: property.id } } }) : 0;
  const byCategory = (isPg || property.sharing) && !isBuilding;
  // Inactive rooms / flats (e.g. under construction) don't count as capacity and can't be allocated
  const liveRooms = property.rooms.filter((r) => r.isActive);
  const { cap: capacity, occ: occupied, full, unlimited } = occupancy(property, liveRooms);
  const available = Math.max(0, capacity - occupied);
  const name = me.name ?? "Account";

  // ---- Floor -> category -> beds / occupied (a flat has just one "floor") ----
  const floorNos = [...new Set(property.rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b);
  const floors: FloorSlot[] = floorNos.map((fl) => {
    const map = new Map<string, FloorSlot["cats"][number]>();
    for (const r of liveRooms.filter((x) => (x.floor ?? 0) === fl)) {
      const key = `${r.capacity}-${r.ac}`;
      const cur = map.get(key) ?? { capacity: r.capacity, ac: r.ac, rent: r.rent, beds: 0, occupied: 0 };
      cur.beds += r.capacity;
      cur.occupied += headcount(r.allocations);
      map.set(key, cur);
    }
    return { floor: fl, cats: [...map.values()].sort((a, b) => a.capacity - b.capacity || Number(a.ac) - Number(b.ac)) };
  });

  // ---- Room-wise occupants (for the "who lives where" popup) ----
  const occupantFloors: OccupantFloor[] = floorNos.map((fl) => ({
    floor: fl,
    rooms: property.rooms
      .filter((r) => (r.floor ?? 0) === fl)
      .map((r) => ({
        id: r.id,
        label: r.label,
        category: isPg ? catName(r) : `${r.capacity}-sharing${r.ac ? " AC" : ""}`,
        capacity: r.capacity,
        residents: r.allocations.map((a) => ({ id: a.id, name: a.fullName, phone: a.phone, moveIn: a.moveInDate.toLocaleDateString("en-IN") })),
      })),
  }));

  // ---- Building: every flat on its own, grouped by floor ----
  const buildingFloors: BuildingFloor[] = floorNos.map((fl) => ({
    floor: fl,
    flats: liveRooms.filter((r) => (r.floor ?? 0) === fl).map((r) => ({
      id: r.id, label: r.label, shareable: r.roomType === "SHAREABLE", rent: r.rent, living: r.allocations.length, bhk: r.bedrooms, closed: !flatOpen(r, r.allocations.length),
    })),
  }));
  const flatCount = liveRooms.length;
  const vacantFlats = liveRooms.filter((r) => flatOpen(r, r.allocations.length)).length;

  // ---- Building residents: grouped floor -> flat. A shareable flat shows its main tenant; friends sit behind a button. ----
  const byFlat = (x: { label: string }, y: { label: string }) => x.label.localeCompare(y.label, undefined, { numeric: true });
  const buildingResidentGroups = floorNos.map((fl) => ({
    floor: fl,
    flats: property.rooms.filter((r) => (r.floor ?? 0) === fl && r.allocations.length > 0).sort(byFlat).map((room) => {
      const { main, shared } = splitMain(room.allocations);
      return { room, main: main!, shared };
    }),
  })).filter((g) => g.flats.length > 0);
  // Table: the main tenant of each flat only (people sharing are in the flat's "shared persons" popup)
  const tableRows: BuildingResidentRow[] = property.rooms.slice().sort(byFlat).flatMap((room) => {
    const { main } = splitMain(room.allocations);
    return main ? [{
      id: main.id, name: main.fullName, phone: main.phone, email: main.email, floor: room.floor ?? 0, flat: room.label.replace(/^flat\s+/i, ""), bhk: room.bedrooms,
      roomId: room.id, shared: isShareableUnit(room), vacant: flatOpen(room, room.allocations.length),
      people: room.allocations.length, rent: main.monthlyRent, moveIn: main.moveInDate.toLocaleDateString("en-IN"),
    }] : [];
  });

  // ---- Whole flat ----
  const unit = property.rooms[0];
  const whole = { rent: unit?.rent ?? 0, capacity: unit?.capacity ?? 1, occupied, open: !!unit && unit.isActive && !full, unlimited };

  // ---- Residents (grouped by floor in a PG, otherwise one group) ----
  // A flat rented as a whole (Apartment/Flat, not rent-by-room) works like a Building flat: show its main tenant,
  // the people sharing sit behind a button.
  const wholeFlat = !byCategory && !isBuilding;
  const residents = property.rooms.flatMap((room) => {
    if (wholeFlat && room.allocations.length > 0) return [{ a: splitMain(room.allocations).main!, room }];
    return room.allocations.map((a) => ({ a, room }));
  });
  const sharedOf = (roomId: string, mainId: string) =>
    (property.rooms.find((r) => r.id === roomId)?.allocations ?? []).filter((x) => x.id !== mainId)
      .map((s) => ({ id: s.id, name: s.fullName, phone: s.phone, email: s.email, moveIn: s.moveInDate.toLocaleDateString("en-IN"), docs: s._count.documents }));
  const residentGroups = isPg || isBuilding
    ? floorNos.map((fl) => ({ title: `Floor ${fl}`, list: residents.filter((x) => (x.room.floor ?? 0) === fl) })).filter((g) => g.list.length > 0)
    : residents.length ? [{ title: "Current residents", list: residents }] : [];

  // ---- Rooms that can get a bill (bill goes to the person whose link the resident uses) ----
  const billRooms: BillRoom[] = property.rooms.filter((r) => r.allocations.length > 0).map((r) => {
    const list = isBuilding || wholeFlat ? [splitMain(r.allocations).main].filter((x): x is NonNullable<typeof x> => !!x) : r.allocations;
    return {
      id: r.id, label: r.label, floor: r.floor ?? null,
      category: isBuilding || wholeFlat ? (r.roomType === "SHAREABLE" ? "Shareable flat" : "Flat") : catName(r),
      people: list.map((a) => ({ id: a.id, name: a.fullName, phone: a.phone, email: a.email, rent: a.monthlyRent, moveIn: a.moveInDate.toLocaleDateString("en-IN") })),
    };
  });

  return (
    <AdminShell role={me.role} name={name}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertyHome(me.role, property.id)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">{isBuilding ? "Flat status & tenant allocation" : byCategory ? "Room status & tenant allocation" : "Flat status & tenant"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {byCategory && <RoomOccupants floors={occupantFloors} showFloors={isPg} />}
          {isBuilding
            ? <BuildingAllocationForm propertyId={property.id} floors={buildingFloors} />
            : <AllocationForm propertyId={property.id} mode={byCategory ? "category" : "whole"} showFloors={isPg} floors={floors} whole={whole} />}
          <AvailabilityManager
            propertyId={property.id}
            propertyActive={property.isActive}
            propertyNote={property.inactiveNote}
            roomWord={isBuilding ? "flat" : byCategory ? "room" : null}
            byCategory={isPg}
            rooms={property.rooms.map((r) => ({ id: r.id, label: r.label, floor: r.floor ?? null, capacity: r.capacity, ac: r.ac, active: r.isActive, note: r.inactiveNote, living: r.allocations.length }))}
          />
          <GenerateBill rooms={billRooms} />
        </div>
      </div>

      <div className="space-y-6">
        {!property.isActive && (
          <p className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">
            This property is inactive{property.inactiveNote ? ` (${property.inactiveNote})` : ""}. New allocations are blocked until you switch it On in Availability.
          </p>
        )}
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {isBuilding ? (
            <>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">People living here</p><p className="text-2xl font-medium">{property.rooms.reduce((s, r) => s + headcount(r.allocations), 0)}</p></div>
              </Panel>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">Vacant flats</p><p className="text-2xl font-medium">{vacantFlats}<span className="text-base text-muted-foreground"> / {flatCount}</span></p></div>
              </Panel>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">Floors</p><p className="text-2xl font-medium">{buildingFloors.length}</p></div>
              </Panel>
            </>
          ) : byCategory ? (
            <>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">Occupied</p><p className="text-2xl font-medium">{occupied}<span className="text-base text-muted-foreground"> / {capacity}</span></p></div>
              </Panel>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">Beds available</p><p className="text-2xl font-medium">{available}</p></div>
              </Panel>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">{isPg ? "Floors" : "Rooms"}</p><p className="text-2xl font-medium">{isPg ? floors.length : property.rooms.length}</p></div>
              </Panel>
            </>
          ) : (
            <>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">Status</p><p className="text-2xl font-medium">{occupied === 0 ? "Vacant" : full ? "Full" : "Rented"}</p></div>
              </Panel>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">People living here</p><p className="text-2xl font-medium">{occupied}{!unlimited && <span className="text-base text-muted-foreground"> / {capacity}</span>}</p></div>
              </Panel>
              <Panel className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Wallet className="h-5 w-5" /></span>
                <div><p className="text-sm text-muted-foreground">Rent / month</p><p className="text-2xl font-medium">{inr(whole.rent)}</p></div>
              </Panel>
            </>
          )}
        </div>

        {/* Status */}
        {isPg && (
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
                  <div className="mt-3"><RoomOccupants floors={occupantFloors} initialFloor={f.floor} label="View rooms & people" compact /></div>
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
        )}

        {isBuilding && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {property.rooms.length > 0 && floorNos.map((fl) => {
              const list = property.rooms.filter((r) => (r.floor ?? 0) === fl);
              return (
                <Panel key={fl}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Floor {fl}</h2>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{list.filter((r) => r.isActive && flatOpen(r, r.allocations.length)).length} vacant</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {list.map((r) => {
                      const people = headcount(r.allocations);
                      const tenant = r.allocations.find((a) => a.monthlyRent > 0) ?? r.allocations[0];
                      return (
                        <li key={r.id} className={`flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-2.5 text-sm ${r.isActive && !flatOpen(r, people) ? "opacity-60" : ""}`}>
                          <span className="min-w-0">
                            <span className="block font-medium">{r.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">{r.bedrooms ? `${r.bedrooms} BHK · ` : ""}{r.roomType === "SHAREABLE" ? "Shareable" : "Single"} · {inr(r.rent)} / month{tenant ? ` · ${tenant.fullName}` : ""}</span>
                          </span>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${!r.isActive ? "bg-destructive/10 text-destructive" : people === 0 || (r.roomType === "SHAREABLE" && !r.closedToNew) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{!r.isActive ? "Inactive" : people === 0 ? "Vacant" : r.roomType === "SHAREABLE" ? (r.closedToNew ? "Non vacant" : `${people} ${people === 1 ? "person" : "people"} · Vacant`) : "Non vacant"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              );
            })}
          </div>
        )}

        {byCategory && !isPg && (
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Rooms by category</h2>
              <span className={`rounded-full px-3 py-1 text-xs ${full ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{full ? "Max occupancy" : `${available} free`}</span>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {(floors[0]?.cats ?? []).map((c) => {
                const left = c.beds - c.occupied;
                return (
                  <li key={`${c.capacity}-${c.ac}`} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                    <span>
                      <span className="block font-medium">{c.capacity}-sharing{c.ac ? " AC" : ""}</span>
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
        )}

        {/* Residents */}
        {isBuilding && (
          <>
            <Panel>
              <h2 className="text-lg font-semibold">Residents</h2>
              {buildingResidentGroups.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No residents yet. Use “Allocate flats” to rent out a flat.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {buildingResidentGroups.map((g) => (
                    <details key={g.floor} className="group rounded-2xl bg-cream/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 hover:bg-cream/70 [&::-webkit-details-marker]:hidden">
                        <span className="font-medium">Floor {g.floor}</span>
                        <span className="flex items-center gap-3 text-sm text-muted-foreground">
                          {g.flats.length} {g.flats.length === 1 ? "flat" : "flats"}
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <div className="space-y-4 px-3 pb-3">
                        {g.flats.map(({ room, main, shared }) => (
                          <div key={room.id}>
                            <p className="mb-2 px-1 text-sm font-medium">{room.label}{room.bedrooms ? ` · ${room.bedrooms} BHK` : ""} · {room.roomType === "SHAREABLE" ? "Shareable" : "Single"}</p>
                            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-cream/60 p-4">
                              <div className="min-w-0 text-sm">
                                <p className="font-medium">{main.fullName} <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">Main tenant</span></p>
                                <p className="text-muted-foreground">{main.phone}{main.email ? ` · ${main.email}` : ""}</p>
                                <p className="text-muted-foreground">{main.roomCategory} · Floor {main.floorNumber ?? room.floor} · {inr(main.monthlyRent)}/month</p>
                                <p className="text-muted-foreground">Move-in {main.moveInDate.toLocaleDateString("en-IN")} · {main._count.documents} document(s)</p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <AllocationActions allocationId={main.id} residentUrl={`/resident/${main.accessToken}`} />
                                {shared.length > 0 && (
                                  <SharedPersons flat={room.label} persons={shared.map((s) => ({ id: s.id, name: s.fullName, phone: s.phone, email: s.email, moveIn: s.moveInDate.toLocaleDateString("en-IN"), docs: s._count.documents }))} />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Building residents</h2>
                  <p className="text-sm text-muted-foreground">Main tenant of each flat, floor by floor.</p>
                </div>
              </div>
              <BuildingResidentsTable
                floors={floorNos} rows={tableRows} propertyId={property.id} historyCount={historyCount} canEditStatus
                flats={property.rooms.slice().sort(byFlat).map((r) => ({ id: r.id, label: r.label, floor: r.floor ?? 0 }))}
              />
            </Panel>
          </>
        )}
        {!isBuilding && (
        <Panel>
          <h2 className="text-lg font-semibold">Residents</h2>
          {residentGroups.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{isBuilding ? "No residents yet. Use “Allocate flats” to rent out a flat." : byCategory ? "No residents allocated yet. Use “Allocate a person” to add one." : "This flat is vacant. Use “Allocate a person” to rent it out."}</p>
          ) : (
            <div className="mt-4 space-y-6">
              {residentGroups.map((g) => (
                <details key={g.title} open={!isPg && !isBuilding} className="group rounded-2xl bg-cream/40">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 hover:bg-cream/70 [&::-webkit-details-marker]:hidden">
                    <span className="font-medium">{g.title}</span>
                    <span className="flex items-center gap-3 text-sm text-muted-foreground">
                      {g.list.length} {g.list.length === 1 ? "resident" : "residents"}
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                    {g.list.map(({ a, room }) => {
                      const floor = a.floorNumber ?? roomFloor(property, room);
                      return (
                        <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-cream/60 p-4">
                          <div className="min-w-0 text-sm">
                            <p className="font-medium">{a.fullName}</p>
                            <p className="text-muted-foreground">{a.phone}{a.email ? ` · ${a.email}` : ""}</p>
                            <p className="text-muted-foreground">
                              {isBuilding
                                ? <>{room.label} · Floor {floor} · {a.roomCategory}{a.monthlyRent > 0 ? ` · Tenant · ${inr(a.monthlyRent)}/month` : " · Resident · rent covered by the tenant"}</>
                                : byCategory
                                ? <>{a.roomCategory ?? catName(room)}{isPg && floor != null ? ` · Floor ${floor}` : ""} · {room.label} · {inr(a.monthlyRent)}/month</>
                                : <>Entire flat · Main tenant · {inr(a.monthlyRent)}/month</>}
                            </p>
                            <p className="text-muted-foreground">Move-in {a.moveInDate.toLocaleDateString("en-IN")} · {a._count.documents} document(s)</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <AllocationActions allocationId={a.id} residentUrl={`/resident/${a.accessToken}`} />
                            {wholeFlat && sharedOf(room.id, a.id).length > 0 && <SharedPersons flat={room.label} persons={sharedOf(room.id, a.id)} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}
        </Panel>
        )}
      </div>
    </AdminShell>
  );
}
