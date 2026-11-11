import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";

// For Super Admin pages. Signed-out users go to login, everyone else back to the dashboard.
export async function requireSuperAdmin() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "SUPER_ADMIN") redirect("/dashboard");
  return me;
}
