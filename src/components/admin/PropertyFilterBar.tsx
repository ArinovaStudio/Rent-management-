"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

export type FilterGroup = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  // Value used when the URL has no param for this group (e.g. approvals page opens on "PENDING").
  // When set, the "All" chip uses the value "all" so it can be told apart from "nothing chosen".
  defaultValue?: string;
};

const ALL = "all";

function splitVals(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter((s) => s && s !== ALL);
}

// Search box + Search button + Filter button.
// - Filter opens a floating panel (it does not push the page down).
// - The whole bar is sticky under the top header, so it stays reachable while scrolling.
// State lives in the URL (?q=..&status=..), so the server page does the work and links stay shareable.
// Chips within a group are multi-select (comma-separated in the URL).
export default function PropertyFilterBar({ groups, placeholder = "Search property by name" }: { groups: FilterGroup[]; placeholder?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  // What the URL says right now for a group (falls back to its default).
  const urlValue = (g: FilterGroup) => sp.get(g.key) ?? g.defaultValue ?? "";
  const fromUrl = () => Object.fromEntries(groups.map((g) => [g.key, urlValue(g)]));

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [vals, setVals] = useState<Record<string, string>>(fromUrl);
  const [open, setOpen] = useState(false);

  // A group counts as "active" when it differs from its default (or from "All" if it has no default).
  const activeCount = groups.filter((g) => {
    const v = urlValue(g);
    if (g.defaultValue) return v !== g.defaultValue && v !== "";
    return v !== "";
  }).length;
  const anyApplied = activeCount > 0 || !!sp.get("q");

  // Know when the bar touches the top header (4rem = 64px). Only then it gets a background.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 64),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function toggle() {
    // Opening again should show what is really applied, not an old unapplied pick.
    if (!open) setVals(fromUrl());
    setOpen((v) => !v);
  }

  // Search as you type: wait 300ms after the last key, then update the URL.
  // Uses replace (no history spam) and scroll:false (page does not jump). Panel stays as is.
  useEffect(() => {
    if (q.trim() === (sp.get("q") ?? "")) return;
    const t = setTimeout(() => go(q, fromUrl(), { live: true }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function go(nextQ: string, nextVals: Record<string, string>, opts: { live?: boolean } = {}) {
    const p = new URLSearchParams(sp.toString());
    p.delete("saved");
    p.delete("filter"); // old tab param, now part of the status filter
    if (nextQ.trim()) p.set("q", nextQ.trim()); else p.delete("q");
    for (const g of groups) {
      const v = nextVals[g.key] ?? "";
      if (g.defaultValue) {
        // default alone → omit param; "all" → explicit all; anything else → keep (incl. multi)
        if (v === g.defaultValue || v === "") p.delete(g.key);
        else p.set(g.key, v);
      } else {
        if (!v || v === ALL) p.delete(g.key); else p.set(g.key, v);
      }
    }
    const s = p.toString();
    const url = s ? `${path}?${s}` : path;
    if (opts.live) {
      start(() => router.replace(url, { scroll: false }));
    } else {
      setOpen(false);
      start(() => router.push(url));
    }
  }

  function clearAll() {
    const reset = Object.fromEntries(groups.map((g) => [g.key, g.defaultValue ?? ""]));
    setQ("");
    setVals(reset);
    go("", reset);
  }

  function toggleChip(g: FilterGroup, value: string) {
    // "All" clears the group back to default / empty.
    if (value === ALL || value === "") {
      setVals((v) => ({ ...v, [g.key]: g.defaultValue ? ALL : "" }));
      return;
    }
    setVals((v) => {
      const cur = splitVals(v[g.key] ?? "");
      // When the group is still on its implicit default (single value, not "all"), treat that as selected.
      const base = cur.length ? cur : (v[g.key] && v[g.key] !== ALL ? [v[g.key]] : []);
      const has = base.includes(value);
      const next = has ? base.filter((x) => x !== value) : [...base, value];
      if (next.length === 0) return { ...v, [g.key]: g.defaultValue ? ALL : "" };
      return { ...v, [g.key]: next.join(",") };
    });
  }

  function chipOn(g: FilterGroup, o: { value: string }) {
    const raw = vals[g.key] ?? "";
    if (o.value === ALL || o.value === "") {
      return g.defaultValue ? raw === ALL : !raw;
    }
    return splitVals(raw).includes(o.value) || raw === o.value;
  }

  return (
    <>
    {/* Tiny marker above the bar. When it scrolls out under the header, the bar is "stuck". */}
    <div ref={sentinelRef} aria-hidden className="-mb-px h-px" />
    {/* Full-width band that sticks just under the 4rem top header. Negative margins cancel the page padding.
        No background at rest. White glass background shows only once it is stuck at the top. */}
    <div className={`sticky top-16 z-20 -mx-4 mb-6 px-4 py-3 transition-colors md:-mx-8 md:px-8 ${stuck ? "bg-background/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] backdrop-blur" : "bg-transparent"}`}>
      <div ref={wrapRef} className="relative">
        <form
          onSubmit={(e) => { e.preventDefault(); go(q, vals); }}
          className="flex flex-wrap items-center gap-2"
          role="search"
        >
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              aria-label="Search property by name"
              className="w-full rounded-full bg-background py-3 pl-11 pr-4 text-sm outline-none ring-1 ring-black/10 focus:ring-primary"
            />
          </div>
          <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-ink disabled:opacity-60">
            <Search className="h-4 w-4" />Search
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={`flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ring-1 transition-colors ${open || activeCount ? "bg-primary/10 text-primary ring-primary" : "bg-background ring-black/10 hover:bg-cream"}`}
          >
            <SlidersHorizontal className="h-4 w-4" />Filter{activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{activeCount}</span>}
          </button>
          {anyApplied && (
            <button type="button" onClick={clearAll} className="flex items-center gap-1 rounded-full px-3 py-3 text-sm text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />Clear
            </button>
          )}
        </form>

        {/* Floating panel: sits on top of the page, so nothing below it moves. */}
        {open && (
          <div role="dialog" aria-label="Filters" className="absolute right-0 top-full z-30 mt-2 max-h-[calc(100vh-10rem)] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-background p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)] ring-1 ring-black/10">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {[{ value: g.defaultValue ? ALL : "", label: "All" }, ...g.options].map((o) => {
                    const on = chipOn(g, o);
                    return (
                      <button
                        key={o.value || "all"}
                        type="button"
                        onClick={() => toggleChip(g, o.value)}
                        className={`rounded-full px-4 py-2 text-sm transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-cream hover:bg-cream/70"}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={clearAll} className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Reset</button>
              <button type="button" disabled={pending} onClick={() => go(q, vals)} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-ink-foreground hover:bg-primary disabled:opacity-60">Apply filters</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
