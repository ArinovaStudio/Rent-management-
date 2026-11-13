"use client";
import { useEffect, useState } from "react";

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));

// Always shows a map. It follows the coordinates if both are filled in, otherwise the address + city
// the user types (updated shortly after they stop typing).
export default function MapPicker({ address, city, lat, lng, onChange }: {
  address: string;
  city: string;
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}) {
  const wanted = isNum(lat) && isNum(lng) ? `${lat.trim()},${lng.trim()}` : `${address} ${city}`.trim() || "India";
  const [query, setQuery] = useState(wanted);

  useEffect(() => {
    const t = setTimeout(() => setQuery(wanted), 700);
    return () => clearTimeout(t);
  }, [wanted]);

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted-foreground">Latitude (optional)</span>
        <input className="field" value={lat} onChange={(e) => onChange(e.target.value, lng)} inputMode="decimal" placeholder="e.g. 23.3315" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-1 text-sm text-muted-foreground">Longitude (optional)</span>
        <input className="field" value={lng} onChange={(e) => onChange(lat, e.target.value)} inputMode="decimal" placeholder="e.g. 75.0367" />
      </label>
      <p className="px-1 text-xs text-muted-foreground sm:col-span-2">
        The map follows the address and city you type. For an exact pin, right-click the spot on Google Maps, copy the coordinates and enter them above.
      </p>
      <div className="overflow-hidden rounded-2xl sm:col-span-2">
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
