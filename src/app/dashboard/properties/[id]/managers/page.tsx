import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { propertiesBase } from "@/lib/routes";
import { AdminShell } from "@/components/admin/AdminShell";
import ManagerAssigner from "./manager-assigner";

export default async function PropertyManagersPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      managers: {
        include: { manager: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
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
  const name = (me as unknown as { name?: string }).name ?? "Account";

  return (
    <AdminShell role={me.role} name={name}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertiesBase(me.role)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Managers for this property</p>
        </div>
      </div>
      <ManagerAssigner propertyId={property.id} assigned={property.managers.map((m) => m.manager)} candidates={candidates} />
      <p className="mt-6 text-sm text-muted-foreground">
        Need a new manager account? <a className="text-primary underline" href="/dashboard/users">Create one here</a>.
      </p>
    </AdminShell>
  );
}