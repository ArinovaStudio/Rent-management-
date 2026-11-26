import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import PropertyForm from "../property-form";
import { AdminShell } from "@/components/admin/AdminShell";
import { listedByInfo } from "@/lib/property-fields";

export default async function NewPropertyPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (me.role !== "SUPER_ADMIN" && me.role !== "PROPERTY_ADMIN") redirect("/dashboard");

  // Super Admin: owners dropdown only. Property Admin: one user row covers verification + listed-by.
  const [owners, lister] = await Promise.all([
    me.role === "SUPER_ADMIN"
      ? prisma.user.findMany({
          where: { role: "PROPERTY_ADMIN" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve(undefined),
    me.role === "PROPERTY_ADMIN"
      ? prisma.user.findUnique({
          where: { id: me.id },
          select: {
            name: true, email: true, role: true,
            ownerProfile: { select: { legalName: true, phone: true, accountType: true, verificationStatus: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  if (me.role === "PROPERTY_ADMIN" && !canManageProperties(me.role, lister?.ownerProfile?.verificationStatus ?? null)) {
    redirect("/dashboard");
  }

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      {me.role === "PROPERTY_ADMIN" && (
        <p className="mb-6 rounded-2xl bg-background px-5 py-3 text-sm text-muted-foreground">New properties are reviewed by the Super Admin before they go live.</p>
      )}
      <PropertyForm owners={owners} role={me.role} listedBy={lister ? listedByInfo(lister) : null} />
    </AdminShell>
  );
}
