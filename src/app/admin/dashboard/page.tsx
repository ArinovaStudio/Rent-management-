import { requireSuperAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/AdminShell";
import DashboardView from "@/components/admin/DashboardView";

export default async function AdminDashboardPage() {
  const me = await requireSuperAdmin();

  return (
    <AdminShell role={me.role} name={me.name}>
      <DashboardView name={me.name} />
    </AdminShell>
  );
}
