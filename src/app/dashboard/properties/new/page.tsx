import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";
import PropertyForm from "../property-form";

export default async function NewPropertyPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!canManageProperties(me.role, await getVerificationStatus(me.id))) redirect("/dashboard");

  // Only the Super Admin gets the "create for" dropdown.
  const owners =
    me.role === "SUPER_ADMIN"
      ? await prisma.user.findMany({
          where: { role: "PROPERTY_ADMIN" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : undefined;

  return (
    <main className="wide">
      <h1>Add property</h1>
      {me.role === "PROPERTY_ADMIN" && (
        <p className="muted" style={{ marginTop: 0 }}>New properties are reviewed by the Super Admin before they go live.</p>
      )}
      <PropertyForm owners={owners} />
      <p className="muted"><a href="/dashboard/properties">Back to properties</a></p>
    </main>
  );
}
