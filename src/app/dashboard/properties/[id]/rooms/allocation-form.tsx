"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Copy, FileText, Loader2, Plus, UploadCloud, UserPlus, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";

export type CatSlot = { capacity: number; ac: boolean; rent: number; beds: number; occupied: number };
export type FloorSlot = { floor: number; cats: CatSlot[] };
export type UnitOption = { id: string; label: string; category: string; floor: number | null; rent: number; capacity: number; occupied: number };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const catName = (c: { capacity: number; ac: boolean }) => `${c.capacity}-seater${c.ac ? " AC" : ""}`;
const MAX_FILES = 8;
const MAX_MB = 10;
const OK_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function AllocationForm({ propertyId, isPg, floors, units }: { propertyId: string; isPg: boolean; floors: FloorSlot[]; units: UnitOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const freeUnits = units.filter((u) => u.occupied < u.capacity);
  const totalFree = isPg
    ? floors.reduce((s, f) => s + f.cats.reduce((a, c) => a + (c.beds - c.occupied), 0), 0)
    : freeUnits.length;

  const firstFloorWithSpace = floors.find((f) => f.cats.some((c) => c.occupied < c.beds))?.floor ?? floors[0]?.floor ?? 1;
  const [floor, setFloor] = useState(firstFloorWithSpace);
  const [catKey, setCatKey] = useState("");
  const [unitId, setUnitId] = useState(freeUnits[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [residentUrl, setResidentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const curFloor = floors.find((f) => f.floor === floor);
  const selCat = curFloor?.cats.find((c) => `${c.capacity}-${c.ac}` === catKey && c.occupied < c.beds);
  const selUnit = freeUnits.find((u) => u.id === unitId) ?? freeUnits[0];
  const rent = isPg ? selCat?.rent : selUnit?.rent;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setError("");
    setResidentUrl("");
    setCopied(false);
    setFiles([]);
    setCatKey("");
  }

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
    if (isPg && !selCat) return setError("Select a room category first.");
    if (!isPg && !selUnit) return setError("Select a unit first.");
    setBusy(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    if (isPg && selCat) {
      fd.set("capacity", String(selCat.capacity));
      fd.set("ac", String(selCat.ac));
      fd.set("floor", String(floor));
    } else if (selUnit) {
      fd.set("roomId", selUnit.id);
    }
    fd.delete("documents");
    files.forEach((f) => fd.append("documents", f));

    const res = await authFetch(`/api/properties/${propertyId}/allocations`, { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Could not allocate this person.");
    setResidentUrl(`${window.location.origin}${body.residentUrl}`);
    router.refresh();
  }

  const lbl = "flex flex-col gap-2 text-sm";
  const lblText = "font-medium";

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Allocate a person">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Allocate a person</h3>
            <p className="text-sm text-muted-foreground">{isPg ? "Pick a floor and room category, then add the person's details." : "Pick a unit, then add the person's details."}</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {residentUrl ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-lg space-y-4 rounded-3xl bg-primary/10 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-6 w-6" /></span>
              <p className="text-lg font-medium">Person allocated</p>
              <p className="text-sm text-muted-foreground">Share this private link with the resident. They can see rent, bills and documents here.</p>
              <a className="block break-all rounded-2xl bg-background px-4 py-3 text-sm text-primary underline" href={residentUrl} target="_blank" rel="noreferrer">{residentUrl}</a>
              <div className="flex justify-center gap-2">
                <button type="button" onClick={() => { navigator.clipboard.writeText(residentUrl); setCopied(true); }} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-ink">
                  <Copy className="h-4 w-4" />{copied ? "Copied" : "Copy link"}
                </button>
                <button type="button" onClick={close} className="rounded-full bg-background px-5 py-2.5 text-sm ring-1 ring-cream hover:bg-cream">Done</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <form id="allocate-form" ref={formRef} onSubmit={submit} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* Step 1: where */}
              <section>
                <p className="mb-3 text-sm font-semibold">1 · {isPg ? "Floor & room category" : "Unit"}</p>
                {isPg ? (
                  <>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {floors.map((f) => {
                        const left = f.cats.reduce((s, c) => s + (c.beds - c.occupied), 0);
                        return (
                          <button key={f.floor} type="button" onClick={() => { setFloor(f.floor); setCatKey(""); setError(""); }}
                            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${floor === f.floor ? "bg-primary text-primary-foreground" : "bg-cream"}`}>
                            Floor {f.floor}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${floor === f.floor ? "bg-primary-foreground/20" : left === 0 ? "bg-destructive/10 text-destructive" : "bg-background"}`}>{left === 0 ? "Max" : `${left} free`}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(curFloor?.cats ?? []).map((c) => {
                        const key = `${c.capacity}-${c.ac}`;
                        const left = c.beds - c.occupied;
                        const full = left <= 0;
                        const on = catKey === key && !full;
                        return (
                          <button key={key} type="button" disabled={full} onClick={() => { setCatKey(key); setError(""); }}
                            className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left ${on ? "border-primary bg-primary/5" : "border-transparent bg-cream/60"} ${full ? "cursor-not-allowed opacity-60" : "hover:bg-cream"}`}>
                            <span>
                              <span className="block font-medium">{catName(c)}</span>
                              <span className="block text-xs text-muted-foreground">{inr(c.rent)} / person / month</span>
                            </span>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-xs ${full ? "bg-destructive/10 text-destructive" : "bg-background"}`}>{full ? "Max occupancy" : `${c.occupied}/${c.beds} · ${left} free`}</span>
                          </button>
                        );
                      })}
                      {(curFloor?.cats ?? []).length === 0 && <p className="text-sm text-muted-foreground">No rooms on this floor.</p>}
                    </div>
                  </>
                ) : (
                  <select className="field" value={selUnit?.id ?? ""} onChange={(e) => setUnitId(e.target.value)} required>
                    {freeUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.label} · {u.category}{u.floor != null ? ` · Floor ${u.floor}` : ""} · {inr(u.rent)}/month</option>
                    ))}
                  </select>
                )}
              </section>

              {/* Step 2: person */}
              <section>
                <p className="mb-3 text-sm font-semibold">2 · Person details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={lbl}><span className={lblText}>Full name</span><input className="field" name="fullName" required /></label>
                  <label className={lbl}><span className={lblText}>Phone number</span><input className="field" name="phone" type="tel" required /></label>
                  <label className={lbl}><span className={lblText}>Email (optional)</span><input className="field" name="email" type="email" /></label>
                  <label className={lbl}><span className={lblText}>Move-in date</span><input className="field" name="moveInDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
                  <label className={lbl}>
                    <span className={lblText}>Monthly rent</span>
                    <div className="field flex items-center justify-between !bg-cream/60">
                      <span className="font-medium">{rent != null ? inr(rent) : "Select a category"}</span>
                      <span className="text-xs text-muted-foreground">Set by property</span>
                    </div>
                  </label>
                  <label className={lbl}><span className={lblText}>Security deposit (₹)</span><input className="field" name="securityDeposit" type="number" min="0" defaultValue="0" /></label>
                </div>
              </section>

              {/* Step 3: documents */}
              <section>
                <p className="mb-3 text-sm font-semibold">3 · Documents <span className="font-normal text-muted-foreground">(optional)</span></p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                  className="rounded-2xl border-2 border-dashed border-cream bg-cream/40 p-5 text-center"
                >
                  <UploadCloud className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 text-sm font-medium">Drag files here or</p>
                  <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-ink">
                    <Plus className="h-4 w-4" />Choose files
                  </button>
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
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Allocating…" : "Allocate person"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" disabled={totalFree === 0} onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
        <UserPlus className="h-5 w-5" />Allocate a person
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
