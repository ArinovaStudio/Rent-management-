"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { BILL_LABEL, monthLabel } from "@/lib/bills";

export type LedgerBill = { id: string; type: "ELECTRICITY" | "WATER"; period: string; amount: number; paid: boolean; paidOn: string | null; note: string | null };
export type LedgerRow = {
  id: string; name: string; phone: string; email: string | null; floor: number; flat: string;
  rent: number; rentPaid: boolean; rentPaidOn: string | null; bills: LedgerBill[];
};

const PAGE_SIZE = 10;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const floorName = (f: number) => (f === 0 ? "Property" : `Floor ${f}`);
const badge = (paid: boolean) => `rounded-full px-3 py-1 text-xs ${paid ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`;
const btn = "flex items-center gap-1.5 rounded-full bg-background px-4 py-1.5 text-sm hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40";

function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  return createPortal(
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div><h3 className="text-xl font-medium">{title}</h3>{sub && <p className="text-sm text-muted-foreground">{sub}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// Rent and bill status of every main tenant, one tab per floor.
export default function LedgerTable({ floors, rows, period }: { floors: number[]; rows: LedgerRow[]; period: string }) {
  const router = useRouter();
  const [floor, setFloor] = useState(floors[0] ?? 0);
  const [page, setPage] = useState(1);
  const [billsFor, setBillsFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setMounted(true), []);

  const list = rows.filter((r) => r.floor === floor);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const slice = list.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  const billsRow = rows.find((r) => r.id === billsFor);
  const editRow = rows.find((r) => r.id === editFor);

  async function call(key: string, url: string, init: RequestInit, done?: string) {
    setBusy(key);
    setMsg(null);
    const res = await authFetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => ({}));
    setBusy("");
    setMsg({ ok: res.ok, text: body.message ?? (res.ok ? done ?? "Saved." : body.error ?? "Something went wrong.") });
    if (res.ok) router.refresh();
    return res.ok;
  }
  const setRent = (r: LedgerRow, paid: boolean) =>
    call(`rent-${r.id}`, `/api/allocations/${r.id}/rent`, { method: "POST", body: JSON.stringify({ period, paid }) }, "Rent status updated.");
  const setBill = (r: LedgerRow, billId: string, paid: boolean) =>
    call(`bill-${billId}`, `/api/allocations/${r.id}/bills`, { method: "PATCH", body: JSON.stringify({ billId, paid }) }, "Bill status updated.");
  const notifyRent = (r: LedgerRow) =>
    call(`nr-${r.id}`, `/api/allocations/${r.id}/notify`, { method: "POST", body: JSON.stringify({ kind: "RENT", period }) });
  const notifyBill = (r: LedgerRow, billId: string) =>
    call(`nb-${billId}`, `/api/allocations/${r.id}/notify`, { method: "POST", body: JSON.stringify({ kind: "BILL", billId }) });

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No tenants paying rent yet.</p>;

  return (
    <div>
      {msg && <p role="status" className={`mb-4 rounded-2xl px-5 py-3 text-sm ${msg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        {floors.map((f) => {
          const unpaid = rows.filter((r) => r.floor === f && !r.rentPaid).length;
          return (
            <button key={f} type="button" onClick={() => { setFloor(f); setPage(1); }} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${floor === f ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
              {floorName(f)}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${floor === f ? "bg-primary-foreground/20" : unpaid ? "bg-destructive/10 text-destructive" : "bg-background"}`}>{unpaid ? `${unpaid} unpaid` : "all paid"}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl bg-cream/40">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="text-muted-foreground">
              {["Tenant", "Contact", "Flat", "Rent", "Bills", "Reminder"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const unpaidBills = r.bills.filter((b) => !b.paid).length;
              return (
                <tr key={r.id} className="border-t border-cream align-top">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3"><span className="block">{r.phone}</span>{r.email && <span className="block text-xs text-muted-foreground">{r.email}</span>}</td>
                  <td className="px-4 py-3">{r.flat}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{inr(r.rent)}</span>
                      <span className={badge(r.rentPaid)}>{r.rentPaid ? "Paid" : "Unpaid"}</span>
                      <button type="button" aria-label={`Edit rent status of ${r.name}`} onClick={() => setEditFor(r.id)} className="rounded-full bg-background p-1.5 hover:bg-cream"><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                    {r.rentPaidOn && <span className="mt-1 block text-xs text-muted-foreground">Paid on {r.rentPaidOn}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setBillsFor(r.id)} className="text-primary underline">Bills</button>
                    <span className={`mt-1 block text-xs ${unpaidBills ? "text-destructive" : "text-muted-foreground"}`}>{r.bills.length === 0 ? "No bills" : unpaidBills ? `${unpaidBills} unpaid` : "All paid"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" disabled={r.rentPaid || busy === `nr-${r.id}`} onClick={() => notifyRent(r)} className={btn}>
                      <Bell className="h-4 w-4" />{busy === `nr-${r.id}` ? "Sending…" : "Notify for payment"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{list.length === 0 ? `No tenants on ${floorName(floor).toLowerCase()}.` : `Showing ${(cur - 1) * PAGE_SIZE + 1}–${Math.min(cur * PAGE_SIZE, list.length)} of ${list.length}`}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous page" disabled={cur === 1} onClick={() => setPage(cur - 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span>Page {cur} of {pages}</span>
            <button type="button" aria-label="Next page" disabled={cur === pages} onClick={() => setPage(cur + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-cream disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {mounted && editRow && (
        <Modal title="Edit rent status" sub={`${editRow.name} · ${editRow.flat} · ${monthLabel(period)}`} onClose={() => setEditFor(null)}>
          <p className="mb-4 text-sm text-muted-foreground">Rent {inr(editRow.rent)} for {monthLabel(period)} is currently <strong className="text-foreground">{editRow.rentPaid ? "paid" : "unpaid"}</strong>.</p>
          <div className="flex gap-3">
            <button type="button" disabled={editRow.rentPaid || !!busy} onClick={async () => { if (await setRent(editRow, true)) setEditFor(null); }} className="rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-40">Mark as paid</button>
            <button type="button" disabled={!editRow.rentPaid || !!busy} onClick={async () => { if (await setRent(editRow, false)) setEditFor(null); }} className="rounded-full bg-cream px-6 py-3 hover:bg-cream/70 disabled:opacity-40">Mark as unpaid</button>
          </div>
        </Modal>
      )}

      {mounted && billsRow && (
        <Modal title="Bills" sub={`${billsRow.name} · ${billsRow.flat}`} onClose={() => setBillsFor(null)}>
          {msg && <p role="status" className={`mb-4 rounded-2xl px-4 py-3 text-sm ${msg.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
          {billsRow.bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills have been added for this tenant.</p>
          ) : (
            <ul className="space-y-3">
              {billsRow.bills.map((b) => (
                <li key={b.id} className="rounded-2xl bg-cream/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{BILL_LABEL[b.type]} · {monthLabel(b.period)}</p>
                      <p className="text-sm text-muted-foreground">{inr(b.amount)}{b.note ? ` · ${b.note}` : ""}</p>
                      {b.paidOn && <p className="text-xs text-muted-foreground">Paid on {b.paidOn}</p>}
                    </div>
                    <span className={badge(b.paid)}>{b.paid ? "Paid" : "Unpaid"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={!!busy} onClick={() => setBill(billsRow, b.id, !b.paid)} className={btn}><Pencil className="h-4 w-4" />{b.paid ? "Mark unpaid" : "Mark paid"}</button>
                    <button type="button" disabled={b.paid || !!busy} onClick={() => notifyBill(billsRow, b.id)} className={btn}><Bell className="h-4 w-4" />{busy === `nb-${b.id}` ? "Sending…" : "Notify for payment"}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
