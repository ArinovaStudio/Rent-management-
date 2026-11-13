"use client";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, FileText, Loader2, Upload, X } from "lucide-react";

export type Pair = { a: string; b: string };

export const toPairs = (v: unknown, ka: string, kb: string): Pair[] =>
  Array.isArray(v)
    ? v.map((r: Record<string, unknown>) => ({ a: String(r[ka] ?? ""), b: r[kb] == null ? "" : String(r[kb]) }))
    : [];

// Card-style form section: title, optional hint, and a two-column grid for its fields
export function Section({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[2rem] bg-background p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

// Labelled field wrapper. `wide` makes it span both columns.
export function F({ label, wide, children }: { label: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

// Switch-style checkbox row. Still a real <input type="checkbox" name=...> so FormData picks it up.
export function ToggleRow({ title, desc, name, ...rest }: { title: string; desc?: string; name: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "title" | "type">) {
  return (
    <label className={`flex items-center justify-between gap-4 rounded-2xl bg-cream/60 px-5 py-4 sm:col-span-2 ${rest.disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
      <input type="checkbox" name={name} className="peer sr-only" {...rest} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-primary/20 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-background after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-5" />
    </label>
  );
}

// Full-screen overlay shown while the form is being saved
export function SavingOverlay({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-full bg-background px-6 py-4 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
}

// Add/remove rows of "name + number" (room sizes, bathrooms, payment milestones, nearby places)
export function PairList({ rows, onChange, aLabel, bLabel, addLabel, aOptions }: {
  rows: Pair[]; onChange: (r: Pair[]) => void;
  aLabel: string; bLabel: string; addLabel: string; aOptions?: string[];
}) {
  const listId = useId();
  const set = (i: number, patch: Partial<Pair>) => onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  return (
    <>
      {aOptions && <datalist id={listId}>{aOptions.map((o) => <option key={o} value={o} />)}</datalist>}
      {rows.map((r, i) => (
        <div key={i} className="row">
          <label>{aLabel}<input list={aOptions ? listId : undefined} maxLength={60} value={r.a} onChange={(e) => set(i, { a: e.target.value })} /></label>
          <label>{bLabel}<input type="number" min={0} step="any" value={r.b} onChange={(e) => set(i, { b: e.target.value })} /></label>
          <button type="button" className="button secondary" onClick={() => onChange(rows.filter((_, k) => k !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="button secondary" onClick={() => onChange([...rows, { a: "", b: "" }])}>{addLabel}</button>
    </>
  );
}

// Click presets to select them, or add your own
export function TagPicker({ presets, value, onChange, label }: { presets: string[]; value: string[]; onChange: (v: string[]) => void; label?: string }) {
  const [custom, setCustom] = useState("");
  const customs = value.filter((v) => !presets.includes(v));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const add = () => {
    const v = custom.trim().slice(0, 40);
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setCustom("");
  };
  return (
    <div className="rounded-[1.5rem] bg-cream/60 p-4 sm:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="font-medium">{label}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{value.length} selected</span>
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="text-muted-foreground hover:text-destructive">Clear</button>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {presets.map((v) => {
          const on = value.includes(v);
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => toggle(v)} className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors ${on ? "border-primary bg-primary/5 font-medium text-primary" : "border-transparent bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-primary-foreground" : "bg-cream"}`}>{on && <Check className="h-3 w-3" />}</span>
              <span className="truncate">{v}</span>
            </button>
          );
        })}
        {customs.map((v) => (
          <span key={v} className="flex items-center gap-2 rounded-2xl border border-primary bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary">
            <span className="truncate">{v}</span>
            <button type="button" aria-label={`Remove ${v}`} onClick={() => toggle(v)} className="ml-auto shrink-0"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="field !bg-background" value={custom} maxLength={40} placeholder="Add your own and press Enter" onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!custom.trim()} className="shrink-0 rounded-full bg-primary px-5 text-sm text-primary-foreground hover:bg-ink disabled:opacity-40">Add</button>
      </div>
    </div>
  );
}

/** Dashed drop-style file picker (still a real <input type="file" name=...> so FormData picks it up). */
export function FileDrop({ name, accept, title, hint, wide = true, onClear }: { name: string; accept: string; title: string; hint: string; wide?: boolean; onClear?: () => void }) {
  const [file, setFile] = useState("");
  return (
    <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-cream/60 px-5 py-4 transition-colors hover:border-primary hover:bg-primary/5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-primary">{file ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{file || title}</span>
        <span className="block text-xs text-muted-foreground">{file ? "Click to choose a different file" : hint}</span>
      </span>
      {file && onClear && <span role="button" aria-label="Clear" onClick={(e) => { e.preventDefault(); setFile(""); onClear(); }} className="shrink-0 rounded-full bg-background p-1.5 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></span>}
      <input type="file" name={name} accept={accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
    </label>
  );
}