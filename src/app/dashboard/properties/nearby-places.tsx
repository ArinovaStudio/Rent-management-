"use client";
import { GraduationCap, Dumbbell, Landmark, MapPin, ShoppingBag, Stethoscope, Trees, Train, Utensils, X } from "lucide-react";
import type { Pair } from "./property-sections";

const CATEGORIES = [
  { name: "Hospital", search: "hospitals", icon: Stethoscope, words: ["hospital", "clinic", "medical", "pharmacy"] },
  { name: "School", search: "schools colleges", icon: GraduationCap, words: ["school", "college", "university", "institute", "academy"] },
  { name: "Metro / Bus", search: "metro station bus stop", icon: Train, words: ["metro", "bus", "station", "railway", "airport"] },
  { name: "Market", search: "supermarket market", icon: ShoppingBag, words: ["market", "mall", "mart", "store"] },
  { name: "Restaurant", search: "restaurants", icon: Utensils, words: ["restaurant", "cafe", "café", "food"] },
  { name: "Bank / ATM", search: "bank atm", icon: Landmark, words: ["bank", "atm"] },
  { name: "Park", search: "parks", icon: Trees, words: ["park", "garden"] },
  { name: "Gym", search: "gym", icon: Dumbbell, words: ["gym", "fitness"] },
] as const;

const iconFor = (name: string) => CATEGORIES.find((c) => c.words.some((w) => name.toLowerCase().includes(w)))?.icon ?? MapPin;
const MAX_PLACES = 20; // the server accepts up to 20

export default function NearbyPlaces({ rows, onChange, onFocus }: {
  rows: Pair[];
  onChange: (r: Pair[]) => void;
  onFocus: (query: string | null) => void;
}) {
  const set = (i: number, patch: Partial<Pair>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const nearest = rows.filter((r) => r.a.trim() && Number(r.b) > 0).sort((a, b) => Number(a.b) - Number(b.b))[0];

  return (
    <div className="space-y-4 sm:col-span-2">
      <div>
        <p className="mb-2 text-sm font-medium">Add a place</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.name} type="button"
              onClick={() => { if (rows.length < MAX_PLACES) onChange([...rows, { a: c.name, b: "" }]); onFocus(c.search); }}
              className="flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm hover:bg-muted">
              <c.icon className="h-4 w-4" />{c.name}
            </button>
          ))}
          <button type="button" onClick={() => rows.length < MAX_PLACES && onChange([...rows, { a: "", b: "" }])}
            className="flex items-center gap-2 rounded-full border border-dashed border-muted-foreground/40 px-4 py-2 text-sm hover:bg-cream">
            <MapPin className="h-4 w-4" />Other
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Tapping a category adds a row and shows matching places around the property on the map above.</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-cream/60 px-5 py-6 text-center text-sm text-muted-foreground">No nearby places yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => {
            const Icon = iconFor(r.a);
            return (
              <li key={i} className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream/60 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background"><Icon className="h-5 w-5" /></span>
                <input className="field min-w-0 flex-1" maxLength={60} placeholder="Place name" value={r.a} onChange={(e) => set(i, { a: e.target.value })} />
                <div className="relative w-32">
                  <input className="field pr-10" type="number" min={0} step="any" placeholder="0.0" value={r.b} onChange={(e) => set(i, { b: e.target.value })} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                </div>
                <button type="button" aria-label="Show on map" onClick={() => onFocus(r.a.trim() || null)} className="rounded-full bg-background p-2.5 hover:bg-muted"><MapPin className="h-4 w-4" /></button>
                <button type="button" aria-label="Remove place" onClick={() => onChange(rows.filter((_, k) => k !== i))} className="rounded-full bg-background p-2.5 text-destructive hover:bg-muted"><X className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
      {nearest && <p className="px-1 text-xs text-muted-foreground">Nearest: {nearest.a} · {nearest.b} km</p>}
    </div>
  );
}