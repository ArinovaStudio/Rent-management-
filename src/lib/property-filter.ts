// Shared by the property list pages (owner/manager, super admin, approvals).
// Search + filter run in memory, so this works with any database.
// Filter params may be a single value or comma-separated (multi-select).
export type FilterParams = { q?: string; status?: string; type?: string; active?: string };

export const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Approved" },
  { value: "PENDING", label: "Pending review" },
  { value: "NEEDS_MORE_INFO", label: "More info needed" },
  { value: "REJECTED", label: "Rejected" },
];

export const TYPE_OPTIONS = [
  { value: "PG", label: "PG" },
  { value: "FLAT_APARTMENT", label: "Flat / Apartment" },
  { value: "BUILDING", label: "Building" },
];

export const ACTIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function splitFilter(v?: string): string[] {
  return v?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
}

export function hasFilters(f: FilterParams) {
  return !!(f.q?.trim() || f.status || f.type || f.active);
}

export function applyPropertyFilters<T extends { name: string; status: string; type: string; isActive: boolean }>(list: T[], f: FilterParams): T[] {
  const q = f.q?.trim().toLowerCase();
  const statuses = splitFilter(f.status);
  const types = splitFilter(f.type);
  const actives = splitFilter(f.active);
  return list.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (statuses.length && !statuses.includes(p.status)) return false;
    if (types.length) {
      const match = types.some((t) => {
        if (t === "FLAT_APARTMENT") return p.type === "FLAT" || p.type === "APARTMENT";
        return p.type === t;
      });
      if (!match) return false;
    }
    if (actives.length) {
      const match = actives.some((a) => (a === "active" && p.isActive) || (a === "inactive" && !p.isActive));
      if (!match) return false;
    }
    return true;
  });
}
