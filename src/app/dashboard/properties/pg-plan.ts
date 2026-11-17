import { blankRoom, type RoomState } from "./room-types";
import { catName, finalRent, sameCat, sortCats, emptyFloor, type PgCategory, type PgFloor, type PgPlan } from "@/lib/pg-config";

export type BuildResult = { rooms: RoomState[]; errors: string[] };

// Generates the PG's rooms from its plan. Names ("Room 101") and rents come from the plan, nothing is typed.
// Rooms that already exist (they have an id) are kept whenever the plan still has room for them, so
// their residents, photos and names are never lost. A room with residents is never removed.
export function buildPgRooms(plan: PgPlan, floorCount: number, existing: RoomState[]): BuildResult {
  const errors: string[] = [];
  const claimed = new Set<RoomState>();
  type Slot = { floor: number; cat: PgCategory; adjust: string; keep: RoomState[]; add: number };
  const slots: Slot[] = [];

  for (let f = 1; f <= floorCount; f += 1) {
    const pf = plan.floors.find((x) => x.floor === f);
    if (!pf) continue;
    for (const pc of sortCats(pf.cats)) {
      const cat = plan.categories.find((c) => sameCat(c, pc));
      if (!cat) continue;
      const qty = Math.max(0, Math.floor(Number(pc.qty) || 0));
      const here = existing.filter((r) => !claimed.has(r) && Number(r.floor) === f && Number(r.capacity) === pc.capacity && r.ac === pc.ac);
      let keep = here;
      if (here.length > qty) {
        const dropN = here.length - qty;
        const droppable = [...here].reverse().filter((r) => Number(r.occupied) === 0).slice(0, dropN);
        if (droppable.length < dropN) errors.push(`Floor ${f}: some ${catName(pc)} rooms have residents. Reallocate them before reducing to ${qty}.`);
        keep = here.filter((r) => !droppable.includes(r));
      }
      keep.forEach((r) => claimed.add(r));
      slots.push({ floor: f, cat, adjust: pf.adjust, keep, add: Math.max(0, qty - keep.length) });
    }
  }

  for (const r of existing) {
    if (!claimed.has(r) && Number(r.occupied) > 0) errors.push(`${r.label} has residents but is no longer part of the floor setup.`);
  }

  const used = new Set(slots.flatMap((s) => s.keep.map((r) => r.label.trim().toLowerCase())));
  const counters: Record<number, number> = {};
  const nextName = (f: number) => {
    for (;;) {
      const i = counters[f] ?? 1;
      counters[f] = i + 1;
      const label = `Room ${f}${String(i).padStart(2, "0")}`;
      if (!used.has(label.toLowerCase())) { used.add(label.toLowerCase()); return label; }
    }
  };

  const rooms: RoomState[] = [];
  for (const s of slots) {
    const rent = finalRent(s.cat, s.adjust);
    const base = { floor: String(s.floor), capacity: String(s.cat.capacity), ac: s.cat.ac, rent, bathAttached: s.cat.attached };
    rooms.push(...s.keep.map((r) => ({ ...r, ...base })));
    for (let i = 0; i < s.add; i += 1) rooms.push({ ...blankRoom(nextName(s.floor)), ...base });
  }
  return { rooms, errors };
}

// Older PG properties have rooms but no plan yet: rebuild one from the rooms so editing starts from what exists.
export function planFromRooms(rooms: RoomState[]): PgPlan {
  const mode = (vals: string[]) => {
    const count = new Map<string, number>();
    vals.forEach((v) => count.set(v, (count.get(v) ?? 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  };
  const ids = sortCats(
    Array.from(new Map(rooms.map((r) => [`${r.capacity}-${r.ac}`, { capacity: Number(r.capacity), ac: r.ac }])).values())
  );
  const categories: PgCategory[] = ids.map((id) => {
    const here = rooms.filter((r) => Number(r.capacity) === id.capacity && r.ac === id.ac);
    return { ...id, rent: mode(here.map((r) => r.rent)), attached: here.every((r) => r.bathAttached) };
  });
  const floorNos = Array.from(new Set(rooms.map((r) => Number(r.floor)).filter((n) => n >= 1))).sort((a, b) => a - b);
  const floors: PgFloor[] = floorNos.map((f) => {
    const here = rooms.filter((r) => Number(r.floor) === f);
    const cats = ids
      .map((id) => ({ ...id, qty: String(here.filter((r) => Number(r.capacity) === id.capacity && r.ac === id.ac).length) }))
      .filter((c) => c.qty !== "0");
    const first = here[0];
    const cat = first ? categories.find((c) => c.capacity === Number(first.capacity) && c.ac === first.ac) : undefined;
    const adjust = first && cat && first.rent.trim() !== "" && cat.rent !== "" ? String(Number(first.rent) - Number(cat.rent)) : "0";
    return { ...emptyFloor(f, String(here.length)), cats, adjust };
  });
  return { categories, floors };
}