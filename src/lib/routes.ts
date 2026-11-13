// Super Admin works under /admin; everyone else under /dashboard.
export const propertiesBase = (role: string) =>
  role === "SUPER_ADMIN" ? "/admin/properties" : "/dashboard/properties";