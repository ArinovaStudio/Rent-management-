// PG: "N seater". Apartment/flat: "N BHK" from the Bedrooms field.
export function roomCategoryLabel(p: { type: string; bedrooms: number | null }, r: { capacity: number }) {
  if (p.type === "PG") return `${r.capacity} seater`;
  return p.bedrooms ? `${p.bedrooms} BHK` : "Entire unit";
}

// PG: the room's own floor. Apartment/flat: the "Floors / level" value.
export function roomFloor(p: { type: string; floors: number | null }, r: { floor: number | null }) {
  return r.floor ?? (p.type === "PG" ? null : p.floors);
}