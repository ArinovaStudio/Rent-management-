export const PG_MAX_SEATS = 5;

// attached: rooms of this category have their own washroom
export type PgCategory = { capacity: number; ac: boolean; rent: string; attached: boolean };
export type PgFloorCat = { capacity: number; ac: boolean; qty: string };
// bathrooms: common bathrooms on the floor, only used when the floor has rooms of a category without an attached washroom
export type PgFloor = { floor: number; rooms: string; bathrooms: string; adjust: string; cats: PgFloorCat[] };
export type PgPlan = { categories: PgCategory[]; floors: PgFloor[] };

type CatId = { capacity: number; ac: boolean };

export const catKey = (c: CatId) => `${c.capacity}-${c.ac ? "ac" : "non"}`;
export const catName = (c: CatId) => `${c.capacity}-seater${c.ac ? " AC" : ""}`;
export const sameCat = (a: CatId, b: CatId) => a.capacity === b.capacity && a.ac === b.ac;
export const sortCats = <T extends CatId>(list: T[]) =>
  [...list].sort((a, b) => a.capacity - b.capacity || Number(a.ac) - Number(b.ac));

export const emptyPlan = (): PgPlan => ({ categories: [], floors: [] });
export const emptyFloor = (floor: number, rooms = ""): PgFloor => ({ floor, rooms, bathrooms: "", adjust: "0", cats: [] });

// Washrooms on a floor come from the categories: rooms of an attached category have their own,
// the other rooms use the floor's common bathrooms.
const attachedOf = (categories: PgCategory[], c: CatId) => categories.find((x) => sameCat(x, c))?.attached === true;
export const needsCommon = (f: PgFloor, categories: PgCategory[]) => f.cats.some((c) => !attachedOf(categories, c));
export const floorAttachedRooms = (f: PgFloor, categories: PgCategory[]) =>
  f.cats.reduce((s, c) => s + (attachedOf(categories, c) ? Number(c.qty) || 0 : 0), 0);
export const floorCommon = (f: PgFloor, categories: PgCategory[]) => (needsCommon(f, categories) ? Number(f.bathrooms) || 0 : 0);
export const floorBaths = (f: PgFloor, categories: PgCategory[]) => floorAttachedRooms(f, categories) + floorCommon(f, categories);

// n rooms shared out as evenly as possible between k categories (the first ones get the remainder)
export const splitEvenly = (n: number, k: number) =>
  k <= 0 ? [] : Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));

export const finalRent = (cat: { rent: string }, adjust: string | number) =>
  cat.rent.trim() === "" ? "" : String(Math.max(0, Number(cat.rent) + (Number(adjust) || 0)));

const isInt = (v: string) => v.trim() !== "" && Number.isInteger(Number(v));

// First problem with one floor, or null
export function floorIssue(f: PgFloor, categories: PgCategory[]): string | null {
  if (!isInt(f.rooms) || Number(f.rooms) < 0) return `Floor ${f.floor}: enter the number of rooms.`;
  if (f.adjust.trim() !== "" && !isInt(f.adjust)) return `Floor ${f.floor}: the rent adjustment must be a whole number.`;
  const n = Number(f.rooms);
  if (n === 0) return null;
  if (f.cats.length === 0) return `Floor ${f.floor}: select at least one room category.`;
  if (needsCommon(f, categories) && (!isInt(f.bathrooms) || Number(f.bathrooms) < 0)) return `Floor ${f.floor}: enter the number of common bathrooms (0 if none).`;
  let sum = 0;
  for (const c of f.cats) {
    const cat = categories.find((x) => sameCat(x, c));
    if (!cat) return `Floor ${f.floor}: ${catName(c)} is no longer offered. Select a category again.`;
    if (!isInt(c.qty) || Number(c.qty) < 1) return `Floor ${f.floor}: enter how many ${catName(c)} rooms there are.`;
    if (cat.rent.trim() !== "" && Number(cat.rent) + (Number(f.adjust) || 0) < 0) return `Floor ${f.floor}: the rent adjustment makes ${catName(c)} rent negative.`;
    sum += Number(c.qty);
  }
  if (sum !== n) return `Floor ${f.floor}: the categories add up to ${sum} rooms, but the floor has ${n}.`;
  return null;
}

// All problems that stop the plan from being saved (floors 1..floorCount only)
export function planIssues(plan: PgPlan, floorCount: number): string[] {
  const out: string[] = [];
  if (plan.categories.length === 0) out.push("Choose the room categories you offer and set their rent.");
  const used = new Set<string>();
  let total = 0;
  for (let f = 1; f <= floorCount; f += 1) {
    const pf = plan.floors.find((x) => x.floor === f) ?? emptyFloor(f);
    const issue = floorIssue(pf, plan.categories);
    if (issue) out.push(issue);
    else total += Number(pf.rooms);
    pf.cats.forEach((c) => used.add(catKey(c)));
  }
  for (const c of plan.categories) {
    if (used.has(catKey(c)) && !isInt(c.rent)) out.push(`Enter the rent for ${catName(c)}.`);
  }
  if (out.length === 0 && total < 1) out.push("Add at least one room.");
  return out;
}

// ---- Stored form (what is kept in Property.pgConfig): same shape, numbers instead of strings ----
type StoredPlan = {
  categories: { capacity: number; ac: boolean; rent: number; attached: boolean }[];
  floors: { floor: number; rooms: number; bathrooms: number; adjust: number; cats: { capacity: number; ac: boolean; qty: number }[] }[];
};

export function toStored(plan: PgPlan, floorCount: number): StoredPlan {
  return {
    categories: plan.categories.map((c) => ({ capacity: c.capacity, ac: c.ac, rent: Number(c.rent) || 0, attached: c.attached })),
    floors: plan.floors
      .filter((f) => f.floor >= 1 && f.floor <= floorCount)
      .map((f) => ({
        floor: f.floor, rooms: Number(f.rooms) || 0, bathrooms: floorCommon(f, plan.categories), adjust: Number(f.adjust) || 0,
        cats: f.cats.map((c) => ({ capacity: c.capacity, ac: c.ac, qty: Number(c.qty) || 0 })),
      })),
  };
}

// Reads what the server saved. Returns null for older properties that have no plan yet.
export function fromStored(raw: unknown): PgPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { categories?: unknown; floors?: unknown };
  if (!Array.isArray(r.categories) || !Array.isArray(r.floors) || r.categories.length === 0) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "");
  return {
    categories: sortCats(
      (r.categories as Record<string, unknown>[]).map((c) => ({ capacity: Number(c.capacity), ac: c.ac === true, rent: num(c.rent), attached: c.attached !== false }))
    ),
    floors: (r.floors as Record<string, unknown>[]).map((f) => ({
      floor: Number(f.floor), rooms: num(f.rooms), bathrooms: num(f.bathrooms), adjust: num(f.adjust) || "0",
      cats: Array.isArray(f.cats) ? (f.cats as Record<string, unknown>[]).map((c) => ({ capacity: Number(c.capacity), ac: c.ac === true, qty: num(c.qty) })) : [],
    })),
  };
}

// Server side: validates the JSON sent by the form and returns the clean stored plan.
export function parseStoredPlan(raw: string, floorCount: number): { plan: StoredPlan } | { error: string } {
  let v: unknown;
  try { v = JSON.parse(raw || "{}"); } catch { return { error: "Invalid PG room setup." }; }
  const bad = { error: "Invalid PG room setup." } as const;
  if (!v || typeof v !== "object") return bad;
  const { categories, floors } = v as { categories?: unknown; floors?: unknown };
  if (!Array.isArray(categories) || !Array.isArray(floors) || categories.length === 0 || categories.length > PG_MAX_SEATS * 2) return bad;
  const int = (x: unknown, min: number, max: number) => typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;

  const cats: StoredPlan["categories"] = [];
  for (const c of categories as Record<string, unknown>[]) {
    if (!int(c.capacity, 1, PG_MAX_SEATS) || typeof c.ac !== "boolean" || !int(c.rent, 0, 1_000_000) || typeof c.attached !== "boolean") return bad;
    if (cats.some((x) => x.capacity === c.capacity && x.ac === c.ac)) return bad;
    cats.push({ capacity: c.capacity as number, ac: c.ac, rent: c.rent as number, attached: c.attached });
  }
  const out: StoredPlan["floors"] = [];
  for (const f of floors as Record<string, unknown>[]) {
    if (!int(f.floor, 1, floorCount) || out.some((x) => x.floor === f.floor)) return bad;
    if (!int(f.rooms, 0, 500) || !int(f.bathrooms, 0, 500) || !int(f.adjust, -1_000_000, 1_000_000) || !Array.isArray(f.cats)) return bad;
    const fc: StoredPlan["floors"][number]["cats"] = [];
    let sum = 0;
    for (const c of f.cats as Record<string, unknown>[]) {
      if (!int(c.capacity, 1, PG_MAX_SEATS) || typeof c.ac !== "boolean" || !int(c.qty, 1, 500)) return bad;
      if (!cats.some((x) => x.capacity === c.capacity && x.ac === c.ac)) return bad;
      fc.push({ capacity: c.capacity as number, ac: c.ac, qty: c.qty as number });
      sum += c.qty as number;
    }
    if (sum !== f.rooms) return bad;
    out.push({ floor: f.floor as number, rooms: f.rooms as number, bathrooms: f.bathrooms as number, adjust: f.adjust as number, cats: fc });
  }
  return { plan: { categories: cats, floors: out } };
}

// Server side: washrooms of a stored floor
export function storedFloorBaths(plan: StoredPlan, f: StoredPlan["floors"][number]) {
  const attached = f.cats.reduce((s, c) => s + (plan.categories.find((x) => x.capacity === c.capacity && x.ac === c.ac)?.attached ? c.qty : 0), 0);
  return { attached, common: f.bathrooms };
}