import type { Prisma, Property } from "@prisma/client";
import type { Role } from "./jwt";
import { canReadField, canWriteField } from "./permissions";

export const CATEGORIES = ["RESIDENTIAL", "COMMERCIAL", "LAND"] as const;
export const FURNISHING = ["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"] as const;
export const FACING = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export const AMENITY_PRESETS = ["Lift", "Power backup", "24x7 security", "CCTV", "Parking", "Gym", "Swimming pool", "Garden", "Play area", "Clubhouse", "24x7 water", "Wi-Fi"];
export const FEATURE_PRESETS = ["Vitrified tiles", "Modular kitchen", "Wooden flooring", "False ceiling", "Granite countertops", "Wardrobes", "Balcony", "Smart locks", "Air conditioning"];
export const ROOM_TYPES = ["Bedroom", "Master bedroom", "Living room", "Kitchen", "Dining", "Study", "Balcony", "Store room"];
export const BATH_TYPES = ["Attached", "Common", "Master", "Powder room"];
export const label = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");

const MAX_MONEY = 2_000_000_000;
type Data = Partial<Prisma.PropertyUncheckedCreateInput>;

class FieldError extends Error {}
const bad = (m: string): never => { throw new FieldError(m); };

// Validates the new listing fields. Only fields the role may write end up in `data`,
// so an update never touches the others.
export function parseListingFields(fd: FormData, role: Role):
  { data: Data; videoFile: File | null; removeVideo: boolean } | { error: string } {
  try { return run(fd, role); } catch (e) {
    if (e instanceof FieldError) return { error: e.message };
    throw e;
  }
}

function run(fd: FormData, role: Role) {
  const str = (k: string) => String(fd.get(k) ?? "").trim();
  const data: Data = {};
  const put = <K extends keyof Data>(k: K, v: Data[K]) => { if (canWriteField(role, k)) data[k] = v; };

  const text = (k: string, name: string, max: number) => {
    const v = str(k);
    if (v.length > max) bad(`${name} must be at most ${max} characters.`);
    return v || null;
  };
  const oneOf = <T extends string>(k: string, name: string, list: readonly T[]) => {
    const v = str(k);
    if (!v) return null;
    if (!list.includes(v as T)) bad(`Choose a valid ${name}.`);
    return v as T;
  };
  const num = (k: string, name: string, min: number, max: number, whole = false) => {
    const v = str(k);
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max || (whole && !Number.isInteger(n))) {
      bad(`${name} must be ${whole ? "a whole number " : "a number "}between ${min} and ${max}.`);
    }
    return n;
  };
  const json = (k: string): unknown[] => {
    try { const v = JSON.parse(str(k) || "[]"); if (Array.isArray(v)) return v; } catch { /* fall through */ }
    return bad("Invalid form data.");
  };
  // Rows of { a: text, b: positive number }, e.g. { type, size }
  const rows = (k: string, name: string, max: number, a: string, b: string, bMax: number) => {
    const list = json(k);
    if (list.length > max) bad(`Too many ${name} rows (max ${max}).`);
    return list.map((r) => {
      const o = r as Record<string, unknown>;
      const label = String(o[a] ?? "").trim();
      const n = Number(o[b]);
      if (!label || label.length > 60) bad(`Every ${name} row needs a name (up to 60 characters).`);
      if (!(n > 0 && n <= bMax)) bad(`${label}: enter a number between 0 and ${bMax}.`);
      return { [a]: label, [b]: n };
    });
  };
  const tags = (k: string, name: string) => {
    const out: string[] = [];
    for (const t of json(k)) {
      const v = String(t).trim();
      if (!v) continue;
      if (v.length > 40) bad(`Each ${name} must be at most 40 characters.`);
      if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
    }
    if (out.length > 40) bad(`Too many ${name}s (max 40).`);
    return out;
  };

  // 2. Basics
  const category = oneOf("category", "category", CATEGORIES) ?? bad("Choose a category.");
  put("category", category);
  put("district", text("district", "District", 80));
  put("state", text("state", "State", 80));
  put("yearBuilt", num("yearBuilt", "Year built", 1800, new Date().getFullYear() + 10, true));
  put("developer", text("developer", "Developer", 120));

  // 3. Price & size (price per m² is always calculated here, never trusted from the browser)
  const price = num("price", "Price", 0, MAX_MONEY, true);
  const builtUp = num("builtUpAreaSqm", "Built-up area", 0.01, 1_000_000);
  put("price", price);
  put("serviceCharge", num("serviceCharge", "Service charge", 0, MAX_MONEY, true));
  put("builtUpAreaSqm", builtUp);
  put("plotSizeSqm", num("plotSizeSqm", "Plot size", 0.01, 10_000_000));
  put("pricePerSqm", price && builtUp ? Math.round(price / builtUp) : null);

  // 4. Description
  put("shortDescription", text("shortDescription", "Short description", 300));
  const videoUrl = text("videoUrl", "Video URL", 500);
  if (videoUrl) {
    let ok = false;
    try { const u = new URL(videoUrl); ok = u.protocol === "https:" || u.protocol === "http:"; } catch { /* invalid */ }
    if (!ok) bad("Enter a valid video URL starting with http:// or https://.");
  }
  put("videoUrl", videoUrl);
  const vf = fd.get("video");
  const videoFile = vf instanceof File && vf.size > 0 ? vf : null;
  const removeVideo = fd.get("removeVideo") === "on";

  // 5. Specifications (floors is validated in property-form.ts)
  put("parkingSpaces", num("parkingSpaces", "Parking spaces", 0, 100, true));
  put("furnishing", oneOf("furnishing", "furnishing", FURNISHING));
  put("facing", oneOf("facing", "facing", FACING));
  const deed = text("titleDeedNumber", "Title deed number", 50);
  if (deed && !/^[A-Za-z0-9\-/ ]+$/.test(deed)) bad("Title deed number can only contain letters, numbers, spaces, - and /.");
  put("titleDeedNumber", deed);
  const hd = str("handoverDate");
  if (hd && (!/^\d{4}-\d{2}-\d{2}$/.test(hd) || Number.isNaN(Date.parse(hd)))) bad("Enter a valid handover date.");
  put("handoverDate", hd ? new Date(`${hd}T00:00:00.000Z`) : null);

  // 6, 7, 8, 9. Dynamic lists
  put("roomLayout", rows("roomLayout", "room", 30, "type", "size", 10_000));
  put("bathroomLayout", rows("bathroomLayout", "bathroom", 30, "type", "size", 10_000));
  put("amenities", tags("amenities", "amenity"));
  put("features", tags("features", "feature"));
  put("nearbyPlaces", rows("nearbyPlaces", "nearby place", 20, "name", "distanceKm", 500));

  // 10. Visibility
  put("isPublished", fd.get("isPublished") === "on");
  put("featured", fd.get("featured") === "on");

  return { data, videoFile, removeVideo };
}

// Values for the form when editing. Fields the role can't read are left out.
export function listingForClient(p: Property, role: Role) {
  const all = {
    category: p.category ?? "RESIDENTIAL",
    district: p.district ?? "", state: p.state ?? "", yearBuilt: p.yearBuilt, developer: p.developer ?? "",
    price: p.price, serviceCharge: p.serviceCharge,
    // older properties only have sq ft: convert so nothing is lost on the first save
    builtUpAreaSqm: p.builtUpAreaSqm ?? (p.areaSqft ? Math.round((p.areaSqft / 10.7639) * 10) / 10 : null),
    plotSizeSqm: p.plotSizeSqm,
    shortDescription: p.shortDescription ?? "", videoUrl: p.videoUrl ?? "", videoPath: p.videoPath,
    parkingSpaces: p.parkingSpaces, furnishing: p.furnishing ?? "", facing: p.facing ?? "",
    titleDeedNumber: p.titleDeedNumber ?? "",
    handoverDate: p.handoverDate ? p.handoverDate.toISOString().slice(0, 10) : "",
    roomLayout: p.roomLayout, bathroomLayout: p.bathroomLayout,
    amenities: p.amenities, features: p.features,  nearbyPlaces: p.nearbyPlaces,
    isPublished: p.isPublished, featured: p.featured,
  };
  return Object.fromEntries(Object.entries(all).filter(([k]) => canReadField(role, k))) as Partial<typeof all>;
}
export type ListingClient = ReturnType<typeof listingForClient>;

// ---- "Listed by": read from the owner's account, never typed into the form ----
export const PLATFORM_LISTER = "Property Management Team"; // shown when a Super Admin account is the lister

export type ListedBy = { title: string; subtitle: string | null; email: string | null; phone: string | null };

export function listedByInfo(owner: {
  name: string; email: string; role: string;
  ownerProfile: { legalName: string; phone: string | null; accountType: string } | null;
}): ListedBy {
  if (owner.role === "SUPER_ADMIN") {
    return { title: PLATFORM_LISTER, subtitle: "Listed directly by the platform", email: null, phone: null };
  }
  const p = owner.ownerProfile;
  return {
    title: p?.legalName || owner.name,
    subtitle: p ? (p.accountType === "COMPANY" ? "Company" : "Individual owner") : "Property owner",
    email: owner.email,
    phone: p?.phone ?? null,
  };
}