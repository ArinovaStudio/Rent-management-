"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import ConfigModal from "./config-modal";
import { F } from "./property-sections";
import { blankRoom, sm, type RoomState } from "./room-types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const MAX_OCC = 20;
const primaryBtn = "rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40";
const softBtn = "rounded-full bg-background px-5 py-2.5 text-sm disabled:opacity-40";

// A flat is stored as a room: label "Flat 101", its floor, roomType SINGLE | SHAREABLE and, for a shareable flat, its maximum occupancy.
export const flatNo = (label: string) => label.replace(/^flat\s+/i, "");
export const isShareable = (r: RoomState) => r.roomType === "SHAREABLE";
export const blankFlat = (floor: number, no: string): RoomState => ({
  ...blankRoom(no ? `Flat ${no}` : ""), floor: String(floor), roomType: "SINGLE", capacity: "1", ac: false, bathAttached: true,
});

// Suggests the next flat number: 101 -> 102 on the same floor, or 201 when moving to another floor.
const nextNo = (flats: RoomState[], floor: number) => {
  const here = flats.filter((f) => Number(f.floor) === floor).map((f) => Number(flatNo(f.label))).filter((n) => Number.isFinite(n));
  return String(here.length ? Math.max(...here) + 1 : floor * 100 + 1);
};

export function flatIssue(flats: RoomState[], floorCount: number): string | null {
  if (flats.length === 0) return "Add at least one flat.";
  const seen = new Set<string>();
  for (const f of flats) {
    const no = flatNo(f.label).trim();
    if (!no) return "Every flat needs a flat number.";
    const fl = Number(f.floor);
    if (!Number.isInteger(fl) || fl < 1 || fl > floorCount) return `Flat ${no}: choose a floor between 1 and ${floorCount}.`;
    const key = `${fl}|${no.toLowerCase()}`;
    if (seen.has(key)) return `Flat ${no} is added twice on floor ${fl}.`;
    seen.add(key);
    if (f.rent.trim() === "" || !(Number(f.rent) >= 0)) return `Flat ${no}: enter the rent.`;
    if (isShareable(f)) {
      const cap = Number(f.capacity);
      if (!Number.isInteger(cap) || cap < 2 || cap > MAX_OCC) return `Flat ${no}: enter the maximum occupancy (2 to ${MAX_OCC}).`;
      if (cap < Number(f.occupied)) return `Flat ${no} has ${f.occupied} residents. Maximum occupancy cannot be lower.`;
    }
  }
  return null;
}

// Popup: one card per flat. After each flat it asks whether there is another one on the same or a different floor.
export function BuildingFlatsModal({ floorCount, flats, onSave, onClose }: {
  floorCount: number; flats: RoomState[]; onSave: (flats: RoomState[]) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoomState[]>(() => (flats.length ? flats : [blankFlat(1, "101")]));
  const [error, setError] = useState("");
  const floorNos = Array.from({ length: floorCount }, (_, i) => i + 1);

  const patch = (i: number, p: Partial<RoomState>) => setDraft((d) => d.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const last = draft[draft.length - 1];
  const addSame = () => {
    const fl = last ? Number(last.floor) || 1 : 1;
    setDraft((d) => [...d, blankFlat(fl, nextNo(d, fl))]);
  };
  const addOther = () => {
    const cur = last ? Number(last.floor) || 1 : 1;
    const fl = cur < floorCount ? cur + 1 : 1;
    setDraft((d) => [...d, blankFlat(fl, nextNo(d, fl))]);
  };
  const remove = (i: number) => setDraft((d) => d.filter((_, k) => k !== i));
  const setType = (i: number, t: "SINGLE" | "SHAREABLE") => patch(i, t === "SINGLE" ? { roomType: t, capacity: "1" } : { roomType: t, capacity: Number(draft[i].capacity) >= 2 ? draft[i].capacity : "2" });
  const save = () => { const e = flatIssue(draft, floorCount); if (e) return setError(e); onSave(draft); };

  return (
    <ConfigModal title="Floors & flats" subtitle={`${floorCount} floors · ${draft.length} ${draft.length === 1 ? "flat" : "flats"}`} onClose={onClose} onSave={save} saveLabel="Save flats">
      <div className="mb-4 flex flex-wrap gap-2">
        {floorNos.map((f) => {
          const n = draft.filter((x) => Number(x.floor) === f).length;
          return <span key={f} className="rounded-full bg-cream px-4 py-2 text-sm">Floor {f} · {n} {n === 1 ? "flat" : "flats"}</span>;
        })}
      </div>

      <div className="grid gap-4">
        {draft.map((r, i) => {
          const locked = Number(r.occupied) > 0;
          return (
            <div key={r.id ?? i} className="rounded-2xl bg-cream/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">{flatNo(r.label) ? `Flat ${flatNo(r.label)}` : `Flat ${i + 1}`}{Number(r.floor) ? ` · Floor ${r.floor}` : ""}</p>
                <button type="button" disabled={locked} onClick={() => remove(i)} aria-label="Remove flat" title={locked ? "This flat has residents" : "Remove flat"} className="rounded-full bg-background p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-30"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <F label="Floor number">
                  <select className={sm} value={r.floor} onChange={(e) => patch(i, { floor: e.target.value })}>
                    {floorNos.map((f) => <option key={f} value={f}>Floor {f}</option>)}
                  </select>
                </F>
                <F label="Flat number"><input className={sm} value={flatNo(r.label)} onChange={(e) => patch(i, { label: e.target.value.trim() ? `Flat ${e.target.value}` : "" })} placeholder="e.g. 101" /></F>
                <F label="Occupancy type">
                  <select className={sm} value={r.roomType} onChange={(e) => setType(i, e.target.value as "SINGLE" | "SHAREABLE")}>
                    <option value="SINGLE">Single</option>
                    <option value="SHAREABLE">Shareable</option>
                  </select>
                </F>
                <F label="Rent (₹ / month)"><input className={sm} type="number" min={0} value={r.rent} onChange={(e) => patch(i, { rent: e.target.value })} /></F>
                {isShareable(r) && (
                  <F label="Maximum occupancy"><input className={sm} type="number" min={Math.max(2, Number(r.occupied) || 0)} max={MAX_OCC} value={r.capacity} onChange={(e) => patch(i, { capacity: e.target.value })} /></F>
                )}
              </div>
              {isShareable(r)
                ? <p className="mt-2 text-xs text-muted-foreground">Each resident&apos;s details are collected when you allocate this flat.</p>
                : <p className="mt-2 text-xs text-muted-foreground">Single: rented to one tenant.</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl bg-cream p-4">
        <p className="font-medium">Have another flat on the same/different floor?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={addSame} className={primaryBtn}><Plus className="mr-1 inline h-4 w-4" />Same floor</button>
          <button type="button" onClick={addOther} disabled={floorCount < 2} className={softBtn}><Plus className="mr-1 inline h-4 w-4" />Different floor</button>
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
    </ConfigModal>
  );
}

// Card in the Rooms section: summary by floor and the button that opens the popup.
export function BuildingFlatsCard({ floorCount, flats, onOpen }: { floorCount: number; flats: RoomState[]; onOpen: () => void }) {
  const issue = flats.length ? flatIssue(flats, floorCount) : null;
  const floorNos = Array.from({ length: floorCount }, (_, i) => i + 1);
  const rents = flats.map((f) => Number(f.rent)).filter((n) => n > 0);
  return (
    <div className="rounded-2xl bg-cream/60 p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Floors & flats</p>
          <p className="text-sm text-muted-foreground">
            {floorCount < 1 ? "Enter the number of floors in Specifications first."
              : flats.length === 0 ? `${floorCount} floors declared. Generate floors and add the flats on each one.`
              : `${floorCount} floors · ${flats.length} ${flats.length === 1 ? "flat" : "flats"}${rents.length ? ` · from ${inr(Math.min(...rents))}` : ""}`}
          </p>
        </div>
        <button type="button" onClick={onOpen} disabled={floorCount < 1} className={primaryBtn}>{flats.length ? "Edit flats" : "Generate floors & add flats"}</button>
      </div>
      {flats.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {floorNos.map((f) => {
            const here = flats.filter((x) => Number(x.floor) === f);
            const sh = here.filter(isShareable).length;
            return (
              <li key={f} className="flex flex-wrap justify-between gap-x-3">
                <span>Floor {f}</span>
                <span className="text-muted-foreground">
                  {here.length ? `${here.map((x) => flatNo(x.label)).join(", ")} · ${here.length - sh} single, ${sh} shareable` : "No flats"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {issue && <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{issue}</p>}
    </div>
  );
}
