"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import BuildingHistory from "./building-history";

export type BuildingResidentRow = {
  id: string; name: string; phone: string; email: string | null; floor: number; flat: string; bhk: number | null;
  people: number; rent: number; moveIn: string;
  roomId: string; shared: boolean; vacant: boolean; // availability for new residents
};

const PAGE_SIZE = 10;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Main tenant of every flat in a table: one tab per floor, paginated, so the whole list is never shown at once.
export default function BuildingResidentsTable({ floors, rows, propertyId, historyCount, flats, canEditStatus }: {
  floors: number[]; rows: BuildingResidentRow[]; propertyId: string; historyCount: number; flats: { id: string; label: string; floor: number }[]; canEditStatus: boolean;
}) {
  const refresh = useSoftRefresh();
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only shared flats can be switched; a single flat is Non vacant while it is rented.
  async function setVacant(roomId: string, vacant: boolean) {
    setSaving(true);
    setError("");
    const res = await authFetch(`/api/properties/${propertyId}/vacancy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId, vacant }) });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    setEditing(null);
    if (!res.ok) return setError(body.error ?? "Could not change availability.");
    refresh();
  }

  const [floor, setFloor] = useState(floors.find((f) => rows.some((r) => r.floor === f)) ?? floors[0] ?? 1);
  const [page, setPage] = useState(1);

  const list = rows.filter((r) => r.floor === floor);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const slice = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        {/* History of the floor that is selected right now */}
        <BuildingHistory propertyId={propertyId} count={historyCount} floor={floor} flats={flats.filter((f) => f.floor === floor)} />
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No tenants on floor {floor}.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-2xl bg-cream/40">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  {["Main tenant", "Contact", "Floor", "Flat", "Living", "Availability", "Rent / month", "Move-in"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
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
                    <td className="px-4 py-3">
                      {editing === r.roomId ? (
                        <select autoFocus disabled={saving} defaultValue={r.vacant ? "vacant" : "non"} onBlur={() => setEditing(null)} onChange={(e) => setVacant(r.roomId, e.target.value === "vacant")} className="rounded-full bg-background px-3 py-1 text-xs">
                          <option value="vacant">Vacant</option>
                          <option value="non">Non vacant</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`rounded-full px-3 py-1 text-xs ${r.vacant ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{r.vacant ? "Vacant" : "Non vacant"}</span>
                          {canEditStatus && r.shared && <button type="button" aria-label={`Change availability of flat ${r.flat}`} title="Change availability" onClick={() => setEditing(r.roomId)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-cream"><Pencil className="h-3 w-3" /></button>}
                        </span>
                      )}
                    </td>
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
