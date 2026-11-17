"use client";
import { Check } from "lucide-react";
import { PG_MAX_SEATS, catKey, sameCat, sortCats, type PgCategory } from "@/lib/pg-config";
import { sm } from "./room-types";

// Step 1 of the PG setup: tick the room categories this PG offers and set the base rent of each.
// Floors then pick from these, so rent is typed once per category here (a floor can add + or - on top).
export default function PgCategoriesCard({ categories, roomsByKey, onChange }: {
  categories: PgCategory[];
  roomsByKey: Record<string, number>;
  onChange: (next: PgCategory[]) => void;
}) {
  const find = (capacity: number, ac: boolean) => categories.find((c) => sameCat(c, { capacity, ac }));
  const toggle = (capacity: number, ac: boolean) => {
    const cur = find(capacity, ac);
    onChange(cur ? categories.filter((c) => c !== cur) : sortCats([...categories, { capacity, ac, rent: "", attached: false }]));
  };
  const setRent = (capacity: number, ac: boolean, rent: string) =>
    onChange(categories.map((c) => (sameCat(c, { capacity, ac }) ? { ...c, rent } : c)));

  const setAttached = (capacity: number, ac: boolean, attached: boolean) =>
    onChange(categories.map((c) => (sameCat(c, { capacity, ac }) ? { ...c, attached } : c)));

  const tile = (capacity: number, ac: boolean) => {
    const cur = find(capacity, ac);
    const n = roomsByKey[catKey({ capacity, ac })] ?? 0;
    return (
      <div className={`rounded-2xl border p-3 transition-colors ${cur ? "border-primary bg-primary/5" : "border-transparent bg-background"}`}>
        <button type="button" aria-pressed={!!cur} onClick={() => toggle(capacity, ac)} className="flex w-full items-center gap-2 text-left text-sm">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${cur ? "bg-primary text-primary-foreground" : "bg-cream"}`}>{cur && <Check className="h-3 w-3" />}</span>
          <span className={cur ? "font-medium" : "text-muted-foreground"}>{ac ? "AC" : "Non-AC"}</span>
          {cur && n > 0 && <span className="ml-auto text-xs text-muted-foreground">{n} {n === 1 ? "room" : "rooms"}</span>}
        </button>
        {cur && (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Attached washroom?</span>
            <div className="flex rounded-full bg-cream p-0.5">
              {([true, false] as const).map((v) => (
                <button key={String(v)} type="button" aria-pressed={cur.attached === v} onClick={() => setAttached(capacity, ac, v)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${cur.attached === v ? "bg-primary text-primary-foreground" : "hover:text-foreground"}`}>{v ? "Yes" : "No"}</button>
              ))}
            </div>
          </div>
        )}
        {cur && (
          <label className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            Rent per person / month (₹)
            <input className={sm} type="number" min={0} step={1} required value={cur.rent} onChange={(e) => setRent(capacity, ac, e.target.value)} placeholder="e.g. 6500" />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-cream/60 p-4 sm:col-span-2">
      <p className="font-medium">1. Room categories & rent</p>
      <p className="mb-3 text-sm text-muted-foreground">Tick every category you offer, say whether it has an attached washroom, and set its rent once. Floors pick from these, and rooms get this rent automatically.</p>
      <div className="space-y-2">
        {Array.from({ length: PG_MAX_SEATS }, (_, i) => i + 1).map((n) => (
          <div key={n} className="grid items-start gap-2 sm:grid-cols-[6rem_1fr_1fr]">
            <p className="pt-3 text-sm font-medium">{n}-seater</p>
            {tile(n, false)}
            {tile(n, true)}
          </div>
        ))}
      </div>
    </div>
  );
}