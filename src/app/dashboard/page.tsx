import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  PROPERTY_ADMIN: "Property Admin",
  PROPERTY_MANAGER: "Property Manager",
} as const;

export default async function Dashboard() {
  const token = (await cookies()).get("access_token")?.value;
  const session = token ? await verifyAccessToken(token) : null;
  const user = session && (await prisma.user.findUnique({ where: { id: session.userId } }));
  if (!user) redirect("/login");

  return (
    <main>
      <h1>Dashboard</h1>
      <p>{user.name} ({user.email})</p>
      <p>Role: {ROLE_LABEL[user.role]}</p>
      {user.role !== "PROPERTY_MANAGER" && (
        <p><a href="/dashboard/users">Manage users</a></p>
      )}
      {user.role !== "PROPERTY_MANAGER" && (
        <p><a href="/dashboard/properties">Properties</a></p>
      )}
      <form action="/api/auth/logout" method="post">
        <button>Sign out</button>
      </form>
    </main>
  );
}
