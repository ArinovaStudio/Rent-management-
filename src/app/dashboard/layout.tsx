import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { hasUnfinishedOnboarding } from "@/lib/owner-status";

// Owners who registered through the wizard can't use the dashboard until they've submitted all
// three steps. Accounts without an owner profile (older accounts, admins, managers) pass straight through.
// The middleware has already made sure there is a valid session.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (me && (await hasUnfinishedOnboarding(me.id))) redirect("/register");
  return children;
}
