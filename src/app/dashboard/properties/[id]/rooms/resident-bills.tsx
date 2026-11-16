"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/fetch-auth";

type Bill = { id: string; type: "ELECTRICITY" | "WATER"; period: string; amount: number; note: string | null; paid: boolean };

const LABEL = { ELECTRICITY: "Electricity", WATER: "Water" } as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ResidentBills({ allocationId, bills }: { allocationId: string; bills: Bill[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<Bill["type"]>("ELECTRICITY");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/allocations/${allocationId}/bills`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return false; }
    router.refresh();
    return true;
  }
  const save = async () => {
    if (await call("POST", { type, period, amount, note, paid })) { setAmount(""); setNote(""); setPaid(false); }
  };
  const edit = (b: Bill) => { setType(b.type); setPeriod(b.period); setAmount(String(b.amount)); setNote(b.note ?? ""); setPaid(b.paid); };

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-full bg-background px-4 py-1.5 text-sm hover:bg-cream">
        {open ? "Hide bills" : `Electricity & water bills (${bills.length})`}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-2xl bg-background p-4">
          {bills.length === 0 ? (
            <p className="text-muted-foreground">No bills added yet.</p>
          ) : (
            <ul className="divide-y divide-cream">
              {bills.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {monthLabel(b.period)} · {LABEL[b.type]} · <strong>{inr(b.amount)}</strong> · {b.paid ? "Paid" : "Due"}
                    {b.note && <span className="block text-xs text-muted-foreground">{b.note}</span>}
                  </span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => edit(b)} className="text-primary underline">Edit</button>
                    <button type="button" disabled={busy} onClick={() => call("DELETE", { billId: b.id })} className="text-destructive disabled:opacity-40">Delete</button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <select className="field" value={type} onChange={(e) => setType(e.target.value as Bill["type"])}>
              <option value="ELECTRICITY">Electricity</option>
              <option value="WATER">Water</option>
            </select>
            <input className="field" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <input className="field" type="number" min={0} placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="field" maxLength={300} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={paid} onChange={(e) => setPaid(e.target.checked)} />Paid
            </label>
            <button type="button" disabled={busy} onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-ink disabled:opacity-60">
              {busy ? "Saving…" : "Save bill"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Saving the same type and month again updates that bill.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
