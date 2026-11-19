// Flats rented as one unit (Building flats, whole Apartment/Flat): one main tenant carries rent, bills and the resident link.
// Everyone else is a person sharing the flat. Also copes with older rows saved before `isHousemate` existed: the payer wins, then the earliest.
export function splitMain<T extends { isHousemate: boolean; monthlyRent: number; createdAt: Date }>(allocs: readonly T[]) {
  const sorted = [...allocs].sort((a, b) =>
    Number(a.isHousemate) - Number(b.isHousemate) || b.monthlyRent - a.monthlyRent || a.createdAt.getTime() - b.createdAt.getTime());
  return { main: sorted[0] as T | undefined, shared: sorted.slice(1) };
}
