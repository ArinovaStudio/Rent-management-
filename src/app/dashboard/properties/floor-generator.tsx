"use client";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import ConfigModal from "./config-modal";
import { F } from "./property-sections";
import { buildPgRooms } from "./pg-plan";
import { sm, type RoomState } from "./room-types";
import {
  catKey, catName, emptyFloor, finalRent, floorBaths, floorIssue, needsCommon, planIssues, sameCat, sortCats, splitEvenly,
  type PgCategory, type PgFloor, type PgPlan,
} from "@/lib/pg-config";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Floor generator (PG), one floor at a time:
// rooms on the floor -> bathrooms on the floor -> tick the categories -> rooms are generated with their rent.
// Switch floors with the tabs. Works on a draft; the form only changes when "Save floors" is pressed.
export default function FloorGeneratorModal({ floorCount, plan, baseRooms, onSave, onClose }: {
  floorCount: number;
  plan: PgPlan;
  baseRooms: RoomState[];
  onSave: (floors: PgFloor[]) => void;
  onClose: () => void;
}) {
  const categories = plan.categories;
  const floorNos = Array.from({ length: floorCount }, (_, i) => i + 1);

  const [floors, setFloors] = useState<PgFloor[]>(() =>
    floorNos.map((f) => {
      const saved = plan.floors.find((x) => x.floor === f);
      return saved ?? emptyFloor(f);
    })
  );
  const [active, setActive] = useState(1);
  const [error, setError] = useState("");

  const cur = floors.find((f) => f.floor === active) ?? emptyFloor(active);
  const patch = (f: number, p: Partial<PgFloor>) => setFloors((fs) => fs.map((x) => (x.floor === f ? { ...x, ...p } : x)));
  const split = (cats: PgFloor["cats"], rooms: string) => {
    const parts = splitEvenly(Math.max(0, Math.floor(Number(rooms) || 0)), cats.length);
    return cats.map((c, i) => ({ ...c, qty: String(parts[i]) }));
  };
  const setRooms = (value: string) => {
    // with a single category there is nothing to choose: select it automatically
    const base = cur.cats.length === 0 && categories.length === 1 ? [{ capacity: categories[0].capacity, ac: categories[0].ac, qty: "0" }] : cur.cats;
    patch(active, { rooms: value, cats: split(base, value) });
  };
  const toggleCat = (cat: PgCategory) => {
    const on = cur.cats.some((c) => sameCat(c, cat));
    const next = on ? cur.cats.filter((c) => !sameCat(c, cat)) : sortCats([...cur.cats, { capacity: cat.capacity, ac: cat.ac, qty: "0" }]);
    patch(active, { cats: split(next, cur.rooms) });
  };
  const setQty = (cat: PgCategory, qty: string) => patch(active, { cats: cur.cats.map((c) => (sameCat(c, cat) ? { ...c, qty } : c)) });

  // Same rooms / bathrooms / categories on every floor. Each floor keeps its own rent adjustment.
  const copyToAll = () => setFloors((fs) => fs.map((f) => (f.floor === active ? f : { ...f, rooms: cur.rooms, bathrooms: cur.bathrooms, cats: cur.cats.map((c) => ({ ...c })) })));

  const built = useMemo(() => buildPgRooms({ categories, floors }, floorCount, baseRooms), [categories, floors, floorCount, baseRooms]);
  const preview = built.rooms.filter((r) => Number(r.floor) === active);
  const issueOf = (f: PgFloor) => floorIssue(f, categories);
  const totalRooms = floors.reduce((s, f) => s + (Number(f.rooms) || 0), 0);
  const totalBaths = floors.reduce((s, f) => s + floorBaths(f, categories), 0);
  const assigned = cur.cats.reduce((s, c) => s + (Number(c.qty) || 0), 0);
  const adjustNum = Number(cur.adjust) || 0;
  const attachedCats = cur.cats.filter((c) => categories.find((x) => sameCat(x, c))?.attached);
  const commonNeeded = needsCommon(cur, categories);

  function save() {
    const bad = floors.find((f) => issueOf(f));
    if (bad) { setActive(bad.floor); return setError(issueOf(bad)!); }
    const rest = planIssues({ categories, floors }, floorCount)[0];
    if (rest) return setError(rest);
    if (built.errors.length) return setError(built.errors[0]);
    onSave(floors);
  }

  return (
    <ConfigModal title="Floor generator" subtitle={`${floorCount} floors · ${totalRooms} rooms · ${totalBaths} bathrooms`} onClose={onClose} onSave={save} saveLabel="Save floors">
      <div className="mb-4 flex flex-wrap gap-2">
        {floors.map((f) => {
          const ok = !issueOf(f);
          return (
            <button key={f.floor} type="button" onClick={() => { setActive(f.floor); setError(""); }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${active === f.floor ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
              Floor {f.floor}
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${ok ? "bg-primary/20" : "bg-destructive/20 text-destructive"}`}>{ok ? <Check className="h-3 w-3" /> : "!"}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <F label={`Rooms on floor ${active}`}>
          <input className={sm} type="number" min={0} value={cur.rooms} onChange={(e) => setRooms(e.target.value)} />
        </F>
      </div>

      <div className="mt-4 rounded-2xl bg-cream/60 p-4">
        <p className="font-medium">Room categories on this floor</p>
        <p className="mb-3 text-sm text-muted-foreground">
          {cur.cats.length > 1 ? "Rooms are split evenly between the ticked categories. Change the numbers if you need a different mix." : "Tick the categories available on this floor."}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((cat) => {
            const sel = cur.cats.find((c) => sameCat(c, cat));
            const rent = finalRent(cat, cur.adjust);
            return (
              <div key={catKey(cat)} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${sel ? "border-primary bg-primary/5" : "border-transparent bg-background"}`}>
                <button type="button" aria-pressed={!!sel} onClick={() => toggleCat(cat)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${sel ? "bg-primary text-primary-foreground" : "bg-cream"}`}>{sel && <Check className="h-3 w-3" />}</span>
                  <span className="min-w-0">
                    <span className={`block truncate ${sel ? "font-medium" : "text-muted-foreground"}`}>{catName(cat)}</span>
                    <span className="block text-xs text-muted-foreground">{rent ? `${inr(Number(rent))} / person` : "No rent set"}{cat.attached ? " · attached washroom" : ""}</span>
                  </span>
                </button>
                {sel && cur.cats.length > 1 && (
                  <input aria-label={`${catName(cat)} rooms on floor ${active}`} className={`${sm} !w-20`} type="number" min={1} value={sel.qty} onChange={(e) => setQty(cat, e.target.value)} />
                )}
              </div>
            );
          })}
        </div>
        {cur.cats.length > 1 && (
          <p className={`mt-2 text-xs ${assigned === (Number(cur.rooms) || 0) ? "text-muted-foreground" : "text-destructive"}`}>{assigned} of {Number(cur.rooms) || 0} rooms assigned</p>
        )}
      </div>

      {cur.cats.length > 0 && (
        <div className="mt-4 rounded-2xl bg-cream/60 p-4 text-sm">
          <p className="font-medium">Washrooms</p>
          {attachedCats.length > 0 && <p className="text-muted-foreground">{attachedCats.map((c) => catName(c)).join(", ")} rooms have an attached washroom.</p>}
          {commonNeeded ? (
            <div className="mt-3 max-w-xs">
              <F label={`Common bathrooms on floor ${active}`}>
                <input className={sm} type="number" min={0} value={cur.bathrooms} onChange={(e) => patch(active, { bathrooms: e.target.value })} />
              </F>
              <p className="mt-1 text-xs text-muted-foreground">For rooms without an attached washroom. Enter 0 if there is none.</p>
            </div>
          ) : (
            <p className="text-muted-foreground">Every room on this floor has an attached washroom, so no common bathroom is needed.</p>
          )}
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-cream/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem]">
            <F label="Rent adjustment for this floor (₹ per person)">
              <input className={sm} type="number" step={1} value={cur.adjust} onChange={(e) => patch(active, { adjust: e.target.value })} placeholder="0" />
            </F>
          </div>
          <p className="flex-1 pb-3 text-xs text-muted-foreground">
            Added to every room&apos;s rent on this floor. Use 500 for a costlier top floor or -500 for a cheaper ground floor. Leave 0 to keep the category rent.
          </p>
        </div>
        {adjustNum !== 0 && <p className="mt-1 text-xs text-muted-foreground">{adjustNum > 0 ? "+" : "-"}{inr(Math.abs(adjustNum))} on floor {active}.</p>}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">Rooms that will be created on floor {active} ({preview.length})</p>
        {preview.length === 0
          ? <p className="rounded-2xl bg-cream/60 px-5 py-4 text-sm text-muted-foreground">Enter the number of rooms and tick a category to see the rooms here.</p>
          : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {preview.map((r, i) => (
                <div key={r.id ?? `${r.label}-${i}`} className="rounded-xl bg-cream/60 px-3 py-2 text-sm">
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.capacity}-seater{r.ac ? " AC" : ""} · {r.rent.trim() ? `${inr(Number(r.rent))}` : "no rent"}</p>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={copyToAll} disabled={floorCount < 2} className="rounded-full bg-cream px-5 py-2.5 text-sm disabled:opacity-40">Use this setup for all floors</button>
        {active < floorCount && <button type="button" onClick={() => { setActive(active + 1); setError(""); }} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">Next floor</button>}
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
    </ConfigModal>
  );
}