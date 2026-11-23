"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, History, X } from "lucide-react";

export type HistoryRow = {
  id: string; name: string; phone: string; email: string | null; role: string; floor: number; flat: string; bhk: number | null;
  people: number; rent: number; deposit: number; moveIn: string; moveOut: string; docs: number;
};

const PAGE_SIZE = 10;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Past tenants of the building: button + popup, one tab per floor. Rent, flat and floor are the values saved
// when the person lived there, so later changes to the flat never alter this list.
export default function BuildingHistory({ rows }: { rows: HistoryRow[] }) {
  const floors = [...new Set(rows.map((r) => r.floor))].sort((a, b) => a - b);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [floor, setFloor] = useState(floors[0] ?? 1);
  const [page, setPage] = useState(1);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const list = rows.filter((r) => r.floor === floor);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const slice = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Tenant history">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Tenant history</h3>
            <p className="text-sm text-muted-foreground">Past tenants and housemates, floor by floor. Rent and flat are as they were when the person lived here.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past tenants yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {floors.map((f) => (
                  <button key={f} type="button" onClick={() => { setFloor(f); setPage(1); }} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${floor === f ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
                    Floor {f}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${floor === f ? "bg-primary-foreground/20" : "bg-background"}`}>{rows.filter((r) => r.floor === f).length}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto rounded-2xl bg-cream/40">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      {["Tenant", "Role", "Contact", "Floor", "Flat", "Living", "Rent / month", "Deposit", "Move-in", "Move-out", "Docs"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((r) => (
                      <tr key={r.id} className="border-t border-cream">
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3">{r.role}</td>
                        <td className="px-4 py-3"><span className="block">{r.phone}</span>{r.email && <span className="block text-xs text-muted-foreground">{r.email}</span>}</td>
                        <td className="px-4 py-3">{r.floor}</td>
                        <td className="px-4 py-3">{r.flat}{r.bhk ? <span className="block text-xs text-muted-foreground">{r.bhk} BHK</span> : null}</td>
                        <td className="px-4 py-3">{r.people} {r.people === 1 ? "person" : "people"}</td>
                        <td className="px-4 py-3">{r.role === "Housemate" ? <span className="text-muted-foreground">Covered by main tenant</span> : inr(r.rent)}</td>
                        <td className="px-4 py-3">{r.role === "Housemate" ? "—" : inr(r.deposit)}</td>
                        <td className="px-4 py-3">{r.moveIn}</td>
                        <td className="px-4 py-3">{r.moveOut}</td>
                        <td className="px-4 py-3">{r.docs}</td>
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
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => { setFloor(floors[0] ?? 1); setPage(1); setOpen(true); }} className="flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70">
        <History className="h-4 w-4" />Tenant history{rows.length > 0 && <span className="rounded-full bg-background px-2 py-0.5 text-[11px]">{rows.length}</span>}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
