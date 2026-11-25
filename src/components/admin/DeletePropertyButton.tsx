"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";

// Delete a property. Opens a confirm box where the property name must be typed first.
// `variant="light"` is for the dark hover panel on the Super Admin cards.
export default function DeletePropertyButton({ propertyId, propertyName, variant = "default" }: { propertyId: string; propertyName: string; variant?: "default" | "light" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() { setOpen(false); setTyped(""); setError(""); }

  async function remove() {
    setBusy(true);
    setError("");
    const res = await authFetch(`/api/properties/${propertyId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    toast("Property deleted.");
    close();
    router.refresh();
  }

  const modal = (
    <div className="tw fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Delete property">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Delete property?</h3>
            <p className="text-sm text-muted-foreground">{propertyName}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            This cannot be undone. The property, its rooms, resident history, bills, payment records, tickets and uploaded files are all deleted.
          </p>
          <label className="grid gap-1.5 text-sm">
            <span>Type <strong>{propertyName}</strong> to confirm</span>
            <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className="rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70">Cancel</button>
            <button type="button" disabled={busy || typed.trim() !== propertyName.trim()} onClick={remove} className="rounded-full bg-destructive px-5 py-2.5 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Deleting…" : "Delete property"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm ${variant === "light" ? "bg-white/15 text-white hover:bg-red-500" : "bg-background font-medium text-destructive shadow-sm ring-1 ring-destructive/30 transition-colors hover:bg-destructive hover:text-white hover:ring-destructive"}`}
      >
        <Trash2 className="h-4 w-4" />Delete
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
