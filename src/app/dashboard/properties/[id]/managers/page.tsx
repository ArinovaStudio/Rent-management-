import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { propertiesBase } from "@/lib/routes";
import { AdminShell } from "@/components/admin/AdminShell";
import ManagerAssigner from "./manager-assigner";

export default async function PropertyManagersPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true, name: true, ownerId: true,
      managers: {
        orderBy: { createdAt: "asc" },
        select: { managerId: true, manager: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!property || !canEditProperty(me, property)) notFound();

  const candidates = await prisma.user.findMany({
    where: {
      role: "PROPERTY_MANAGER",
      id: { notIn: property.managers.map((m) => m.managerId) },
      ...(me.role === "SUPER_ADMIN" ? {} : { createdById: me.id }),
      ownerProfile: { verificationStatus: "VERIFIED" },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertiesBase(me.role)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Managers for this property</p>
        </div>
      </div>
      <ManagerAssigner propertyId={property.id} assigned={property.managers.map((m) => m.manager)} candidates={candidates} />
      <p className="mt-6 text-sm text-muted-foreground">
        Need a new manager account? Open the property editor and use <strong>Add manager</strong> under Owner Information.
      </p>
    </AdminShell>
  );
}
