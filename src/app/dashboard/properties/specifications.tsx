"use client";
import { useState, type ComponentType, type ReactNode } from "react";
import { Armchair, BedDouble, Bath, Building2, CalendarDays, Car, Compass, FileText, Layers, LayoutGrid, ScrollText } from "lucide-react";
import ConfigModal from "./config-modal";
import { F, Hint } from "./property-sections";
import { sm } from "./room-types";
import { FURNISHING, FACING, label } from "@/lib/property-fields";

// Every value is kept as a string, like the rest of the form
export type Specs = {
  bedrooms: string; bathrooms: string; floors: string; parking: string; furnishing: string;
  facing: string; titleDeed: string; yearBuilt: string; developer: string;
};
type Kind = { flatLike: boolean; isPG: boolean; isBuilding: boolean; sharing: boolean };

const primaryBtn = "rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40";

type Icon = ComponentType<{ className?: string }>;

// The values that are filled in, in the order they are shown
function filled(v: Specs, k: Kind): [string, string, Icon][] {
  const n = Number(v.parking);
  const rows: [string, string | false, Icon][] = [
    ["Bedrooms", k.flatLike && v.bedrooms, BedDouble],
    ["Bathrooms", k.flatLike && v.bathrooms, Bath],
    ["Floors", (k.isPG || k.isBuilding) && v.floors, Layers],
    ["Parking", (k.flatLike || k.isBuilding) && v.parking !== "" && `${n} vehicle ${n === 1 ? "space" : "spaces"}`, Car],
    ["Furnishing", k.flatLike && !!v.furnishing && label(v.furnishing), Armchair],
    ["Facing", v.facing, Compass],
    ["Title deed number", v.titleDeed, ScrollText],
    ["Year built", v.yearBuilt, CalendarDays],
    ["Developer", v.developer, Building2],
  ];
  return rows.filter((r): r is [string, string, Icon] => !!r[1]);
}

// Shown inside the Specifications section: what was saved in the popup, and the button that opens it
export function SpecificationsCard({ values, kind, onOpen }: { values: Specs; kind: Kind; onOpen: () => void }) {
  const rows = filled(values, kind);
  return (
    <div className="min-w-0 w-full overflow-hidden rounded-2xl bg-cream/60 p-4 sm:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm text-muted-foreground">{rows.length ? `${rows.length} ${rows.length === 1 ? "detail" : "details"} added` : "No specifications added yet."}</p>
        <button type="button" onClick={onOpen} className={`${primaryBtn} w-full shrink-0 sm:w-auto`}>{rows.length ? "Edit specifications" : "Add specifications"}</button>
      </div>
      {rows.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 xl:grid-cols-3">
          {rows.map(([k, v, Icon]) => (
            <div key={k} className="flex min-w-0 items-start gap-3 overflow-hidden rounded-xl bg-background px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1 overflow-hidden">
                <dt className="truncate text-xs text-muted-foreground">{k}</dt>
                <dd className="break-words font-medium leading-snug" title={v}>{v}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// A tinted group of inputs with a small icon title
function Group({ title, icon: Icon, children }: { title: string; icon: Icon; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-cream/60 p-4 sm:p-5">
      <div className="mb-4 flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <p className="min-w-0 font-medium">{title}</p>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

// Popup with the specification inputs. Works on a draft; the form only changes when Save is pressed.
export function SpecificationsModal({ values, kind, onSave, onClose }: { values: Specs; kind: Kind; onSave: (v: Specs) => void; onClose: () => void }) {
  const [d, setD] = useState<Specs>(values);
  const [error, setError] = useState("");
  const set = (p: Partial<Specs>) => setD((x) => ({ ...x, ...p }));
  const whole = (v: string, max?: number) => v.trim() === "" || (/^\d+$/.test(v.trim()) && (max === undefined || Number(v) <= max));

  function save() {
    if (kind.flatLike && !whole(d.bedrooms)) return setError("Bedrooms must be a whole number.");
    if (kind.flatLike && !whole(d.bathrooms)) return setError("Bathrooms must be a whole number.");
    if ((kind.isPG || kind.isBuilding) && !whole(d.floors)) return setError("Number of floors must be a whole number.");
    if ((kind.flatLike || kind.isBuilding) && !whole(d.parking, 100)) return setError("Parking spaces must be a whole number from 0 to 100.");
    const year = Number(d.yearBuilt);
    if (d.yearBuilt.trim() !== "" && (!whole(d.yearBuilt) || year < 1800 || year > new Date().getFullYear() + 10)) return setError("Enter a valid year built.");
    onSave(d);
  }

  return (
    <ConfigModal title="Specifications" subtitle="Details tenants see on the listing page" onClose={onClose} onSave={save} saveLabel="Save specifications">
      <div className="grid gap-4">
        <Group title="Layout" icon={LayoutGrid}>
          {kind.flatLike && (
            <F label={<>Bedrooms{kind.sharing && <Hint text="The most rooms you can configure in Room Configuration below." />}</>}>
              <input className={sm} type="number" min={0} value={d.bedrooms} onChange={(e) => set({ bedrooms: e.target.value })} placeholder="Number of bedrooms" />
            </F>
          )}
          {kind.flatLike && (
            <F label="Bathrooms"><input className={sm} type="number" min={0} value={d.bathrooms} onChange={(e) => set({ bathrooms: e.target.value })} placeholder="Number of bathrooms" /></F>
          )}
          {(kind.isPG || kind.isBuilding) && (
            <F label={<>Number of floors<Hint text="How many floors you will add rooms or flats to. Floors are numbered from 1." /></>}>
              <input className={sm} type="number" min={0} value={d.floors} onChange={(e) => set({ floors: e.target.value })} placeholder="e.g. 4" />
            </F>
          )}
        </Group>

        <Group title="Comfort & parking" icon={Car}>
          {(kind.flatLike || kind.isBuilding) && (
            <F label={<>Vehicle parking spaces<Hint text="Total number of vehicles that can be parked. One space is one vehicle. This is not the number of parking floors." /></>}>
              <input className={sm} type="number" min={0} max={100} value={d.parking} onChange={(e) => set({ parking: e.target.value })} placeholder="e.g. 10" />
            </F>
          )}
          {kind.flatLike && (
            <F label="Furnishing">
              <select className={sm} value={d.furnishing} onChange={(e) => set({ furnishing: e.target.value })}>
                <option value="">Not specified</option>
                {FURNISHING.map((f) => <option key={f} value={f}>{label(f)}</option>)}
              </select>
            </F>
          )}
          <F label="Facing">
            <select className={sm} value={d.facing} onChange={(e) => set({ facing: e.target.value })}>
              <option value="">Not specified</option>
              {FACING.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </F>
        </Group>

        <Group title="Legal & build" icon={FileText}>
          <F label="Title deed number"><input className={sm} maxLength={50} autoComplete="off" value={d.titleDeed} onChange={(e) => set({ titleDeed: e.target.value })} /></F>
          <F label="Year built"><input className={sm} type="number" min={1800} max={new Date().getFullYear() + 10} value={d.yearBuilt} onChange={(e) => set({ yearBuilt: e.target.value })} placeholder="e.g. 2022" /></F>
          <F label="Developer"><input className={sm} maxLength={120} value={d.developer} onChange={(e) => set({ developer: e.target.value })} placeholder="Enter developer name" /></F>
        </Group>
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
    </ConfigModal>
  );
}
