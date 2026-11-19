// Monthly charge per amenity. Stored on the property as { "Gym": 500, ... }; an amenity with no entry is included in the rent.
export function amenityCharges(p: { amenities: string[]; amenityCharges: unknown }) {
  const raw = p.amenityCharges;
  const map = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const list = p.amenities
    .map((name) => ({ name, charge: Number(map[name]) }))
    .filter((x) => Number.isInteger(x.charge) && x.charge > 0);
  return { list, total: list.reduce((s, x) => s + x.charge, 0) };
}
