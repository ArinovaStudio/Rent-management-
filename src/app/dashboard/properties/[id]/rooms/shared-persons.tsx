"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Users, X } from "lucide-react";
import AllocationActions from "./allocation-actions";

export type SharedPerson = { id: string; name: string; phone: string; email: string | null; moveIn: string; docs: number };

// Button + popup with the people sharing a flat with its main tenant. They have no link or bills of their own.
export default function SharedPersons({ flat, persons }: { flat: string; persons: SharedPerson[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label={`Shared persons in ${flat}`}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Shared persons · {flat}</h3>
            <p className="text-sm text-muted-foreground">They share this flat with the main tenant. Rent, bills and the resident link belong to the main tenant.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {persons.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-cream/60 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">{p.phone}{p.email ? ` · ${p.email}` : ""}</p>
                <p className="text-muted-foreground">Move-in {p.moveIn} · {p.docs} document(s)</p>
              </div>
              <AllocationActions allocationId={p.id} residentUrl="" housemate />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm hover:bg-background/70">
        <Users className="h-4 w-4" />View details of shared persons ({persons.length})
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
