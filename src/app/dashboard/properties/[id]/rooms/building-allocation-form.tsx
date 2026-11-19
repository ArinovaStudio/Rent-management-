"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, FileText, Loader2, Plus, UploadCloud, UserPlus, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

export type FlatSlot = { id: string; label: string; shareable: boolean; rent: number; living: number; bhk?: number | null };
export type BuildingFloor = { floor: number; flats: FlatSlot[] };
type Resident = { fullName: string; phone: string; email: string };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const MAX_FILES = 8;
const MAX_MB = 10;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const lbl = "flex flex-col gap-2 text-sm";

// Allocation for a Building. The tenant is entered once and can take several flats (on any floors) in one go;
// every flat still becomes its own independent allocation. A shareable flat also collects its other residents.
export default function BuildingAllocationForm({ propertyId, floors }: { propertyId: string; floors: BuildingFloor[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const allFlats = floors.flatMap((f) => f.flats);
  const isOpen = (f: FlatSlot) => f.shareable || f.living === 0; // a single flat takes one tenant; a shareable flat takes anyone
  const openCount = allFlats.filter(isOpen).length;
  const firstFloor = floors.find((f) => f.flats.some(isOpen))?.floor ?? floors[0]?.floor ?? 1;
  // picks[0] is the flat this person is being allocated to; the rest are other flats the same person rents.
  const [picks, setPicks] = useState<{ floor: number; roomId: string }[]>([{ floor: firstFloor, roomId: "" }]);
  const [more, setMore] = useState(false);
  const [residents, setResidents] = useState<Record<string, Resident[]>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [links, setLinks] = useState<{ name: string; flat: string; url: string }[]>([]);
  const [copied, setCopied] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const shown = more ? picks : picks.slice(0, 1);
  const selected = shown.map((p) => allFlats.find((f) => f.id === p.roomId)).filter((f): f is FlatSlot => !!f);
  const totalRent = selected.reduce((s, f) => s + (f.shareable && f.living > 0 ? 0 : f.rent), 0);
  const setPick = (i: number, p: Partial<{ floor: number; roomId: string }>) => { setError(""); setPicks((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x))); };
  const addPick = () => setPicks((l) => [...l, { floor: l[l.length - 1]?.floor ?? firstFloor, roomId: "" }]);
  const removePick = (i: number) => setPicks((l) => l.filter((_, k) => k !== i));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() { setOpen(false); setError(""); setDone(false); setLinks([]); setFiles([]); setPicks([{ floor: firstFloor, roomId: "" }]); setMore(false); setResidents({}); }
  const setRes = (id: string, list: Resident[]) => setResidents((r) => ({ ...r, [id]: list }));

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!OK_TYPES.includes(f.type)) { setError(`${f.name}: only PDF, JPG, PNG or WebP files are allowed.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { setError(`${f.name} is larger than ${MAX_MB} MB.`); continue; }
      if (next.length >= MAX_FILES) { setError(`You can upload up to ${MAX_FILES} documents.`); break; }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected.length === 0) return setError("Select a flat.");
    if (selected.length < shown.length) return setError("Choose a flat in every row, or remove the empty row.");
    for (const f of selected) {
      for (const r of residents[f.id] ?? []) {
        if (!r.fullName.trim() || !r.phone.trim()) return setError(`Flat ${f.label.replace(/^flat\s+/i, "")}: enter a name and phone for every resident you add.`);
      }
    }
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    fd.set("flats", JSON.stringify(selected.map((f) => ({ roomId: f.id, residents: f.shareable ? residents[f.id] ?? [] : [] }))));
    fd.delete("documents");
    files.forEach((f) => fd.append("documents", f));
    const res = await authFetch(`/api/properties/${propertyId}/allocations`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Could not allocate.");
    setLinks((body.links ?? []).map((l: { name: string; flat: string; url: string }) => ({ ...l, url: `${window.location.origin}${l.url}` })));
    setDone(true);
    router.refresh();
  }

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Allocate flats">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Allocate flats</h3>
            <p className="text-sm text-muted-foreground">Pick the flat and add the person. If they rent other flats, say so and pick those too. Each flat is allocated independently.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {done ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-lg space-y-4 rounded-3xl bg-primary/10 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-6 w-6" /></span>
              <p className="text-lg font-medium">{links.length === 0 ? "Person added" : links.length === 1 ? "Person allocated" : `${links.length} allocations created`}</p>
              <p className="text-sm text-muted-foreground">{links.length === 0 ? "This person shares a flat that already has a main tenant, so they use that tenant's link." : "Share each link with the main tenant of that flat. Anyone sharing the flat uses the same link."}</p>
              <ul className="space-y-2 text-left">
                {links.map((l) => (
                  <li key={l.url} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 text-sm">
                    <span className="min-w-0"><span className="block truncate font-medium">{l.name}</span><span className="block text-xs text-muted-foreground">{l.flat}</span></span>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(l.url); setCopied(l.url); }} className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground hover:bg-ink"><Copy className="h-3.5 w-3.5" />{copied === l.url ? "Copied" : "Copy link"}</button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={close} className="rounded-full bg-background px-5 py-2.5 text-sm ring-1 ring-cream hover:bg-cream">Done</button>
            </div>
          </div>
        ) : (
          <>
            <form ref={formRef} onSubmit={submit} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <p className="mb-3 text-sm font-semibold">1 · Flat</p>
                <div className="space-y-3">
                  {shown.map((p, i) => {
                    const onFloor = floors.find((f) => f.floor === p.floor)?.flats ?? [];
                    const taken = new Set(shown.filter((_, k) => k !== i).map((x) => x.roomId));
                    return (
                      <div key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                        <label className={lbl}><span className="font-medium">{i === 0 ? "Floor number" : "Other flat · floor"}</span>
                          <select className="field" value={p.floor} onChange={(e) => setPick(i, { floor: Number(e.target.value), roomId: "" })}>
                            {floors.map((f) => <option key={f.floor} value={f.floor}>Floor {f.floor}</option>)}
                          </select>
                        </label>
                        <label className={lbl}><span className="font-medium">Flat</span>
                          <select className="field" value={p.roomId} onChange={(e) => setPick(i, { roomId: e.target.value })}>
                            <option value="">Select a flat</option>
                            {onFloor.map((f) => (
                              <option key={f.id} value={f.id} disabled={!isOpen(f) || taken.has(f.id)}>
                                {f.label}{f.bhk ? ` · ${f.bhk} BHK` : ""} · {f.shareable ? `Shareable${f.living ? ` · ${f.living} living` : ""}` : f.living ? "Rented" : "Single"} · {inr(f.rent)}
                              </option>
                            ))}
                          </select>
                        </label>
                        {i > 0 && <button type="button" aria-label="Remove flat" onClick={() => removePick(i)} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-2xl bg-cream/60 p-4">
                  <p className="text-sm font-medium">Does this person rent any other flat?</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { setMore(true); if (picks.length < 2) addPick(); }} className={`rounded-full px-5 py-2 text-sm ${more ? "bg-primary text-primary-foreground" : "bg-background"}`}>Yes</button>
                    <button type="button" onClick={() => setMore(false)} className={`rounded-full px-5 py-2 text-sm ${!more ? "bg-primary text-primary-foreground" : "bg-background"}`}>No</button>
                  </div>
                  {more && <button type="button" onClick={addPick} className="mt-3 flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm"><Plus className="h-4 w-4" />Add another flat</button>}
                </div>
                {selected.length > 0 && (
                  <p className="mt-3 rounded-2xl bg-cream/60 px-4 py-3 text-sm">
                    {selected.length} {selected.length === 1 ? "flat" : "flats"} ({selected.map((f) => f.label.replace(/^flat\s+/i, "")).join(", ")}) · <strong>{inr(totalRent)}</strong> / month
                    {selected.some((f) => f.shareable && f.living > 0) ? " · rent of already-rented shareable flats is covered by their first tenant" : ""}
                  </p>
                )}
              </section>

              <section>
                <p className="mb-3 text-sm font-semibold">2 · Tenant details <span className="font-normal text-muted-foreground">(entered once for all selected flats)</span></p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={lbl}><span className="font-medium">Full name</span><input className="field" name="fullName" required /></label>
                  <label className={lbl}><span className="font-medium">Phone number</span><input className="field" name="phone" type="tel" required /></label>
                  <label className={lbl}><span className="font-medium">Email (optional)</span><input className="field" name="email" type="email" /></label>
                  <label className={lbl}><span className="font-medium">Move-in date</span><input className="field" name="moveInDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
                  <label className={lbl}><span className="font-medium">Security deposit per flat (₹)</span><input className="field" name="securityDeposit" type="number" min="0" defaultValue="0" /></label>
                </div>
              </section>

              {selected.some((f) => f.shareable) && (
                <section>
                  <p className="mb-3 text-sm font-semibold">3 · Residents of shareable flats <span className="font-normal text-muted-foreground">(optional, add as many as live there)</span></p>
                  <div className="space-y-3">
                    {selected.filter((f) => f.shareable).map((f) => {
                      const list = residents[f.id] ?? [];
                                            return (
                        <div key={f.id} className="rounded-2xl bg-cream/60 p-4">
                          <p className="font-medium">{f.label} <span className="text-xs font-normal text-muted-foreground">· {1 + list.length} {list.length === 0 ? "person" : "people"} added now</span></p>
                          {list.map((r, i) => (
                            <div key={i} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                              <input className="field !bg-background" placeholder="Full name" value={r.fullName} onChange={(e) => setRes(f.id, list.map((x, k) => (k === i ? { ...x, fullName: e.target.value } : x)))} />
                              <input className="field !bg-background" type="tel" placeholder="Phone" value={r.phone} onChange={(e) => setRes(f.id, list.map((x, k) => (k === i ? { ...x, phone: e.target.value } : x)))} />
                              <input className="field !bg-background" type="email" placeholder="Email (optional)" value={r.email} onChange={(e) => setRes(f.id, list.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))} />
                              <button type="button" aria-label="Remove resident" onClick={() => setRes(f.id, list.filter((_, k) => k !== i))} className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => setRes(f.id, [...list, { fullName: "", phone: "", email: "" }])} className="mt-3 flex items-center gap-2 rounded-full bg-background px-4 py-2 text-sm "><Plus className="h-4 w-4" />Add resident</button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <section>
                <p className="mb-3 text-sm font-semibold">{selected.some((f) => f.shareable) ? "4" : "3"} · Documents <span className="font-normal text-muted-foreground">(optional, kept for the tenant of each flat)</span></p>
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }} className="rounded-2xl border-2 border-dashed border-cream bg-cream/40 p-5 text-center">
                  <UploadCloud className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 text-sm font-medium">Drag files here or</p>
                  <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-ink"><Plus className="h-4 w-4" />Choose files</button>
                  <p className="mt-2 text-xs text-muted-foreground">ID proof, agreement etc. · PDF, JPG, PNG, WebP · max {MAX_MB} MB each · up to {MAX_FILES} files</p>
                  <input ref={fileRef} type="file" multiple accept={OK_TYPES.join(",")} className="sr-only" onChange={(e) => addFiles(e.target.files)} />
                </div>
                {files.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-2xl bg-cream/60 px-4 py-2.5 text-sm">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{size(f.size)}</span>
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, k) => k !== i))}><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {error && <p role="alert" className="rounded-2xl bg-destructive/10 px-5 py-3 text-sm text-destructive">{error}</p>}
            </form>
            <div className="flex justify-end gap-3 border-t border-cream p-4">
              <button type="button" onClick={close} className="rounded-full bg-cream px-6 py-3 hover:bg-cream/70">Cancel</button>
              <button type="button" disabled={busy} onClick={() => formRef.current?.requestSubmit()} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Allocating…" : selected.length > 1 ? `Allocate ${selected.length} flats` : "Allocate flat"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" disabled={openCount === 0} onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
        <UserPlus className="h-5 w-5" />Allocate flats
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
