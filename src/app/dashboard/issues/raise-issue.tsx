"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Megaphone, X } from "lucide-react";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL } from "@/lib/issue-constants";

export type RaiseProperty = {
  id: string;
  name: string;
  rooms: { id: string; label: string; floor: number | null; residents: { id: string; name: string }[] }[];
};

const lbl = "grid gap-1.5 text-sm";
const MAX_PHOTOS = 3;
const MAX_MB = 5;

// "Raise an issue" button + form card. Pass propertyId to lock it to one property (used on each property card).
export default function RaiseIssue({ properties, propertyId, label = "Raise an issue", variant = "soft" }: {
  properties: RaiseProperty[]; propertyId?: string; label?: string; variant?: "primary" | "soft";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [pid, setPid] = useState(propertyId ?? properties[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [roomId, setRoomId] = useState("");
  const [allocationId, setAllocationId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [neededBy, setNeededBy] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const property = properties.find((p) => p.id === pid);
  const rooms = property?.rooms ?? [];
  const residents = useMemo(() => {
    const list = roomId ? rooms.filter((r) => r.id === roomId) : rooms;
    return list.flatMap((r) => r.residents.map((x) => ({ ...x, room: r.label })));
  }, [rooms, roomId]);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function reset() {
    setCategory(""); setRoomId(""); setAllocationId(""); setTitle(""); setDescription("");
    setPriority("MEDIUM"); setNeededBy(""); setFiles([]); setError("");
  }
  function close() { if (!busy) { setOpen(false); setError(""); } }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_PHOTOS) { setError(`Add up to ${MAX_PHOTOS} photos.`); break; }
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setError(`${f.name}: only JPG, PNG or WebP.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { setError(`${f.name}: larger than ${MAX_MB} MB.`); continue; }
      next.push(f);
    }
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!category) return setError("Choose a category.");
    if (!title.trim() || !description.trim()) return setError("Add a title and a description.");
    setError("");
    setBusy(true);
    const fd = new FormData();
    fd.set("category", category);
    fd.set("title", title);
    fd.set("description", description);
    fd.set("priority", priority);
    if (roomId) fd.set("roomId", roomId);
    if (allocationId) fd.set("allocationId", allocationId);
    if (neededBy) fd.set("neededBy", neededBy);
    files.forEach((f) => fd.append("photos", f));

    try {
      const res = await authFetch(`/api/properties/${pid}/issues`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        toast(data.error ?? "Could not raise the issue.", "error");
        return;
      }
      toast(`Issue raised · Ticket #${data.ticketNo}`);
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network problem. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <div className="tw fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 text-foreground" role="dialog" aria-modal="true" aria-label="Raise an issue">
      <form onSubmit={submit} className="relative flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-background">
        <div className="flex items-start justify-between gap-4 border-b border-cream p-5">
          <div>
            <h3 className="text-xl font-medium">Raise an issue</h3>
            <p className="text-sm text-muted-foreground">Goes to the Property Admin who listed this property.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {!propertyId && properties.length > 1 ? (
            <label className={lbl}><span className="font-medium">Property</span>
              <select className="field" value={pid} onChange={(e) => { setPid(e.target.value); setRoomId(""); setAllocationId(""); }}>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="rounded-2xl bg-cream/60 px-4 py-3 text-sm"><span className="text-muted-foreground">Property · </span><span className="font-medium">{property?.name}</span></div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={lbl}><span className="font-medium">Category *</span>
              <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
            <label className={lbl}><span className="font-medium">Room / flat (optional)</span>
              <select className="field" value={roomId} onChange={(e) => { setRoomId(e.target.value); setAllocationId(""); }}>
                <option value="">Whole property</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.floor != null ? `Floor ${r.floor} · ` : ""}{r.label}</option>)}
              </select>
            </label>
          </div>

          <label className={lbl}><span className="font-medium">Title *</span>
            <input className="field" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary, e.g. Water leak in bathroom" />
          </label>
          <label className={lbl}><span className="font-medium">Description *</span>
            <textarea className="field" rows={4} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, since when, anything the owner should know" />
          </label>

          <div className={lbl}>
            <span className="font-medium">Priority *</span>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button key={p} type="button" aria-pressed={priority === p} onClick={() => setPriority(p)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${priority === p ? (p === "URGENT" || p === "HIGH" ? "bg-destructive text-white" : "bg-primary text-primary-foreground") : "bg-cream hover:bg-cream/70"}`}>
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={lbl}><span className="font-medium">Resident affected (optional)</span>
              <select className="field" value={allocationId} onChange={(e) => setAllocationId(e.target.value)} disabled={residents.length === 0}>
                <option value="">{residents.length === 0 ? "No residents" : "None"}</option>
                {residents.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.room}</option>)}
              </select>
            </label>
            <label className={lbl}><span className="font-medium">Needed by (optional)</span>
              <input className="field" type="date" min={new Date().toISOString().slice(0, 10)} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </label>
          </div>

          <div className={lbl}>
            <span className="font-medium">Photos (optional, up to {MAX_PHOTOS})</span>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-24 overflow-hidden rounded-xl bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {files.length < MAX_PHOTOS && (
                <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/40 text-xs text-muted-foreground hover:bg-cream">
                  <ImagePlus className="h-5 w-5" />Add
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="border-t border-cream p-5">
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? "Raising issue…" : "Raise issue"}
          </button>
        </div>

        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-[1px]" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Raising your issue{files.length ? " and uploading photos" : ""}…</p>
          </div>
        )}
      </form>
    </div>
  );

  const cls = variant === "primary"
    ? "flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground hover:bg-ink"
    : "flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm hover:bg-cream/70";
  return (
    <>
      <button type="button" disabled={properties.length === 0} onClick={() => setOpen(true)} className={`${cls} disabled:cursor-not-allowed disabled:opacity-50`}>
        <Megaphone className="h-4 w-4" />{label}
      </button>
      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}
