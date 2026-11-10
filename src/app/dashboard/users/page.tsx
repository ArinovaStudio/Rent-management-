import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { CAN_CREATE, canDelete } from "@/lib/permissions";
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

  return (
    <main>
      <h1>Users</h1>
      <CreateUserForm roles={roles} />
      <h2 style={{ fontSize: "1.1rem", marginTop: 32 }}>Existing accounts</h2>
      {users.length === 0 ? (
        <p className="muted">No accounts yet.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
            {users.map((u) => (
                <li key={u.id}>
                    {u.name} ({u.email}), {u.role.replace("_", " ").toLowerCase()}
                    {canDelete(me, u) && (
                        <DeleteUserButton id={u.id} name={u.name} deletesManagers={u.role === "PROPERTY_ADMIN"} />
                    )}
                </li>
            ))}
        </ul>
      )}
      <p className="muted"><a href="/dashboard">Back to dashboard</a></p>
    </main>
  );
}