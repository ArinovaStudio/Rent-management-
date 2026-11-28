import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { propertyHome } from "@/lib/routes";
import { AdminShell } from "@/components/admin/AdminShell";
import ManagerAssigner from "./manager-assigner";
import { makePerson, userSel } from "./people-shared";

export default async function PropertyManagersPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true, name: true, ownerId: true,
      managers: { orderBy: { createdAt: "asc" }, select: { manager: { select: userSel } } },
    },
  });
  if (!property || !canEditProperty(me, property)) notFound();

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertyHome(me.role, property.id)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Managers of this property</p>
        </div>
      </div>
      <ManagerAssigner
        mode="managers"
        propertyId={property.id}
        people={property.managers.map((m) => makePerson(me, "manager", m.manager))}
        canAdd={me.role === "SUPER_ADMIN" || me.role === "PROPERTY_ADMIN"}
      />
    </AdminShell>
  );
}
