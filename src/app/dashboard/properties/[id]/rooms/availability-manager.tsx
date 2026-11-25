"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Power, X } from "lucide-react";
import ActiveToggle from "@/components/admin/ActiveToggle";

export type AvailRoom = { id: string; label: string; floor: number | null; capacity: number; ac: boolean; active: boolean; note: string | null; living: number };

const catName = (capacity: number, ac: boolean) => `${capacity}-seater${ac ? " AC" : ""}`;
// One state for a group of rooms: all On, all Off, or some of each
const stateOf = (list: AvailRoom[]): boolean | "mixed" => (list.every((r) => r.active) ? true : list.every((r) => !r.active) ? false : "mixed");
const countText = (list: AvailRoom[]) => `${list.filter((r) => r.active).length}/${list.length} on`;

const row = "flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-sm";

function RoomRow({ r, propertyId, note, dim }: { r: AvailRoom; propertyId: string; note: string; dim: boolean }) {
  return (
    <li className={`${row} bg-background ${dim ? "opacity-60" : ""}`}>
      <span className="min-w-0">
        <span className="block truncate font-medium">{r.label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {r.living > 0 ? `${r.living} living here` : !r.active && r.note ? r.note : "Vacant"}
        </span>
      </span>
      <ActiveToggle propertyId={propertyId} roomId={r.id} active={r.active} note={note} disabled={r.active && r.living > 0} title={r.active && r.living > 0 ? "Check the residents out first" : undefined} />
    </li>
  );
}

// Property > floor > (PG: room category >) room. Each level has its own switch; a switch higher up changes everything under it.
export default function AvailabilityManager({ propertyId, propertyActive, propertyNote, rooms, roomWord, byCategory }: {
  propertyId: string; propertyActive: boolean; propertyNote: string | null; rooms: AvailRoom[];
  roomWord: string | null; // "room" | "flat", null = no per-room list
  byCategory: boolean; // PG: add a "category on this floor" level between floor and room
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [note, setNote] = useState("Under construction");

  const floors = [...new Set(rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b);
  const inactiveCount = rooms.filter((r) => !r.active).length + (propertyActive ? 0 : 1);
  const unit = roomWord ?? "unit";

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Availability">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Availability</h3>
            <p className="text-sm text-muted-foreground">
              Switch Off the whole property, one floor{byCategory ? ", one room category on a floor" : ""} or a single {unit}. Inactive units can&apos;t be given to new residents.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason when switching Off</span>
            <input className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Under construction" />
          </label>

          {/* Whole property */}
          <div className={`${row} bg-cream/60`}>
            <div className="min-w-0">
              <p className="font-medium">Whole property</p>
              {!propertyActive && propertyNote && <p className="truncate text-xs text-muted-foreground">{propertyNote}</p>}
              {!propertyActive && <p className="text-xs text-muted-foreground">Off: no new residents anywhere.</p>}
            </div>
            <ActiveToggle propertyId={propertyId} active={propertyActive} note={note} />
          </div>

          {/* Floors */}
          {roomWord && rooms.length > 0 && floors.map((fl) => {
            const onFloor = rooms.filter((r) => (r.floor ?? 0) === fl);
            const cats = byCategory
              ? [...new Map(onFloor.map((r) => [`${r.capacity}-${r.ac}`, { capacity: r.capacity, ac: r.ac }])).values()].sort((a, b) => a.capacity - b.capacity || Number(a.ac) - Number(b.ac))
              : [];
            return (
              <details key={fl} className={`group rounded-2xl bg-cream/60 ${propertyActive ? "" : "opacity-70"}`} open={floors.length === 1}>
                <summary className={`${row} cursor-pointer list-none`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">Floor {fl}</span>
                      <span className="block text-xs text-muted-foreground">{onFloor.length} {onFloor.length === 1 ? unit : `${unit}s`} · {countText(onFloor)}</span>
                    </span>
                  </span>
                  <ActiveToggle propertyId={propertyId} floor={fl} active={stateOf(onFloor)} note={note} />
                </summary>

                <div className="space-y-2 px-3 pb-3">
                  {byCategory ? (
                    cats.map((c) => {
                      const inCat = onFloor.filter((r) => r.capacity === c.capacity && r.ac === c.ac);
                      return (
                        <details key={`${c.capacity}-${c.ac}`} className="group/cat rounded-2xl bg-background/70">
                          <summary className={`${row} cursor-pointer list-none`}>
                            <span className="flex min-w-0 items-center gap-2">
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/cat:rotate-180" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{catName(c.capacity, c.ac)} rooms</span>
                                <span className="block text-xs text-muted-foreground">{inCat.length} {inCat.length === 1 ? "room" : "rooms"} · {countText(inCat)}</span>
                              </span>
                            </span>
                            <ActiveToggle propertyId={propertyId} floor={fl} capacity={c.capacity} ac={c.ac} active={stateOf(inCat)} note={note} />
                          </summary>
                          <ul className="space-y-1.5 px-3 pb-3">
                            {inCat.map((r) => <RoomRow key={r.id} r={r} propertyId={propertyId} note={note} dim={false} />)}
                          </ul>
                        </details>
                      );
                    })
                  ) : (
                    <ul className="space-y-1.5">
                      {onFloor.map((r) => <RoomRow key={r.id} r={r} propertyId={propertyId} note={note} dim={false} />)}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}

          <p className="text-xs text-muted-foreground">
            A switch with &quot;Some&quot; has a mix of On and Off inside. Pressing it turns everything inside On. To switch Off something that has residents, check them out first.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-background px-6 py-3 hover:bg-cream">
        <Power className="h-5 w-5" />Availability{inactiveCount > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{inactiveCount} inactive</span>}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
