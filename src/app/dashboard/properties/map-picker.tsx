"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
export const MAP_UPDATE_EVENT = "property-map-update";

// The map only moves when "Update map" is pressed (or Enter is pressed in a location field), so half-typed
// addresses are not searched. It follows the coordinates if both are valid, otherwise address, city, district and state.
export default function MapPicker({ address, city, lat, lng, onChange, focus, onClearFocus }: {
  address: string; city: string; lat: string; lng: string;
  onChange: (lat: string, lng: string) => void;
  focus?: string | null;
  onClearFocus?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef({ address, city, lat, lng });
  latest.current = { address, city, lat, lng };

  // What the map is showing right now. Starts from the saved details so an existing property opens on its place.
  const build = useCallback(() => {
    const form = root.current?.closest("form") as HTMLFormElement | null;
    const read = (n: string) => ((form?.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim();
    const { address: a, city: c, lat: la, lng: lo } = latest.current;
    if (isNum(la) && isNum(lo)) return `${la.trim()},${lo.trim()}`;
    return [a, c, read("district"), read("state")].map((s) => s.trim()).filter(Boolean).join(", ") || "India";
  }, []);
  const [applied, setApplied] = useState(() => [address, city].map((s) => s.trim()).filter(Boolean).join(", ") || (isNum(lat) && isNum(lng) ? `${lat.trim()},${lng.trim()}` : "India"));
  const [justUpdated, setJustUpdated] = useState(false);

  const update = useCallback(() => { setApplied(build()); setJustUpdated(true); }, [build]);
  useEffect(() => { if (justUpdated) { const t = setTimeout(() => setJustUpdated(false), 2500); return () => clearTimeout(t); } }, [justUpdated]);

  // Pressing Enter in a location field (handled by the form) asks the map to update
  useEffect(() => {
    window.addEventListener(MAP_UPDATE_EVENT, update);
    return () => window.removeEventListener(MAP_UPDATE_EVENT, update);
  }, [update]);

  const query = focus ? `${focus} near ${applied}` : applied;
  const hasPin = isNum(lat) || isNum(lng);

  return (
    <div ref={root} className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted-foreground">Latitude (optional)</span>
        <input className="field" value={lat} onChange={(e) => onChange(e.target.value, lng)} inputMode="decimal" placeholder="e.g. 23.3315" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted-foreground">Longitude (optional)</span>
        <input className="field" value={lng} onChange={(e) => onChange(lat, e.target.value)} inputMode="decimal" placeholder="e.g. 75.0367" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="button" onClick={() => { onClearFocus?.(); update(); }} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-ink">
          <MapPin className="h-4 w-4" />Update map
        </button>
        {hasPin && (
          <button type="button" onClick={() => { onChange("", ""); }} className="flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm hover:bg-cream/70">
            <X className="h-4 w-4" />Clear coordinates
          </button>
        )}
        <span role="status" className="text-xs text-muted-foreground">{justUpdated ? "Map updated." : "Press Update map after changing the address, city, district, state or coordinates."}</span>
      </div>
      <p className="px-1 text-xs text-muted-foreground sm:col-span-2">
        With coordinates filled in, the map shows that exact pin. Without them it searches the address, city, district and state. For an exact pin, right-click the spot on Google Maps, copy the coordinates and enter them above.
      </p>
      <div className="relative overflow-hidden rounded-2xl sm:col-span-2">
        {focus && (
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs shadow">
            <span>Showing: {focus}</span>
            <button type="button" onClick={onClearFocus} className="text-primary underline">Back to property</button>
          </div>
        )}
        <iframe
          className="h-72 w-full"
          title="Property location"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
        />
      </div>
    </div>
  );
}
