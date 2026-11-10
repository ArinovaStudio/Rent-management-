import { checkFile } from "./uploads";

export const MAX_SEATS = { PG: 4, OTHER: 6 };
export const MAX_IMAGES = 10;
const TYPES = ["PG", "APARTMENT", "FLAT"] as const;
export type PType = (typeof TYPES)[number];

export type RoomInput = {
  id?: string;
  label: string;
  capacity: number;
  ac: boolean;
  rent: number;
  occupied: number;
};

// Reads the multipart form sent by the property form and validates it.
// Used by both create (POST) and update (PUT) so the rules live in one place.
export function parsePropertyForm(fd: FormData) {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const optInt = (k: string, label: string) => {
    const v = str(k);
    if (v === "") return { value: null as number | null };
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) return { error: `${label} must be a whole number.` };
    return { value: n };
  };
  const fail = (error: string) => ({ error }) as const;

  const type = str("type") as PType;
  if (!TYPES.includes(type)) return fail("Choose a property type.");
  const name = str("name"), address = str("address"), city = str("city");
  if (!name || !address || !city) return fail("Name, address and city are required.");

  const bedrooms = optInt("bedrooms", "Bedrooms");
  const bathrooms = optInt("bathrooms", "Bathrooms");
  const areaSqft = optInt("areaSqft", "Area");
  const floors = optInt("floors", "Floors");
  for (const f of [bedrooms, bathrooms, areaSqft, floors]) if ("error" in f && f.error) return fail(f.error);

  // Map pin: both or neither
  const latStr = str("latitude"), lngStr = str("longitude");
  let latitude: number | null = null, longitude: number | null = null;
  if (latStr || lngStr) {
    latitude = Number(latStr);
    longitude = Number(lngStr);
    if (!latStr || !lngStr || !(Math.abs(latitude) <= 90) || !(Math.abs(longitude) <= 180)) {
      return fail("Enter a valid map location (latitude and longitude), or clear both.");
    }
  }

  const sharing = type === "PG" ? true : fd.get("sharing") === "on";

  // Rooms
  let rawRooms: unknown;
  try { rawRooms = JSON.parse(str("rooms") || "[]"); } catch { rawRooms = null; }
  if (!Array.isArray(rawRooms) || rawRooms.length === 0) return fail("Add at least one room.");
  if (rawRooms.length > 100) return fail("Too many rooms.");

  const maxSeats = type === "PG" ? MAX_SEATS.PG : MAX_SEATS.OTHER;
  const rooms: RoomInput[] = [];
  for (const r of rawRooms as Record<string, unknown>[]) {
    const room: RoomInput = {
      id: typeof r.id === "string" && r.id ? r.id : undefined,
      label: String(r.label ?? "").trim(),
      capacity: Number(r.capacity),
      ac: type === "PG" && r.ac === true,
      rent: Number(r.rent),
      occupied: Number(r.occupied ?? 0),
    };
    if (!room.label) return fail("Every room needs a name.");
    if (!Number.isInteger(room.capacity) || room.capacity < 1 || room.capacity > maxSeats) {
      return fail(`${room.label}: seats must be between 1 and ${maxSeats}.`);
    }
    if (!Number.isInteger(room.rent) || room.rent < 0) return fail(`${room.label}: enter a valid rent.`);
    if (!Number.isInteger(room.occupied) || room.occupied < 0 || room.occupied > room.capacity) {
      return fail(`${room.label}: occupancy must be between 0 and ${room.capacity}.`);
    }
    rooms.push(room);
  }
  if (!sharing && (rooms.length !== 1 || rooms[0].capacity !== 1)) {
    return fail("A non-sharing property has exactly one unit.");
  }

  // Files
  const images = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const docFiles = fd.getAll("docFile");
  const docNames = fd.getAll("docName");
  const docs: { name: string; file: File }[] = [];
  docFiles.forEach((f, i) => {
    if (f instanceof File && f.size > 0) {
      docs.push({ name: String(docNames[i] ?? "").trim() || f.name, file: f });
    }
  });
  for (const f of images) { const e = checkFile(f, "image"); if (e) return fail(e); }
  for (const d of docs) { const e = checkFile(d.file, "doc"); if (e) return fail(e); }

  const ids = (k: string) => {
    try { const v = JSON.parse(str(k) || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
  };

  return {
    data: {
      name, type, address, city, sharing, latitude, longitude,
      description: str("description") || null,
      bedrooms: type === "PG" ? null : (bedrooms.value ?? null),
      bathrooms: bathrooms.value ?? null,
      areaSqft: areaSqft.value ?? null,
      floors: floors.value ?? null,
    },
    rooms, images, docs,
    removeImageIds: ids("removeImageIds"),
    removeDocIds: ids("removeDocIds"),
  };
}
