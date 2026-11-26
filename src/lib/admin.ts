import { redirect } from "next/navigation";
import { getSessionUser } from "./current-user";

// For Super Admin pages. Signed-out users go to login, everyone else back to the dashboard.
// Reads the role from the access token, so this costs no database query. The middleware already blocks /admin
// for non-Super-Admins using the same token, and every API route that changes data still checks the database.
export async function requireSuperAdmin() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "SUPER_ADMIN") redirect("/dashboard");
  return me;
}
