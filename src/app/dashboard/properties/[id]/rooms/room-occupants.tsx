"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DoorOpen, Search, X } from "lucide-react";

export type OccupantRoom = {
  id: string;
  label: string;
  category: string;
  capacity: number;
  residents: { id: string; name: string; phone: string; moveIn: string }[];
};
export type OccupantFloor = { floor: number; rooms: OccupantRoom[] };

export default function RoomOccupants({ floors, initialFloor, label = "Room-wise view", compact = false }: {
  floors: OccupantFloor[];
  initialFloor?: number;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [floor, setFloor] = useState(initialFloor ?? floors[0]?.floor ?? 0);
  const [q, setQ] = useState("");
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const term = q.trim().toLowerCase();
  // Searching looks across every floor so a person can be found without knowing where they live.
  const pool = term ? floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floor: f.floor }))) : (floors.find((f) => f.floor === floor)?.rooms ?? []).map((r) => ({ ...r, floor }));
  const rooms = term
    ? pool.filter((r) => r.label.toLowerCase().includes(term) || r.residents.some((p) => p.name.toLowerCase().includes(term) || p.phone.includes(term)))
    : pool;

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Room-wise view">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Who lives where</h3>
            <p className="text-sm text-muted-foreground">Rooms and the people in them. Search by name, phone or room.</p>
          </div>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 border-b border-cream p-4">
          <div className="flex items-center gap-2 rounded-full bg-cream px-4 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or room" className="w-full bg-transparent text-sm outline-none" />
          </div>
          {!term && (
            <div className="flex flex-wrap gap-2">
              {floors.map((f) => {
                const free = f.rooms.reduce((s, r) => s + (r.capacity - r.residents.length), 0);
                return (
                  <button key={f.floor} type="button" onClick={() => setFloor(f.floor)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${floor === f.floor ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
                    Floor {f.floor}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${floor === f.floor ? "bg-primary-foreground/20" : free === 0 ? "bg-destructive/10 text-destructive" : "bg-background"}`}>{free === 0 ? "Max" : `${free} free`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {rooms.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{term ? "No room or person matches your search." : "No rooms on this floor."}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rooms.map((r) => {
                const free = r.capacity - r.residents.length;
                return (
                  <div key={r.id} className="rounded-2xl bg-cream/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{r.label}{term ? <span className="text-xs font-normal text-muted-foreground"> · Floor {r.floor}</span> : null}</p>
                        <p className="text-xs text-muted-foreground">{r.category}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${free <= 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{free <= 0 ? "Full" : `${free} free`}</span>
                    </div>
                    <div className="mt-2 flex gap-1" aria-label={`${r.residents.length} of ${r.capacity} beds occupied`}>
                      {Array.from({ length: r.capacity }).map((_, i) => (
                        <span key={i} className={`h-2 flex-1 rounded-full ${i < r.residents.length ? "bg-primary" : "bg-background"}`} />
                      ))}
                    </div>
                    {r.residents.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">Vacant</p>
                    ) : (
                      <ul className="mt-3 space-y-1.5">
                        {r.residents.map((p) => (
                          <li key={p.id} className="rounded-xl bg-background px-3 py-2 text-sm">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.phone} · since {p.moveIn}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => { if (initialFloor != null) setFloor(initialFloor); setOpen(true); }}
        className={compact ? "flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-xs hover:bg-cream/70" : "flex items-center gap-2 rounded-full bg-background px-6 py-3 ring-1 ring-cream hover:bg-cream"}>
        <DoorOpen className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />{label}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
