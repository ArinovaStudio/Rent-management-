import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/current-user";
import { hasUnfinishedOnboarding } from "@/lib/owner-status";

// Owners who registered through the wizard can't use the dashboard until they've submitted all
// three steps. Accounts without an owner profile (older accounts, admins, managers) pass straight through.
// The middleware has already made sure there is a valid session.
// Only Property Admins go through the wizard, so only they cost a database lookup here; everyone else
// is let through with no query at all.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getSessionUser();
  if (me?.role === "PROPERTY_ADMIN" && (await hasUnfinishedOnboarding(me.id))) redirect("/register");
  return children;
}
