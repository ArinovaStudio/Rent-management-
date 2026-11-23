"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, History, Loader2, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

export type HistoryRow = {
  id: string; name: string; phone: string; email: string | null; role: string; floor: number; flat: string; bhk: number | null;
  people: number; rent: number; deposit: number; moveIn: string; moveOut: string; docs: number;
};
type Page = { floors: { floor: number; count: number }[]; floor: number; page: number; pages: number; total: number; pageSize: number; rows: HistoryRow[] };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Past tenants of the building: button + popup, one tab per floor. Nothing is loaded until the popup opens,
// and then only one floor / one page of 10 rows at a time. Rent, flat and floor are the values saved when the
// person lived there, so later changes to the flat never alter this list.
export default function BuildingHistory({ propertyId, count }: { propertyId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [want, setWant] = useState<{ floor: number | null; page: number }>({ floor: null, page: 1 });
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ page: String(want.page) });
    if (want.floor !== null) q.set("floor", String(want.floor));
    authFetch(`/api/properties/${propertyId}/history?${q}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (stale) return;
        if (!res.ok) setError(body.error ?? "Could not load the history.");
        else setData(body);
      })
      .catch(() => !stale && setError("Could not load the history."))
      .finally(() => !stale && setLoading(false));
    return () => { stale = true; };
  }, [open, want, propertyId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const rows = data?.rows ?? [];
  const cur = data?.page ?? 1;
  const pages = data?.pages ?? 1;
  const PAGE_SIZE = data?.pageSize ?? 10;

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
          {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
          {!data && loading && (
            <div className="space-y-3" aria-busy="true">
              <div className="flex gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-cream" />)}</div>
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-cream" />)}
            </div>
          )}
          {data && data.floors.length === 0 && <p className="text-sm text-muted-foreground">No past tenants yet.</p>}
          {data && data.floors.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {data.floors.map((f) => (
                  <button key={f.floor} type="button" onClick={() => setWant({ floor: f.floor, page: 1 })} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${data.floor === f.floor ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
                    Floor {f.floor}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${data.floor === f.floor ? "bg-primary-foreground/20" : "bg-background"}`}>{f.count}</span>
                  </button>
                ))}
                {loading && <Loader2 className="ml-1 h-5 w-5 animate-spin self-center text-muted-foreground" />}
              </div>
              <div className={`mt-4 overflow-x-auto rounded-2xl bg-cream/40 ${loading ? "opacity-60" : ""}`}>
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      {["Tenant", "Role", "Contact", "Floor", "Flat", "Living", "Rent / month", "Deposit", "Move-in", "Move-out", "Docs"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
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
                <span>Showing {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, data.total)} of {data.total}</span>
                {pages > 1 && (
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Previous page" disabled={cur === 1 || loading} onClick={() => setWant({ floor: data.floor, page: cur - 1 })} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <span>Page {cur} of {pages}</span>
                    <button type="button" aria-label="Next page" disabled={cur === pages || loading} onClick={() => setWant({ floor: data.floor, page: cur + 1 })} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
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
      <button type="button" onClick={() => { setWant({ floor: null, page: 1 }); setData(null); setOpen(true); }} className="flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70">
        <History className="h-4 w-4" />Tenant history{count > 0 && <span className="rounded-full bg-background px-2 py-0.5 text-[11px]">{count}</span>}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
