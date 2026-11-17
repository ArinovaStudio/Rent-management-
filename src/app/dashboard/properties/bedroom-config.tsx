"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import ConfigModal from "./config-modal";
import RoomConfigCard from "./room-config-card";
import { F } from "./property-sections";
import { blankRoom, renumber, sm, type RoomState } from "./room-types";

const AUTO_LIMIT = 20;

// Room configuration for apartments and flats. Opening it creates one card per bedroom declared in
// Specifications, and "Same for all bedrooms" fills size, bathroom (and sharing + rent) in one go, so most
// units only need a quick look. Works on a draft until "Save rooms" is pressed.
export default function BedroomConfigModal({ sharing, cards, declaredRooms, maxSeats, onSave, onClose }: {
  sharing: boolean;
  cards: RoomState[];
  declaredRooms: number;
  maxSeats: number;
  onSave: (cards: RoomState[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoomState[]>(() =>
    cards.length > 0 || declaredRooms < 1
      ? cards
      : Array.from({ length: Math.min(declaredRooms, AUTO_LIMIT) }, (_, i) => blankRoom(`Bedroom ${i + 1}`))
  );
  const atLimit = declaredRooms > 0 && draft.length >= declaredRooms;

  // "Same for all bedrooms": only the fields that are filled in are applied
  const [all, setAll] = useState({ sizeSqm: "", bathAttached: "keep" as "keep" | "yes" | "no", bathArea: "", capacity: "", rent: "" });
  const [note, setNote] = useState("");
  const canApply = all.sizeSqm !== "" || all.bathAttached !== "keep" || all.bathArea !== "" || (sharing && (all.capacity !== "" || all.rent !== ""));

  const applyAll = () => {
    let skipped = 0;
    setDraft((ds) => ds.map((d) => {
      const next = { ...d };
      if (all.sizeSqm !== "") next.sizeSqm = all.sizeSqm;
      if (all.bathAttached !== "keep") next.bathAttached = all.bathAttached === "yes";
      if (all.bathArea !== "") next.bathArea = all.bathArea;
      if (sharing && all.rent !== "") next.rent = all.rent;
      if (sharing && all.capacity !== "") {
        if (Number(all.capacity) < Number(d.occupied)) skipped += 1;
        else next.capacity = all.capacity;
      }
      return next;
    }));
    setNote(skipped ? `${skipped} bedroom${skipped === 1 ? "" : "s"} with residents kept their sharing capacity.` : "");
  };

  const add = () => {
    if (declaredRooms < 1 || atLimit) return;
    setDraft((ds) => [...ds, { ...blankRoom(`Bedroom ${ds.length + 1}`), rent: sharing ? ds[ds.length - 1]?.rent ?? "" : "" }]);
  };

  return (
    <ConfigModal title="Room configuration" subtitle={declaredRooms > 0 ? `${draft.length} of ${declaredRooms} rooms configured` : "Enter the number of bedrooms in Specifications to start."} onClose={onClose} onSave={() => onSave(draft)} saveLabel="Save rooms">
      {draft.length > 1 && (
        <div className="mb-4 rounded-2xl bg-cream p-4">
          <p className="font-medium">Same for all bedrooms</p>
          <p className="mb-3 text-sm text-muted-foreground">Fill what is common and apply it to every bedroom. You can still change any bedroom below.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Room size (m²)"><input className={sm} type="number" min={0} step="any" value={all.sizeSqm} onChange={(e) => setAll((a) => ({ ...a, sizeSqm: e.target.value }))} /></F>
            <F label="Attached bathroom?">
              <select className={sm} value={all.bathAttached} onChange={(e) => setAll((a) => ({ ...a, bathAttached: e.target.value as "keep" | "yes" | "no" }))}>
                <option value="keep">Keep as is</option>
                <option value="yes">Yes, attached</option>
                <option value="no">No, common washroom</option>
              </select>
            </F>
            <F label="Bathroom area (m²)"><input className={sm} type="number" min={0} step="any" value={all.bathArea} onChange={(e) => setAll((a) => ({ ...a, bathArea: e.target.value }))} /></F>
            {sharing && (
              <>
                <F label="Sharing capacity">
                  <select className={sm} value={all.capacity} onChange={(e) => setAll((a) => ({ ...a, capacity: e.target.value }))}>
                    <option value="">Keep as is</option>
                    {Array.from({ length: maxSeats }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{`${n} ${n === 1 ? "person" : "people"}`}</option>)}
                  </select>
                </F>
                <F label="Rent per person / month (₹)"><input className={sm} type="number" min={0} value={all.rent} onChange={(e) => setAll((a) => ({ ...a, rent: e.target.value }))} /></F>
              </>
            )}
            <div className="flex items-end"><button type="button" disabled={!canApply} onClick={applyAll} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40">Apply to all</button></div>
          </div>
          {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
        </div>
      )}
      <div className="grid gap-4">
        {draft.map((r, i) => (
          <RoomConfigCard key={r.id ?? i} room={r} rentable={sharing} maxSeats={maxSeats} locked={sharing && Number(r.occupied) > 0}
            onChange={(p) => setDraft((ds) => ds.map((d, k) => (k === i ? { ...d, ...p } : d)))}
            onRemove={() => setDraft((ds) => renumber(ds.filter((_, k) => k !== i)))} />
        ))}
        <button type="button" disabled={declaredRooms < 1 || atLimit} onClick={add}
          className="flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40">
          <Plus className="h-4 w-4" />Add bedroom
        </button>
      </div>
    </ConfigModal>
  );
}
