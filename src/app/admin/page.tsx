import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { AdminShell } from "@/components/admin/AdminShell";
import DashboardView from "@/components/admin/DashboardView";

export default async function AdminDashboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role !== "SUPER_ADMIN") redirect("/dashboard");
  const name = (me as unknown as { name?: string }).name ?? "Admin";

  return (
    <AdminShell role={me.role} name={name}>
      <DashboardView name={name} />
    </AdminShell>
  );
}
