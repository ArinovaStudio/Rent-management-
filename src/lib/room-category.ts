// PG: "N seater". Building: "Single flat" / "Shareable flat". Apartment/flat: "N BHK" from the Bedrooms field.
export function roomCategoryLabel(p: { type: string; bedrooms: number | null }, r: { capacity: number; roomType?: string | null }) {
  if (p.type === "PG") return `${r.capacity} seater`;
  if (p.type === "BUILDING") return r.roomType === "SHAREABLE" ? "Shareable flat" : "Single flat";
  return p.bedrooms ? `${p.bedrooms} BHK` : "Entire unit";
}

// PG and Building: the room's own floor. Apartment/flat: the "Floors / level" value.
export function roomFloor(p: { type: string; floors: number | null }, r: { floor: number | null }) {
  return r.floor ?? (p.type === "PG" || p.type === "BUILDING" ? null : p.floors);
}
