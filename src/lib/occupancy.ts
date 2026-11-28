// List pages can pass `activeCount` from a Prisma `_count` instead of loading allocation rows.
export type OccRoom = { capacity: number; roomType?: string | null; allocations?: unknown[]; activeCount?: number };
export type OccProperty = { type: string; sharing: boolean };

export const headcount = (allocs: readonly unknown[]) => allocs.length;
const living = (r: OccRoom) => r.activeCount ?? r.allocations?.length ?? 0;
// A flat rented as one unit where several people may live (Shared flat). No people limit, only a head count.
// Older rows stored the limit as capacity > 1, so those count as shared too.
export const isShareableUnit = (r: { roomType?: string | null; capacity: number }) => r.roomType === "SHAREABLE" || r.capacity > 1;
export const isWholeUnit = (p: OccProperty) => p.type !== "PG" && p.type !== "BUILDING" && !p.sharing;

// Building: capacity counts flats (a shareable flat has no people limit), occupancy counts flats that have someone living in them.
export function occupancy(p: OccProperty, rooms: OccRoom[]) {
  if (p.type === "BUILDING") {
    const cap = rooms.length;
    const occ = rooms.filter((r) => living(r) > 0).length;
    return { cap, occ, full: cap > 0 && occ >= cap, wholeUnit: false, unlimited: false };
  }
  const wholeUnit = isWholeUnit(p);
  if (wholeUnit && rooms.some(isShareableUnit)) {
    return { cap: 0, occ: rooms.reduce((s, r) => s + living(r), 0), full: false, wholeUnit: true, unlimited: true };
  }
  const cap = rooms.reduce((s, r) => s + r.capacity, 0);
  const occ = rooms.reduce((s, r) => s + living(r), 0);
  const full = (wholeUnit ? rooms.length > 0 : true) && occ >= cap;
  return { cap, occ, full, wholeUnit, unlimited: false };
}

export function occupancyText(p: OccProperty, rooms: OccRoom[]) {
  const { cap, occ, full, wholeUnit, unlimited } = occupancy(p, rooms);
  if (p.type === "BUILDING") return `${occ}/${cap} flats rented${full ? " · no vacant flats" : ""}`;
  if (wholeUnit) {
    if (occ === 0) return "Vacant · available to rent";
    if (unlimited) return `Rented · ${occ} ${occ === 1 ? "person" : "people"} living here`;
    return full ? `Full · ${occ}/${cap} people` : `Rented · ${occ}/${cap} people living here`;
  }
  return `Occupancy ${occ}/${cap}${full ? " · no rooms available" : ""}`;
}

// Building flat availability for new residents. A single flat is Non vacant once rented. A shared flat stays Vacant
// (more people can be added) until an admin marks it Non vacant; that mark only counts while someone lives there.
export const flatOpen = (r: { roomType?: string | null; capacity: number; closedToNew?: boolean }, living: number) =>
  isShareableUnit(r) ? !(r.closedToNew && living > 0) : living === 0;
