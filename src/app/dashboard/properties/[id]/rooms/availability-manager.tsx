"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { Power, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

export type AvailRoom = { id: string; label: string; floor: number | null; active: boolean; note: string | null; living: number };

const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs ${on ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`;
const btn = "shrink-0 rounded-full bg-cream px-4 py-1.5 text-sm hover:bg-cream/70 disabled:cursor-not-allowed disabled:opacity-50";

export default function AvailabilityManager({ propertyId, propertyActive, propertyNote, rooms, roomWord }: {
  propertyId: string; propertyActive: boolean; propertyNote: string | null; rooms: AvailRoom[]; roomWord: string | null; // roomWord: "room" | "flat", null = no per-room list
}) {
  const refresh = useSoftRefresh();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [note, setNote] = useState("Under construction");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function change(roomId: string | null, active: boolean) {
    setBusy(roomId ?? "property");
    setError("");
    const res = await authFetch(`/api/properties/${propertyId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: roomId ?? undefined, active, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return setError(data.error ?? "Something went wrong.");
    refresh();
  }

  const floors = [...new Set(rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b);
  const inactiveCount = rooms.filter((r) => !r.active).length + (propertyActive ? 0 : 1);

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Availability">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Availability</h3>
            <p className="text-sm text-muted-foreground">Inactive units (for example under construction) can&apos;t be given to new residents.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason when marking inactive</span>
            <input className="field" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Under construction" />
          </label>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">Whole property</p>
              {!propertyActive && propertyNote && <p className="truncate text-xs text-muted-foreground">{propertyNote}</p>}
            </div>
            <span className={chip(propertyActive)}>{propertyActive ? "Active" : "Inactive"}</span>
            <button type="button" className={btn} disabled={busy !== ""} onClick={() => change(null, !propertyActive)}>
              {busy === "property" ? "…" : propertyActive ? "Mark inactive" : "Mark active"}
            </button>
          </div>

          {roomWord && rooms.length > 0 && floors.map((fl) => (
            <div key={fl}>
              <p className="mb-2 text-sm font-medium">Floor {fl}</p>
              <ul className="space-y-2">
                {rooms.filter((r) => (r.floor ?? 0) === fl).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-cream/60 px-4 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.living > 0 ? `${r.living} living here` : !r.active && r.note ? r.note : "Vacant"}
                      </span>
                    </span>
                    <span className={chip(r.active)}>{r.active ? "Active" : "Inactive"}</span>
                    <button type="button" className={btn} disabled={busy !== "" || (r.active && r.living > 0)} title={r.active && r.living > 0 ? "Check the residents out first" : undefined} onClick={() => change(r.id, !r.active)}>
                      {busy === r.id ? "…" : r.active ? "Mark inactive" : "Mark active"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">To make a {roomWord ?? "unit"} that has residents inactive, check them out first.</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-background px-6 py-3 hover:bg-cream">
        <Power className="h-5 w-5" />Availability{inactiveCount > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{inactiveCount} inactive</span>}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
