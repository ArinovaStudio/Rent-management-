"use client";
import { useState } from "react";

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));

export default function MapPicker({ address, city, lat, lng, onChange }: {
  address: string;
  city: string;
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}) {
  // Coordinates win if filled in, otherwise we search by address + city.
  const current = isNum(lat) && isNum(lng) ? `${lat.trim()},${lng.trim()}` : `${address} ${city}`.trim();
  const [query, setQuery] = useState(current);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {query && (
        <iframe
          className="map-box"
          title="Property location"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
        />
      )}
      <button type="button" className="button secondary" onClick={() => setQuery(current)} disabled={!current}>
        Show on map
      </button>
      <p className="muted" style={{ margin: 0 }}>
        Optional: for an exact pin, right-click the spot on Google Maps, click the coordinates to copy them,
        and enter them below.
      </p>
      <div className="row">
        <label>Latitude<input value={lat} onChange={(e) => onChange(e.target.value, lng)} inputMode="decimal" /></label>
        <label>Longitude<input value={lng} onChange={(e) => onChange(lat, e.target.value)} inputMode="decimal" /></label>
      </div>
    </div>
  );
}