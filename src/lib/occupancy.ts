
export type OccRoom = { capacity: number; allocations: unknown[] };
export type OccProperty = { type: string; sharing: boolean };

export const headcount = (allocs: readonly unknown[]) => allocs.length;
export const isWholeUnit = (p: OccProperty) => p.type !== "PG" && !p.sharing;

export function occupancy(p: OccProperty, rooms: OccRoom[]) {
  const wholeUnit = isWholeUnit(p);
  const cap = rooms.reduce((s, r) => s + r.capacity, 0);
  const occ = rooms.reduce((s, r) => s + headcount(r.allocations), 0);
  const full = (wholeUnit ? rooms.length > 0 : true) && occ >= cap;
  return { cap, occ, full, wholeUnit };
}

export function occupancyText(p: OccProperty, rooms: OccRoom[]) {
  const { cap, occ, full, wholeUnit } = occupancy(p, rooms);
  if (wholeUnit) {
    if (occ === 0) return "Vacant · available to rent";
    return full ? `Full · ${occ}/${cap} people` : `Rented · ${occ}/${cap} people living here`;
  }
  return `Occupancy ${occ}/${cap}${full ? " · no rooms available" : ""}`;
}