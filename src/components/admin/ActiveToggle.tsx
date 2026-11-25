"use client";
import { useState } from "react";
import { useSoftRefresh } from "@/lib/use-soft-refresh";
import { authFetch } from "@/lib/fetch-auth";
import { toast } from "@/lib/toast";

type Value = "on" | "off" | "mixed";
const toValue = (a: boolean | "mixed"): Value => (a === "mixed" ? "mixed" : a ? "on" : "off");

// On/Off switch. On = active, Off = inactive. What it switches depends on the props:
//   propertyId only                      the whole property
//   + floor                              every room on that floor
//   + floor, capacity, ac                one room category on that floor (PG)
//   + roomId                             one room / flat
// `active="mixed"` shows a half-way switch (some inside are On, some Off); clicking it switches everything On.
// It moves at once, and goes back if the server says no (for example people are still living there).
export default function ActiveToggle({ propertyId, roomId, floor, capacity, ac, active, note, disabled, title, label = true, className = "" }: {
  propertyId: string;
  roomId?: string;
  floor?: number;
  capacity?: number;
  ac?: boolean;
  active: boolean | "mixed";
  note?: string; // reason saved when switching Off
  disabled?: boolean;
  title?: string;
  label?: boolean; // show the On / Off text beside the switch
  className?: string;
}) {
  const refresh = useSoftRefresh();
  const [value, setValue] = useState<Value>(toValue(active));
  const [busy, setBusy] = useState(false);

  // follow the server value after a refresh
  const [seen, setSeen] = useState<Value>(toValue(active));
  if (seen !== toValue(active)) { setSeen(toValue(active)); setValue(toValue(active)); }

  async function flip(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy || disabled) return;
    const before = value;
    const next = before !== "on"; // Off or half-way -> On, On -> Off
    setValue(next ? "on" : "off");
    setBusy(true);
    const res = await authFetch(`/api/properties/${propertyId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, floor, capacity, ac, active: next, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setValue(before);
      toast(data.error ?? "Could not change this.", "error");
      return;
    }
    refresh();
  }

  const track = value === "on" ? "bg-primary" : value === "mixed" ? "bg-primary/40" : "bg-gray-300";
  const thumb = value === "on" ? "translate-x-5" : value === "mixed" ? "translate-x-2.5" : "";
  const text = value === "on" ? "On" : value === "mixed" ? "Some" : "Off";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value === "mixed" ? "mixed" : value === "on"}
      aria-label={value === "on" ? "On. Switch Off" : value === "mixed" ? "Some are On. Switch all On" : "Off. Switch On"}
      title={title ?? (value === "on" ? "Active" : value === "mixed" ? "Some active, some inactive" : "Inactive")}
      disabled={disabled || busy}
      onClick={flip}
      className={`inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span className={`relative inline-block h-6 w-11 rounded-full transition-colors ${track}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${thumb}`} />
      </span>
      {label && <span className={`w-9 text-left text-xs font-medium ${value === "off" ? "text-muted-foreground" : "text-primary"}`}>{text}</span>}
    </button>
  );
}
