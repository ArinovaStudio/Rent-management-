import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { CAN_CREATE, canDelete } from "@/lib/permissions";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import CreateUserForm from "./create-user-form";
import DeleteUserButton from "./delete-user-button";

export default async function UsersPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const roles = CAN_CREATE[me.role];
  if (roles.length === 0) redirect("/dashboard");

  // Super Admin sees everyone else; a Property Admin sees only the accounts they created.
  const users = await prisma.user.findMany({
    where: me.role === "SUPER_ADMIN" ? { id: { not: me.id } } : { createdById: me.id },
    select: { id: true, name: true, email: true, role: true, createdById: true },
    orderBy: { createdAt: "desc" },
  });
  const name = (me as unknown as { name?: string }).name ?? "Account";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader title="Users" sub="Create accounts and keep their ID and documents on file." />
      <div className="space-y-6">
        <CreateUserForm roles={roles} />
        <Panel>
          <h2 className="mb-4 text-xl font-semibold">Existing accounts</h2>
          {users.length === 0 ? (
            <p className="text-muted-foreground">No accounts yet.</p>
          ) : (
            <ul className="divide-y divide-cream">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-cream px-3 py-1 text-xs capitalize">{u.role.replace(/_/g, " ").toLowerCase()}</span>
                    {canDelete(me, u) && <DeleteUserButton id={u.id} name={u.name} deletesManagers={u.role === "PROPERTY_ADMIN"} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}