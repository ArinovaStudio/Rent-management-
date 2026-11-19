"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type BuildingResidentRow = {
  id: string; name: string; phone: string; email: string | null; floor: number; flat: string; bhk: number | null;
  people: number; rent: number; moveIn: string;
};

const PAGE_SIZE = 10;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Main tenant of every flat in a table: one tab per floor, paginated, so the whole list is never shown at once.
export default function BuildingResidentsTable({ floors, rows }: { floors: number[]; rows: BuildingResidentRow[] }) {
  const [floor, setFloor] = useState(floors.find((f) => rows.some((r) => r.floor === f)) ?? floors[0] ?? 1);
  const [page, setPage] = useState(1);

  const list = rows.filter((r) => r.floor === floor);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const slice = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {floors.map((f) => {
          const n = rows.filter((r) => r.floor === f).length;
          return (
            <button key={f} type="button" onClick={() => { setFloor(f); setPage(1); }} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${floor === f ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
              Floor {f}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${floor === f ? "bg-primary-foreground/20" : "bg-background"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No tenants on floor {floor}.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-2xl bg-cream/40">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  {["Main tenant", "Contact", "Floor", "Flat", "Living", "Rent / month", "Move-in"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.id} className="border-t border-cream">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3"><span className="block">{r.phone}</span>{r.email && <span className="block text-xs text-muted-foreground">{r.email}</span>}</td>
                    <td className="px-4 py-3">{r.floor}</td>
                    <td className="px-4 py-3">{r.flat}{r.bhk ? <span className="block text-xs text-muted-foreground">{r.bhk} BHK</span> : null}</td>
                    <td className="px-4 py-3">{r.people} {r.people === 1 ? "person" : "people"}</td>
                    <td className="px-4 py-3">{inr(r.rent)}</td>
                    <td className="px-4 py-3">{r.moveIn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Showing {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, list.length)} of {list.length}</span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous page" disabled={cur === 1} onClick={() => setPage(cur - 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span>Page {cur} of {pages}</span>
                <button type="button" aria-label="Next page" disabled={cur === pages} onClick={() => setPage(cur + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
