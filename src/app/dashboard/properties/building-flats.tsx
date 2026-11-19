"use client";
import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import ConfigModal from "./config-modal";
import { F } from "./property-sections";
import { blankRoom, sm, type RoomState } from "./room-types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const MAX_PER_FLOOR = 50;
const primaryBtn = "rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40";

// A flat is stored as a room: label "Flat 101", its floor and roomType SINGLE | SHAREABLE.
// A shareable flat has no maximum: any number of people can be allocated to it later.
export const flatNo = (label: string) => label.replace(/^flat\s+/i, "");
export const isShareable = (r: RoomState) => r.roomType === "SHAREABLE";
export const blankFlat = (floor: number, no: string): RoomState => ({
  ...blankRoom(no ? `Flat ${no}` : ""), floor: String(floor), roomType: "SINGLE", capacity: "1", ac: false, bathAttached: true,
  bhk: "2", baths: "1", furnishing: "", sizeSqm: "", photos: [],
});

export const FURNISH_OPTIONS: [string, string][] = [["UNFURNISHED", "Unfurnished"], ["SEMI_FURNISHED", "Semi-furnished"], ["FURNISHED", "Furnished"]];
const MAX_PHOTOS = 10;

// Next flat number on a floor: 301, 302 ...
const nextNo = (flats: RoomState[], floor: number) => {
  const nums = flats.filter((f) => Number(f.floor) === floor).map((f) => Number(flatNo(f.label))).filter((n) => Number.isFinite(n));
  return String(nums.length ? Math.max(...nums) + 1 : floor * 100 + 1);
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
    if (!(Number(f.bhk) >= 1)) return `Flat ${no}: choose how many BHK.`;
    if (!(Number(f.baths) >= 1)) return `Flat ${no}: enter the number of bathrooms.`;
    if (!(Number(f.sizeSqm) > 0)) return `Flat ${no}: enter the flat area in m².`;
    if (!f.furnishing) return `Flat ${no}: choose the furnishing.`;
  }
  return null;
}

// Popup like the PG floor builder: one tab per floor. Each floor asks how many flats it has, then lists them.
export function BuildingFlatsModal({ floorCount, flats, onSave, onClose }: {
  floorCount: number; flats: RoomState[]; onSave: (flats: RoomState[]) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoomState[]>(flats);
  const [floor, setFloor] = useState(1);
  const [count, setCount] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const floorNos = Array.from({ length: floorCount }, (_, i) => i + 1);

  const onFloor = (fl: number, list = draft) => list.filter((f) => Number(f.floor) === fl);
  const patch = (target: RoomState, p: Partial<RoomState>) => setDraft((d) => d.map((x) => (x === target ? { ...x, ...p } : x)));

  // Sets the number of flats on the current floor: adds blank flats or removes the last ones.
  const applyCount = () => {
    const n = Number(count[floor] ?? onFloor(floor).length);
    if (!Number.isInteger(n) || n < 0 || n > MAX_PER_FLOOR) return setError(`Enter 0 to ${MAX_PER_FLOOR} flats.`);
    setError("");
    const here = onFloor(floor);
    if (n === here.length) return;
    if (n > here.length) {
      let next = draft;
      for (let i = here.length; i < n; i++) next = [...next, blankFlat(floor, nextNo(next, floor))];
      return setDraft(next);
    }
    const drop = here.slice(n);
    const busy = drop.find((f) => Number(f.occupied) > 0);
    if (busy) return setError(`${busy.label} has residents, so it can't be removed.`);
    setDraft((d) => d.filter((f) => !drop.includes(f)));
  };

  const save = () => { const e = flatIssue(draft, floorCount); if (e) return setError(e); onSave(draft); };
  const here = onFloor(floor);

  return (
    <ConfigModal title="Floors & flats" subtitle={`${floorCount} floors · ${draft.length} ${draft.length === 1 ? "flat" : "flats"}`} onClose={onClose} onSave={save} saveLabel="Save flats">
      <div className="mb-4 flex flex-wrap gap-2">
        {floorNos.map((f) => {
          const n = onFloor(f).length;
          return (
            <button key={f} type="button" onClick={() => { setFloor(f); setError(""); }} className={`rounded-full px-4 py-2 text-sm ${floor === f ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
              Floor {f} · {n} {n === 1 ? "flat" : "flats"}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-cream/60 p-4">
        <p className="font-medium">{here.length === 0 ? `How many flats on floor ${floor}?` : `Flats on floor ${floor}`}</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Number of flats</span>
            <input className={`${sm} w-32`} type="number" min={0} max={MAX_PER_FLOOR} value={count[floor] ?? String(here.length || "")} onChange={(e) => setCount((c) => ({ ...c, [floor]: e.target.value }))} />
          </label>
          <button type="button" onClick={applyCount} className={primaryBtn}>{here.length === 0 ? "Generate flats" : "Update"}</button>
        </div>
      </div>

      {here.length > 0 && (
        <div className="mt-4 grid gap-3">
          {here.map((r, i) => (
            <div key={`${floor}-${i}`} className="rounded-2xl bg-cream/60 p-4">
              <p className="mb-3 font-medium">{flatNo(r.label) ? `Flat ${flatNo(r.label)}` : `Flat ${i + 1}`}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <F label="Flat number"><input className={sm} value={flatNo(r.label)} onChange={(e) => patch(r, { label: e.target.value.trim() ? `Flat ${e.target.value}` : "" })} placeholder="e.g. 101" /></F>
                <F label="Occupancy type">
                  <select className={sm} value={r.roomType} onChange={(e) => patch(r, { roomType: e.target.value })}>
                    <option value="SINGLE">Single</option>
                    <option value="SHAREABLE">Shareable</option>
                  </select>
                </F>
                <F label="Rent (₹ / month)"><input className={sm} type="number" min={0} value={r.rent} onChange={(e) => patch(r, { rent: e.target.value })} /></F>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <F label="BHK">
                  <select className={sm} value={r.bhk ?? ""} onChange={(e) => patch(r, { bhk: e.target.value })}>
                    {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n} BHK</option>)}
                  </select>
                </F>
                <F label="Bathrooms"><input className={sm} type="number" min={1} max={20} value={r.baths ?? ""} onChange={(e) => patch(r, { baths: e.target.value })} /></F>
                <F label="Area (m²)"><input className={sm} type="number" min={0} step="any" value={r.sizeSqm} onChange={(e) => patch(r, { sizeSqm: e.target.value })} /></F>
                <F label="Furnishing">
                  <select className={sm} value={r.furnishing ?? ""} onChange={(e) => patch(r, { furnishing: e.target.value })}>
                    <option value="">Select</option>
                    {FURNISH_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </F>
              </div>
              <div className="mt-3">
                <p className="mb-2 text-sm font-medium">Flat photos <span className="text-muted-foreground">({r.photos.length}/{MAX_PHOTOS})</span></p>
                <div className="flex flex-wrap gap-3">
                  {r.photos.map((p) => (
                    <div key={p.key} className="relative h-20 w-28 overflow-hidden rounded-xl bg-cream">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.src} alt="" className="h-full w-full object-cover" />
                      <button type="button" aria-label="Remove photo" onClick={() => patch(r, { photos: r.photos.filter((x) => x.key !== p.key) })} className="absolute right-1 top-1 rounded-full bg-background p-1 text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                  {r.photos.length < MAX_PHOTOS && (
                    <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-background text-xs text-muted-foreground hover:bg-muted">
                      <ImagePlus className="h-5 w-5" />Add photo
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => {
                        const picked = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - r.photos.length);
                        patch(r, { photos: [...r.photos, ...picked.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, src: URL.createObjectURL(file), file }))] });
                        e.target.value = "";
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{isShareable(r) ? "Shareable: add as many residents as you need when allocating." : "Single: rented to one tenant."}</p>
            </div>
          ))}
        </div>
      )}

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
              : flats.length === 0 ? `${floorCount} floors declared. Generate them and add the flats on each floor.`
              : `${floorCount} floors · ${flats.length} ${flats.length === 1 ? "flat" : "flats"}${rents.length ? ` · from ${inr(Math.min(...rents))}` : ""}`}
          </p>
        </div>
        <button type="button" onClick={onOpen} disabled={floorCount < 1} className={primaryBtn}>{flats.length ? "Edit flats" : "Generate floors & add flats"}</button>
      </div>
      {flats.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {floorNos.map((f) => {
            const list = flats.filter((x) => Number(x.floor) === f);
            const sh = list.filter(isShareable).length;
            return (
              <li key={f} className="flex flex-wrap justify-between gap-x-3">
                <span>Floor {f}</span>
                <span className="text-muted-foreground">{list.length ? `${list.map((x) => `${flatNo(x.label)} (${x.bhk} BHK)`).join(", ")} · ${list.length - sh} single, ${sh} shareable` : "No flats yet"}</span>
              </li>
            );
          })}
        </ul>
      )}
      {issue && <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{issue}</p>}
    </div>
  );
}
