import { catKey, catName, floorAttachedRooms, floorBaths, floorCommon, sortCats, type PgPlan } from "@/lib/pg-config";
import type { CategoryMedia, RoomState } from "./room-types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const roomsOn = (rooms: RoomState[], f: number) => rooms.filter((r) => Number(r.floor) === f);
const idOf = (r: RoomState) => ({ capacity: Number(r.capacity), ac: r.ac });
const rentRange = (rooms: RoomState[]) => {
  const v = rooms.map((r) => Number(r.rent)).filter((n) => n > 0);
  if (!v.length) return "";
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? inr(lo) : `${inr(lo)} – ${inr(hi)}`;
};
const mixOf = (rooms: RoomState[]) =>
  sortCats(Array.from(new Map(rooms.map((r) => [catKey(idOf(r)), idOf(r)])).values()))
    .map((c) => `${rooms.filter((r) => catKey(idOf(r)) === catKey(c)).length} × ${catName(c)}`)
    .join(", ");

const primaryBtn = "rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground disabled:opacity-40";
const softBtn = "rounded-full bg-background px-5 py-2.5 text-sm disabled:opacity-40";

// Property summary. PG: totals, the room mix and rent per category, then floor by floor.
export function PropertySummary({ isPG, floorCount, declaredRooms, rooms, cards, beds, baths, plan }: {
  isPG: boolean; floorCount: number; declaredRooms: number; rooms: RoomState[]; cards: RoomState[]; beds: string; baths: string; plan: PgPlan;
}) {
  if (!isPG) {
    return (
      <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
        <p className="font-medium">Property summary · {beds || 0} bedrooms · {baths || 0} bathrooms · {cards.length}{declaredRooms > 0 ? ` of ${declaredRooms}` : ""} rooms configured</p>
      </div>
    );
  }
  const floorList = Array.from({ length: floorCount }, (_, i) => i + 1);
  const floorPlan = (f: number) => plan.floors.find((x) => x.floor === f);
  const bathsOn = (f: number) => { const p = floorPlan(f); return p ? floorBaths(p, plan.categories) : 0; };
  const bathText = (f: number) => {
    const p = floorPlan(f);
    if (!p) return "no bathrooms";
    const att = floorAttachedRooms(p, plan.categories), com = floorCommon(p, plan.categories);
    const text = [att > 0 ? `${att} attached` : "", com > 0 ? `${com} common` : ""].filter(Boolean).join(" + ");
    return text ? `${text} bathrooms` : "no bathrooms";
  };
  const totalBaths = floorList.reduce((s, f) => s + bathsOn(f), 0);
  const beds_ = rooms.reduce((s, r) => s + Number(r.capacity || 0), 0);
  const cats = sortCats(Array.from(new Map(rooms.map((r) => [catKey(idOf(r)), idOf(r)])).values()));
  const stat = (label: string, value: string) => (
    <div className="rounded-xl bg-background px-4 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div>
  );
  return (
    <div className="rounded-2xl bg-cream p-4 sm:col-span-2">
      <p className="font-medium">Property summary</p>
      {rooms.length === 0 || floorCount === 0 ? <p className="mt-1 text-sm text-muted-foreground">No rooms generated yet.</p> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stat("Floors", String(floorCount))}
            {stat("Total rooms", String(rooms.length))}
            {stat("Beds", String(beds_))}
            {stat("Bathrooms", String(totalBaths))}
            {stat("Rent / person", rentRange(rooms) || "—")}
          </div>
          <p className="mb-1 mt-4 text-sm font-medium">By category</p>
          <ul className="space-y-1 text-sm">
            {cats.map((c) => {
              const here = rooms.filter((r) => catKey(idOf(r)) === catKey(c));
              return <li key={catKey(c)} className="flex justify-between gap-3"><span>{catName(c)}</span><span className="text-muted-foreground">{here.length} {here.length === 1 ? "room" : "rooms"} · {rentRange(here) || "no rent"}{here.every((r) => r.bathAttached) ? " · attached washroom" : ""}</span></li>;
            })}
          </ul>
          <p className="mb-1 mt-4 text-sm font-medium">By floor</p>
          <ul className="space-y-1 text-sm">
            {floorList.map((f) => {
              const here = roomsOn(rooms, f);
              return (
                <li key={f} className="flex flex-wrap justify-between gap-x-3">
                  <span>Floor {f}</span>
                  <span className="text-muted-foreground">
                    {here.length ? `${here.length} ${here.length === 1 ? "room" : "rooms"} · ${mixOf(here)} · ${rentRange(here)}` : "No rooms"} · {bathText(f)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// PG: step 2 (floors) and the category photos. Rooms are generated from the floor setup, so there is nothing to edit per room.
export function PgRoomsCard({ floorCount, hasCategories, rooms, categoryMedia, issues, onFloors, onMedia }: {
  floorCount: number; hasCategories: boolean; rooms: RoomState[]; categoryMedia: CategoryMedia[]; issues: string[]; onFloors: () => void; onMedia: () => void;
}) {
  const catIds = new Set(rooms.map((r) => Number(r.capacity)));
  const hint = floorCount < 1 ? "Enter the number of floors in Specifications first."
    : !hasCategories ? "Choose the room categories above first."
    : rooms.length === 0 ? `${floorCount} floors declared. Generate floors to create the rooms.`
    : `${floorCount} floors · ${rooms.length} rooms · ${mixOf(rooms)} · ${categoryMedia.filter((m) => catIds.has(m.capacity)).length} category media files`;
  return (
    <div className="rounded-2xl bg-cream/60 p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">2. Floors & rooms</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onFloors} disabled={floorCount < 1 || !hasCategories} className={primaryBtn}>{rooms.length ? "Edit floors" : "Generate floors"}</button>
          <button type="button" onClick={onMedia} disabled={rooms.length === 0} className={softBtn}>Category photos & videos</button>
        </div>
      </div>
      {issues.length > 0 && rooms.length > 0 && <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{issues[0]}</p>}
    </div>
  );
}

// Apartment / flat: one line per bedroom, with a button that opens the room configuration popup.
export function BedroomsCard({ sharing, cards, declaredRooms, onOpen }: {
  sharing: boolean; cards: RoomState[]; declaredRooms: number; onOpen: () => void;
}) {
  const incomplete = (r: RoomState) => !(Number(r.sizeSqm) > 0) || !(Number(r.bathArea) > 0) || (sharing && r.rent.trim() === "");
  return (
    <div className="rounded-2xl bg-cream/60 p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Bedrooms</p>
          <p className="text-sm text-muted-foreground">
            {declaredRooms > 0 ? `${cards.length} of ${declaredRooms} rooms configured` : "Enter the number of bedrooms in Specifications to start."}
          </p>
        </div>
        <button type="button" onClick={onOpen} disabled={declaredRooms < 1 && cards.length === 0} className={primaryBtn}>{cards.length ? "Edit rooms" : "Configure rooms"}</button>
      </div>
      {cards.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {cards.map((r, i) => (
            <li key={r.id ?? i} className="flex flex-wrap justify-between gap-3">
              <span>{r.label}{r.roomType && r.roomType !== "Bedroom" ? ` (${r.roomType})` : ""}</span>
              <span className={incomplete(r) ? "text-destructive" : "text-muted-foreground"}>
                {incomplete(r) ? "Details missing" : `${sharing ? `${r.capacity} sharing · ` : ""}${r.sizeSqm} m² · ${r.bathAttached ? "attached" : "common"} bathroom${sharing ? ` · ₹${Number(r.rent).toLocaleString("en-IN")}` : ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}