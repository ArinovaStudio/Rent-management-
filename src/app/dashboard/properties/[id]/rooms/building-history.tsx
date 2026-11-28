"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, History, Loader2, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

export type HistoryRow = {
  id: string; name: string; phone: string; email: string | null; role: string; floor: number; flat: string; bhk: number | null;
  people: number; rent: number; deposit: number; moveIn: string; moveOut: string; docIds: string[];
};
type Page = { floor: number; flatCounts: Record<string, number>; floorTotal: number; page: number; pages: number; total: number; pageSize: number; rows: HistoryRow[] };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Past tenants of ONE floor (the floor selected in the residents table): button + popup, one tab per flat.
// Nothing is loaded until the popup opens, then only one flat / one page of 10 rows at a time. Rent, flat and
// floor are the values saved when the person lived there, so later changes to the flat never alter this list.
export default function BuildingHistory({ propertyId, count, floor, flats }: { propertyId: string; count: number; floor: number; flats: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [want, setWant] = useState<{ roomId: string | null; page: number }>({ roomId: null, page: 1 });
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setLoading(true);
    setError("");
    const q = new URLSearchParams({ page: String(want.page), floor: String(floor) });
    if (want.roomId) q.set("roomId", want.roomId);
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
  }, [open, want, propertyId, floor]);

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
            <p className="text-sm text-muted-foreground">Floor {floor}: past tenants and housemates, flat by flat. Rent and flat are as they were when the person lived here.</p>
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
          {data && (
            <>
              <div className="flex flex-wrap gap-2">
                {[{ id: null as string | null, label: "All flats", n: data.floorTotal }, ...flats.map((f) => ({ id: f.id as string | null, label: f.label, n: data.flatCounts[f.id] ?? 0 }))].map((t) => {
                  const on = want.roomId === t.id;
                  return (
                    <button key={t.id ?? "all"} type="button" onClick={() => setWant({ roomId: t.id, page: 1 })} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${on ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
                      {t.label}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${on ? "bg-primary-foreground/20" : "bg-background"}`}>{t.n}</span>
                    </button>
                  );
                })}
                {loading && <Loader2 className="ml-1 h-5 w-5 animate-spin self-center text-muted-foreground" />}
              </div>
              {data.total === 0 ? <p className="mt-4 text-sm text-muted-foreground">No past tenants {want.roomId ? "in this flat" : `on floor ${floor}`} yet.</p> : <>
              <div className={`mt-4 overflow-x-auto rounded-2xl bg-cream/40 ${loading ? "opacity-60" : ""}`}>
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      {["Tenant", "Role", "Contact", "Floor", "Flat", "Living", "Rent / month", "Deposit", "Move-in", "Move-out", "ID proof"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
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
                        <td className="px-4 py-3">{r.role !== "Main tenant" ? <span className="text-muted-foreground">Covered by main tenant</span> : inr(r.rent)}</td>
                        <td className="px-4 py-3">{r.role !== "Main tenant" ? "—" : inr(r.deposit)}</td>
                        <td className="px-4 py-3">{r.moveIn}</td>
                        <td className="px-4 py-3">{r.moveOut}</td>
                        <td className="px-4 py-3">
                          {r.docIds.length === 0 ? "—" : r.docIds.map((d, i) => (
                            <a key={d} href={`/api/properties/${propertyId}/documents/${d}`} target="_blank" rel="noopener noreferrer" className="mr-2 inline-block rounded-full bg-cream px-3 py-1 text-xs hover:bg-cream/70">{r.docIds.length > 1 ? `View ${i + 1}` : "View"}</a>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>Showing {(cur - 1) * PAGE_SIZE + 1}–{Math.min(cur * PAGE_SIZE, data.total)} of {data.total}</span>
                {pages > 1 && (
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Previous page" disabled={cur === 1 || loading} onClick={() => setWant({ roomId: want.roomId, page: cur - 1 })} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <span>Page {cur} of {pages}</span>
                    <button type="button" aria-label="Next page" disabled={cur === pages || loading} onClick={() => setWant({ roomId: want.roomId, page: cur + 1 })} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              </>}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => { setWant({ roomId: null, page: 1 }); setData(null); setOpen(true); }} className="flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70">
        <History className="h-4 w-4" />Tenant history{count > 0 && <span className="rounded-full bg-background px-2 py-0.5 text-[11px]">{count}</span>}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
