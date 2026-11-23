"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { Check, Receipt, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

export type BillPerson = { id: string; name: string; phone: string; email: string | null; rent: number; moveIn: string };
export type BillRoom = { id: string; label: string; floor: number | null; category: string; people: BillPerson[] };

type Kind = "ELECTRICITY" | "WATER";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const lbl = "grid gap-1.5 text-sm";

export default function GenerateBill({ rooms }: { rooms: BillRoom[] }) {
  const refresh = useSoftRefresh();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [roomId, setRoomId] = useState("");
  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState<Kind>("ELECTRICITY");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [units, setUnits] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const room = rooms.find((r) => r.id === roomId);
  const person = room?.people.find((p) => p.id === personId) ?? room?.people[0];
  const amount = Math.round(Number(units) * Number(rate));
  const ready = units !== "" && rate !== "" && Number(units) >= 0 && Number(rate) >= 0 && Number.isFinite(amount);
  const unitName = kind === "ELECTRICITY" ? "units (kWh)" : "units (kL)";

  function close() {
    setOpen(false); setRoomId(""); setPersonId(""); setKind("ELECTRICITY"); setUnits(""); setRate(""); setError(""); setDone(null);
  }

  async function generate() {
    if (!person) return setError("Select a room first.");
    if (!ready) return setError("Enter the units and the rate.");
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/allocations/${person.id}/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: kind, period, amount, note: `${units} ${kind === "ELECTRICITY" ? "units" : "kL"} × ${inr(Number(rate))}`, paid: false }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    setDone(amount);
    refresh();
  }

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Generate bill">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Generate bill</h3>
            <p className="text-sm text-muted-foreground">The bill shows up on the resident&apos;s invoice and payment page.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {done !== null ? (
          <div className="p-6">
            <div className="space-y-3 rounded-3xl bg-primary/10 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-6 w-6" /></span>
              <p className="text-lg font-medium">Bill generated · {inr(done)}</p>
              <p className="text-sm text-muted-foreground">{person?.name} · {room?.label}</p>
              <button type="button" onClick={close} className="rounded-full bg-background px-5 py-2.5 text-sm ring-1 ring-cream hover:bg-cream">Done</button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <label className={lbl}><span className="font-medium">Room / flat</span>
              <select className="field" value={roomId} onChange={(e) => { setRoomId(e.target.value); setPersonId(""); setError(""); }}>
                <option value="">Select room / flat</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.floor != null ? `Floor ${r.floor} · ` : ""}{r.label}</option>)}
              </select>
            </label>

            {room && (
              <>
                {room.people.length > 1 && (
                  <label className={lbl}><span className="font-medium">Person</span>
                    <select className="field" value={person?.id} onChange={(e) => setPersonId(e.target.value)}>
                      {room.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                )}
                {person && (
                  <div className="rounded-2xl bg-cream/60 p-4 text-sm">
                    <p className="font-medium">{person.name}</p>
                    <p className="text-muted-foreground">{person.phone}{person.email ? ` · ${person.email}` : ""}</p>
                    <p className="text-muted-foreground">{room.label}{room.floor != null ? ` · Floor ${room.floor}` : ""} · {room.category}</p>
                    <p className="text-muted-foreground">{inr(person.rent)}/month · Move-in {person.moveIn}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className={lbl}><span className="font-medium">Bill type</span>
                    <select className="field" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                      <option value="ELECTRICITY">Electricity</option>
                      <option value="WATER">Water</option>
                    </select>
                  </label>
                  <label className={lbl}><span className="font-medium">Month</span>
                    <input className="field" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
                  </label>
                  <label className={lbl}><span className="font-medium">Consumed {unitName}</span>
                    <input className="field" type="number" min={0} step="any" value={units} onChange={(e) => setUnits(e.target.value)} />
                  </label>
                  <label className={lbl}><span className="font-medium">Rate per unit (₹)</span>
                    <input className="field" type="number" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
                  </label>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Bill amount</span>
                  <span className="text-xl font-medium">{ready ? inr(amount) : "—"}</span>
                </div>
                <p className="text-xs text-muted-foreground">Generating the same type and month again replaces that bill.</p>
              </>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button type="button" disabled={busy || !room || !ready} onClick={generate} className="w-full rounded-full bg-primary px-5 py-3 text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Generating…" : "Generate bill"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" disabled={rooms.length === 0} onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-background px-6 py-3 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50">
        <Receipt className="h-5 w-5" />Generate bill
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
