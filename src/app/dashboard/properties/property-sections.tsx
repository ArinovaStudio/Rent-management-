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
export function F({ label, wide, req, children }: { label: ReactNode; wide?: boolean; req?: boolean; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-2 text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium">{label}{req && <span className="text-destructive" aria-hidden="true"> *</span>}</span>
      {children}
    </label>
  );
}

// Long file names are cut to the first characters (the extension is kept). The full name stays in the tooltip.
export function shortName(name: string, max = 24): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  return `${name.slice(0, max)}…${ext}`;
}

// Small (!) icon next to a label. The explanation shows on hover or keyboard focus, so nothing is written upfront.
export function Hint({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <span tabIndex={0} role="img" aria-label={text} className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">!</span>
      <span role="tooltip" className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-1 w-60 max-w-[min(15rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs font-normal text-white opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 sm:left-0 sm:translate-x-0">{text}</span>
    </span>
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
export function TagPicker({ presets, value, onChange, label, charges, onChargeChange }: {
  presets: string[]; value: string[]; onChange: (v: string[]) => void; label?: string;
  charges?: Record<string, string>; onChargeChange?: (tag: string, v: string | undefined) => void;
}) {
  const charge = (v: string) => {
    if (!charges || !onChargeChange) return null;
    const charged = charges[v] !== undefined;
    return (
      <div className="min-w-0 space-y-2 rounded-2xl bg-background p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Extra charge?</span>
          <div className="flex rounded-full bg-cream p-0.5 text-xs">
            <button type="button" onClick={() => onChargeChange(v, undefined)}
              className={`rounded-full px-3 py-1.5 transition-colors ${!charged ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Included
            </button>
            <button type="button" onClick={() => onChargeChange(v, charges[v] ?? "")}
              className={`rounded-full px-3 py-1.5 transition-colors ${charged ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Charged
            </button>
          </div>
        </div>
        {charged && (
          <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
            <span>₹ / month</span>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="Enter monthly charge"
              value={charges[v] ?? ""}
              onChange={(e) => onChargeChange(v, e.target.value)}
              className="field !bg-cream !px-4 !py-2.5 text-sm"
            />
          </label>
        )}
      </div>
    );
  };
  const [custom, setCustom] = useState("");
  const [customOptions, setCustomOptions] = useState(() => value.filter((v) => !presets.includes(v)));
  const customs = customOptions;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const add = () => {
    const v = custom.trim().slice(0, 40);
    if (v) {
      const existing = [...presets, ...customOptions].find((x) => x.toLowerCase() === v.toLowerCase());
      if (existing) {
        if (!value.includes(existing)) onChange([...value, existing]);
      } else {
        setCustomOptions((options) => [...options, v]);
        onChange([...value, v]);
      }
    }
    setCustom("");
  };
  return (
    <div className="min-w-0 overflow-hidden rounded-[1.5rem] bg-cream/60 p-4 sm:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="font-medium">{label}</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{value.length} selected</span>
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="text-muted-foreground hover:text-destructive">Clear</button>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 xl:grid-cols-3">
        {presets.map((v) => {
          const on = value.includes(v);
          return (
            <div key={v} className="grid min-w-0 content-start gap-1.5">
              <button type="button" aria-pressed={on} aria-label={`${on ? "Deselect" : "Select"} ${v}`} onClick={() => toggle(v)} className={`flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${on ? "border-primary bg-primary/5 font-medium text-primary" : "border-transparent bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-cream"}`}>{on && <Check className="h-3 w-3" />}</span>
                <span className="truncate">{v}</span>
              </button>
              {on && charge(v)}
            </div>
          );
        })}
        {customs.map((v) => {
          const on = value.includes(v);
          return (
            <div key={v} className="grid min-w-0 content-start gap-1.5">
              <button type="button" aria-pressed={on} aria-label={`${on ? "Deselect" : "Select"} ${v}`} onClick={() => toggle(v)} className={`flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${on ? "border-primary bg-primary/5 font-medium text-primary" : "border-transparent bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-cream"}`}>{on && <Check className="h-3 w-3" />}</span>
                <span className="truncate">{v}</span>
              </button>
              {on && charge(v)}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex min-w-0 gap-2">
        <input className="field min-w-0 !bg-background" value={custom} maxLength={40} placeholder="Add your own and press Enter" onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} disabled={!custom.trim()} className="shrink-0 rounded-full bg-primary px-5 text-sm text-primary-foreground hover:bg-ink disabled:opacity-40">Add</button>
      </div>
    </div>
  );
}

/** Dashed drop-style file picker (still a real <input type="file" name=...> so FormData picks it up). */
export function FileDrop({ name, accept, title, hint, wide = true, req, onClear }: { name: string; accept: string; title: string; hint: string; wide?: boolean; req?: boolean; onClear?: () => void }) {
  const [file, setFile] = useState("");
  return (
    <label className={`flex min-w-0 cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-cream/60 px-5 py-4 transition-colors hover:border-primary hover:bg-primary/5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-primary">{file ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium" title={file || undefined}>{file ? shortName(file) : title}{!file && req && <span className="text-destructive"> *</span>}</span>
        <span className="block text-xs text-muted-foreground">{file ? "Click to choose a different file" : hint}</span>
      </span>
      {file && onClear && <span role="button" aria-label="Clear" onClick={(e) => { e.preventDefault(); setFile(""); onClear(); }} className="shrink-0 rounded-full bg-background p-1.5 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></span>}
      <input type="file" name={name} accept={accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
    </label>
  );
}
