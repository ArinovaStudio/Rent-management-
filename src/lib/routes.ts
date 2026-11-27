// Super Admin works under /admin; everyone else under /dashboard.
export const propertiesBase = (role: string) =>
  role === "SUPER_ADMIN" ? "/admin/properties" : "/dashboard/properties";

// Back arrow on a property sub-page (rooms, ledger, managers, edit).
// Super Admin has a property page of its own, so Back returns there. Everyone else goes to the list.
export const propertyHome = (role: string, propertyId: string) =>
  role === "SUPER_ADMIN" ? `/admin/properties/${propertyId}` : "/dashboard/properties";