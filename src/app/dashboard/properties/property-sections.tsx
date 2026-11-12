"use client";
import { useId, useState } from "react";

export type Pair = { a: string; b: string };

export const toPairs = (v: unknown, ka: string, kb: string): Pair[] =>
  Array.isArray(v)
    ? v.map((r: Record<string, unknown>) => ({ a: String(r[ka] ?? ""), b: r[kb] == null ? "" : String(r[kb]) }))
    : [];

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

// Tick presets or add your own
export function TagPicker({ presets, value, onChange }: { presets: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const all = [...presets, ...value.filter((v) => !presets.includes(v))];
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const add = () => {
    const v = custom.trim().slice(0, 40);
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setCustom("");
  };
  return (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {all.map((v) => (
          <label key={v} className="check"><input type="checkbox" checked={value.includes(v)} onChange={() => toggle(v)} />{v}</label>
        ))}
      </div>
      <div className="row">
        <label>Add your own
          <input value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        </label>
        <button type="button" className="button secondary" onClick={add}>Add</button>
      </div>
    </>
  );
}