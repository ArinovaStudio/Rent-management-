"use client";
import { ImagePlus, X } from "lucide-react";
import { ROOM_TYPES } from "@/lib/property-fields";
import { F } from "./property-sections";

export type RoomPhoto = { key: string; src: string; path?: string; file?: File };
export type RoomCfg = {
  label: string; capacity: string; ac: boolean; rent: string; occupied: string;
  roomType: string; sizeSqm: string; bathAttached: boolean; bathArea: string; photos: RoomPhoto[];
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// One room of an Apartment or Flat. `rentable` = shared accommodation (sharing, rent and photos apply).
export default function RoomConfigCard({ room, onChange, onRemove, rentable, maxSeats, locked, maxPhotos = 5 }: {
  room: RoomCfg;
  onChange: (patch: Partial<RoomCfg>) => void;
  onRemove: () => void;
  rentable: boolean;
  maxSeats: number;
  locked?: boolean;
  maxPhotos?: number;
}) {
  const addPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, Math.max(maxPhotos - room.photos.length, 0));
    if (!picked.length) return;
    onChange({
      photos: [...room.photos, ...picked.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, src: URL.createObjectURL(file), file }))],
    });
  };
  const total = Number(room.capacity) * Number(room.rent);
  const types = Array.from(new Set([room.roomType, ...ROOM_TYPES].filter(Boolean)));

  return (
    <div className="rounded-2xl bg-cream/60 p-4 sm:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <input className="field max-w-xs font-medium" aria-label="Room name" maxLength={30} required value={room.label} onChange={(e) => onChange({ label: e.target.value })} />
        <button type="button" disabled={locked} onClick={onRemove} className="text-sm text-destructive disabled:opacity-40">Remove</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {rentable && (
          <F label="Sharing capacity">
            <select className="field" value={room.capacity} onChange={(e) => onChange({ capacity: e.target.value })}>
              {Array.from({ length: maxSeats }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{`${n} ${n === 1 ? "person" : "people"}`}</option>)}
            </select>
          </F>
        )}
        {rentable && (
          <F label="Air conditioning">
            <select className="field" value={room.ac ? "ac" : "non"} onChange={(e) => onChange({ ac: e.target.value === "ac" })}>
              <option value="non">Non-AC</option>
              <option value="ac">AC</option>
            </select>
          </F>
        )}
        <F label="Room type">
          <select className="field" value={room.roomType} onChange={(e) => onChange({ roomType: e.target.value })}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </F>
        <F label="Room size (m²)">
          <input className="field" type="number" min={0} step="any" required value={room.sizeSqm} onChange={(e) => onChange({ sizeSqm: e.target.value })} />
        </F>
        {rentable && (
          <F label="Rent per person / month (₹)">
            <input className="field" type="number" min={0} required value={room.rent} onChange={(e) => onChange({ rent: e.target.value })} />
          </F>
        )}
      </div>
      {rentable && total > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">When full: {room.capacity} × {inr(Number(room.rent))} = {inr(total)} / month</p>
      )}

      <div className="mt-4 rounded-2xl bg-background p-4">
        <p className="mb-2 text-sm font-medium">Attached bathroom?</p>
        <div className="flex w-fit rounded-full bg-cream p-1">
          {[true, false].map((v) => (
            <button key={String(v)} type="button" aria-pressed={room.bathAttached === v} onClick={() => onChange({ bathAttached: v })}
              className={`rounded-full px-5 py-2 text-sm transition-colors ${room.bathAttached === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <F label={room.bathAttached ? "Bathroom area (m²)" : "Common washroom area (m²)"}>
            <input className="field" type="number" min={0} step="any" required value={room.bathArea} onChange={(e) => onChange({ bathArea: e.target.value })} />
          </F>
          {!room.bathAttached && <p className="self-end pb-3 text-xs text-muted-foreground">This room uses a common washroom shared with other rooms.</p>}
        </div>
      </div>

      {rentable && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Room photos <span className="text-muted-foreground">({room.photos.length}/{maxPhotos})</span></p>
          <div className="flex flex-wrap gap-3">
            {room.photos.map((p) => (
              <div key={p.key} className="relative h-20 w-28 overflow-hidden rounded-xl bg-cream">
                <img src={p.src} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove photo" onClick={() => onChange({ photos: room.photos.filter((x) => x.key !== p.key) })}
                  className="absolute right-1 top-1 rounded-full bg-background p-1 text-destructive"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {room.photos.length < maxPhotos && (
              <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-background text-xs text-muted-foreground hover:bg-muted">
                <ImagePlus className="h-5 w-5" />Add photo
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}