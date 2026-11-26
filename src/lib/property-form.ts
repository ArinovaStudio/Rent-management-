import { checkFile } from "./uploads";
import type { Role } from "./jwt";
import { parseListingFields, FURNISHING } from "./property-fields";
import { parseStoredPlan, storedFloorBaths } from "./pg-config";

export const MAX_SEATS = { PG: 5, OTHER: 6, WHOLE: 20 };
export const MAX_IMAGES = 10;
const TYPES = ["PG", "APARTMENT", "FLAT", "BUILDING"] as const;
export type PType = (typeof TYPES)[number];

export type RoomCategoryMediaInput = { capacity: number; mediaType: "IMAGE" | "VIDEO"; file: File };

export type RoomInput = {
  id?: string;
  label: string;
  capacity: number;
  ac: boolean;
  rent: number;
  occupied: number;
  floor: number | null;
  roomType: string | null;
  sizeSqm: number | null;
  bathroomAttached: boolean;
  bathroomAreaSqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: string | null;
  features: string[]; // Building flats: features & finishes of this flat
  images: string[]; // saved photo paths this room keeps
};

// Feature tags of one room: trimmed, no duplicates, at most 40 characters each and 40 tags
const cleanTags = (v: unknown): string[] => {
  const out: string[] = [];
  if (Array.isArray(v)) for (const t of v) {
    const s = String(t).trim().slice(0, 40);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, 40);
};

// Reads the multipart form sent by the property form and validates it.
// Used by both create (POST) and update (PUT) so the rules live in one place.
export function parsePropertyForm(fd: FormData, role: Role) {
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
  // const areaSqft = optInt("areaSqft", "Area");
  const floors = optInt("floors", "Floors");
  const roomsPerFloor = optInt("roomsPerFloor", "Rooms per floor");
  // for (const f of [bedrooms, bathrooms, areaSqft, floors]) if ("error" in f && f.error) return fail(f.error);
  for (const f of [bedrooms, bathrooms, floors, roomsPerFloor]) if ("error" in f && f.error) return fail(f.error);
  
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

  const isBuilding = type === "BUILDING";
  const flatLike = type !== "PG" && !isBuilding;
  const sharing = type === "PG" || isBuilding ? true : fd.get("sharing") === "on";
  if ((type === "PG" || isBuilding) && !(floors.value && floors.value >= 1)) return fail("Enter the number of floors.");
  // Rooms
  let rawRooms: unknown;
  try { rawRooms = JSON.parse(str("rooms") || "[]"); } catch { rawRooms = null; }
  if (!Array.isArray(rawRooms) || rawRooms.length === 0) return fail(isBuilding ? "Add at least one flat." : "Add at least one room.");
  // PG: the rooms come from the floor setup (categories, rooms and bathrooms per floor), so the total is simply
  // the number of rooms generated. Sharing flats/apartments keep Bedrooms as a strict limit.
  let pgPlan: ReturnType<typeof parseStoredPlan> | null = null;
  if (type === "PG") {
    pgPlan = parseStoredPlan(str("pgConfig"), floors.value ?? 0);
    if ("error" in pgPlan) return fail(pgPlan.error);
    const planned = pgPlan.plan.floors.reduce((s, f) => s + f.rooms, 0);
    if (planned !== rawRooms.length) return fail("The floor setup and the generated rooms do not match. Open the floor generator and save again.");
  } else if (flatLike && sharing) {
    const declared = bedrooms.value;
    if (!declared || declared < 1) {
      return fail("Enter the number of bedrooms in Specifications.");
    }
    if (rawRooms.length > declared) {
      return fail(`You declared ${declared} rooms but added ${rawRooms.length}. Remove ${rawRooms.length - declared} or raise the total in Specifications.`);
    }
  }

  // A whole flat holds as many people as the owner says; rooms rented one by one keep the per-room limit
  const maxSeats = type === "PG" ? MAX_SEATS.PG : isBuilding ? 1 : sharing ? MAX_SEATS.OTHER : MAX_SEATS.WHOLE;
  const rooms: RoomInput[] = [];
  for (const r of rawRooms as Record<string, unknown>[]) {
    const room: RoomInput = {
      id: typeof r.id === "string" && r.id ? r.id : undefined,
      label: String(r.label ?? "").trim(),
      capacity: Number(r.capacity),
      ac: (type === "PG" || (flatLike && sharing)) && r.ac === true,
      rent: Number(r.rent),
      occupied: Number(r.occupied ?? 0),
      floor: (type === "PG" || isBuilding) && r.floor !== "" && r.floor != null ? Number(r.floor) : null,
      roomType: isBuilding ? (r.roomType === "SHAREABLE" ? "SHAREABLE" : "SINGLE") : flatLike && sharing ? String(r.roomType ?? "").trim().slice(0, 40) || null : flatLike && fd.get("sharedLiving") === "on" ? "SHAREABLE" : null,
      sizeSqm: (flatLike || isBuilding) && String(r.sizeSqm ?? "").trim() !== "" ? Number(r.sizeSqm) : null,
      bathroomAttached: r.bathroomAttached !== false,
      bathroomAreaSqm: flatLike && String(r.bathroomAreaSqm ?? "").trim() !== "" ? Number(r.bathroomAreaSqm) : null,
      bedrooms: isBuilding && String(r.bedrooms ?? "").trim() !== "" ? Number(r.bedrooms) : null,
      bathrooms: isBuilding && String(r.bathrooms ?? "").trim() !== "" ? Number(r.bathrooms) : null,
      furnishing: isBuilding ? String(r.furnishing ?? "") : null,
      features: isBuilding ? cleanTags(r.features) : [],
      images: ((flatLike && sharing) || isBuilding) && Array.isArray(r.images) ? r.images.map(String).slice(0, isBuilding ? 10 : 5) : [],
    };
    if (!room.label) return fail(isBuilding ? "Every flat needs a flat number." : "Every room needs a name.");
    if (isBuilding) {
      room.capacity = 1; room.occupied = 0;
      if (room.bedrooms === null || !Number.isInteger(room.bedrooms) || room.bedrooms < 1 || room.bedrooms > 20) return fail(`${room.label}: choose how many BHK.`);
      if (room.bathrooms === null || !Number.isInteger(room.bathrooms) || room.bathrooms < 1 || room.bathrooms > 20) return fail(`${room.label}: enter the number of bathrooms.`);
      if (room.sizeSqm === null || !(room.sizeSqm > 0 && room.sizeSqm <= 10_000)) return fail(`${room.label}: enter the flat area in m².`);
      if (!(FURNISHING as readonly string[]).includes(room.furnishing ?? "")) return fail(`${room.label}: choose the furnishing.`);
    } // a flat is one unit; a shareable flat has no people limit
    if (flatLike && !sharing) { room.capacity = 1; room.occupied = 0; } // a whole flat is one unit; a shared flat has no people limit
    if (flatLike && sharing) {
      if (room.sizeSqm === null || !(room.sizeSqm > 0 && room.sizeSqm <= 10_000)) return fail(`${room.label}: enter the room size in m².`);
      if (room.bathroomAreaSqm === null || !(room.bathroomAreaSqm > 0 && room.bathroomAreaSqm <= 10_000)) {
        return fail(`${room.label}: enter the ${room.bathroomAttached ? "bathroom" : "common washroom"} area in m².`);
      }
    }
    if (room.images.some((p) => !/^rooms\/[a-f0-9]+\.(jpg|png|webp)$/.test(p))) return fail("Invalid room photo.");
    if ((type === "PG" || isBuilding) && room.floor === null) return fail(`${room.label}: choose a floor.`);
    if (!Number.isInteger(room.capacity) || room.capacity < 1 || room.capacity > maxSeats) {
      return fail(`${room.label}: seats must be between 1 and ${maxSeats}.`);
    }
    if (!Number.isInteger(room.rent) || room.rent < 0) return fail(`${room.label}: enter a valid rent.`);
    if (!Number.isInteger(room.occupied) || room.occupied < 0 || room.occupied > room.capacity) {
      return fail(`${room.label}: occupancy must be between 0 and ${room.capacity}.`);
    }
    if (room.floor !== null && (!Number.isInteger(room.floor) || room.floor < 1 || room.floor > (floors.value ?? 100))) {
      return fail(`${room.label}: choose a floor between 1 and ${floors.value ?? 100}.`);
    }
    rooms.push(room);
  }
  if (isBuilding) {
    const seen = new Set<string>();
    for (const r of rooms) {
      const k = `${r.floor}|${r.label.toLowerCase()}`;
      if (seen.has(k)) return fail(`Flat ${r.label} is added twice on floor ${r.floor}.`);
      seen.add(k);
    }
  }
  if (!sharing && rooms.length !== 1) {
    return fail("A flat rented as a whole has exactly one unit.");
  }
  // New room photos arrive as roomImages_<room index>
  const roomFiles: File[][] = rooms.map((_, i) =>
    (flatLike && sharing) || isBuilding ? fd.getAll(`roomImages_${i}`).filter((f): f is File => f instanceof File && f.size > 0) : []
  );
  for (const [i, files] of roomFiles.entries()) {
    const maxPhotos = isBuilding ? 10 : 5;
    if (rooms[i].images.length + files.length > maxPhotos) return fail(`${rooms[i].label}: up to ${maxPhotos} photos per ${isBuilding ? "flat" : "room"}.`);
    for (const f of files) { const e = checkFile(f, "image"); if (e) return fail(e); }
  }
  const listing = parseListingFields(fd, role);
  if ("error" in listing) return fail(listing.error);
  if (listing.videoFile) { const e = checkFile(listing.videoFile, "video"); if (e) return fail(e); }

  // PG category media is attached to a seater category, not to each room.
  const categoryMedia: RoomCategoryMediaInput[] = [];
  const categoryCounts: Record<number, { images: number; videos: number }> = {};
  for (const [key, value] of fd.entries()) {
    const match = /^categoryMedia_(\d+)_(images|videos)$/.exec(key);
    if (!match || !(value instanceof File) || value.size === 0) continue;
    const capacity = Number(match[1]);
    if (type !== "PG" || !Number.isInteger(capacity) || capacity < 1 || capacity > MAX_SEATS.PG) {
      return fail("Invalid PG room category media selection.");
    }
    const mediaType = match[2] === "images" ? "IMAGE" : "VIDEO";
    const error = checkFile(value, mediaType === "IMAGE" ? "image" : "video");
    if (error) return fail(error);
    const counts = categoryCounts[capacity] ?? { images: 0, videos: 0 };
    if (mediaType === "IMAGE") counts.images += 1;
    else counts.videos += 1;
    categoryCounts[capacity] = counts;
    if (counts.images > 10) return fail(`${capacity} seater category can have up to 10 photos.`);
    if (counts.videos > 5) return fail(`${capacity} seater category can have up to 5 videos.`);
    categoryMedia.push({ capacity, mediaType, file: value });
  }
  if (categoryMedia.some((media) => !rooms.some((room) => room.capacity === media.capacity))) {
    return fail("Upload room media only for categories that contain rooms.");
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
      ...listing.data,
      name, type, address, city, sharing, latitude, longitude,
      description: str("description") || null,
      bedrooms: type === "PG" || isBuilding ? null : (bedrooms.value ?? null),
      // PG bathrooms are counted per floor in the floor setup
      bathrooms: pgPlan && "plan" in pgPlan ? pgPlan.plan.floors.reduce((s, f) => { const b = storedFloorBaths(pgPlan.plan, f); return s + b.attached + b.common; }, 0) : (bathrooms.value ?? null),
      areaSqft: typeof listing.data.builtUpAreaSqm === "number" ? Math.round(listing.data.builtUpAreaSqm * 10.7639) : null,
      floors: floors.value ?? null,
      roomsPerFloor: type === "PG" ? (roomsPerFloor.value ?? null) : null,
      totalRooms: type === "PG" || isBuilding ? rooms.length : null,
      pgConfig: pgPlan && "plan" in pgPlan ? pgPlan.plan : {},
      // PG bathrooms are described by pgConfig (one count per floor), not by room category rows
      ...(pgPlan && "plan" in pgPlan
        ? { bathroomLayout: pgPlan.plan.floors.filter((f) => f.rooms > 0).map((f) => { const b = storedFloorBaths(pgPlan.plan, f); return { type: `Floor ${f.floor} – ${[b.attached > 0 ? `${b.attached} attached` : "", b.common > 0 ? `${b.common} common` : ""].filter(Boolean).join(", ") || "none"}`, size: "" }; }) }
        : {}),
    },
    rooms, roomFiles, images, docs, categoryMedia,
    removeCategoryMediaIds: ids("removeCategoryMediaIds"),
    removeImageIds: ids("removeImageIds"),
    removeDocIds: ids("removeDocIds"),
    videoFile: listing.videoFile,
    removeVideo: listing.removeVideo,
    imageOrder: str("imageOrder"),
  };
}

// Final photo order sent by the form: existing image ids plus "new:<n>" for new uploads.
export function imageOrder(raw: string, keptIds: string[], newCount: number): string[] {
  const valid = [...keptIds, ...Array.from({ length: newCount }, (_, i) => `new:${i}`)];
  let given: unknown;
  try { given = JSON.parse(raw || "[]"); } catch { given = []; }
  const out: string[] = [];
  for (const t of Array.isArray(given) ? given : []) {
    if (typeof t === "string" && valid.includes(t) && !out.includes(t)) out.push(t);
  }
  for (const t of valid) if (!out.includes(t)) out.push(t);
  return out;
}