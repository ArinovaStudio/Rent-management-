"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Receipt, X } from "lucide-react";

export type BillPerson = { id: string; name: string; phone: string; email: string | null; rent: number; moveIn: string };
export type BillRoom = { id: string; label: string; floor: number | null; category: string; people: BillPerson[] };

type Kind = "ELECTRICITY" | "WATER";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const lbl = "grid gap-1.5 text-sm";

// Pick who the bill is for and which kind. The units, rate and tax are filled in on the invoice page this opens.
export default function GenerateBill({ rooms }: { rooms: BillRoom[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [roomId, setRoomId] = useState("");
  const [personId, setPersonId] = useState("");
  const [kind, setKind] = useState<Kind>("ELECTRICITY");
  const [error, setError] = useState("");
  const [going, setGoing] = useState(false);

  const room = rooms.find((r) => r.id === roomId);
  const person = room?.people.find((p) => p.id === personId) ?? room?.people[0];

  function close() {
    setOpen(false); setRoomId(""); setPersonId(""); setKind("ELECTRICITY"); setError(""); setGoing(false);
  }

  function generate() {
    if (!person) return setError("Select a room first.");
    setGoing(true);
    router.push(`/dashboard/bills/new?allocation=${encodeURIComponent(person.id)}&type=${kind}`);
  }

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Generate bill">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Generate bill</h3>
            <p className="text-sm text-muted-foreground">Choose the resident and the bill type. You enter the units and rate on the invoice page next.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

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

              <label className={lbl}><span className="font-medium">Bill type</span>
                <select className="field" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  <option value="ELECTRICITY">Electricity</option>
                  <option value="WATER">Water</option>
                </select>
              </label>
            </>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="button" disabled={going || !room} onClick={generate} className="w-full rounded-full bg-primary px-5 py-3 text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
            {going ? "Opening…" : "Generate Bill"}
          </button>
        </div>
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
