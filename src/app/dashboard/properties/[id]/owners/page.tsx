import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { propertyHome } from "@/lib/routes";
import { AdminShell } from "@/components/admin/AdminShell";
import ManagerAssigner from "../managers/manager-assigner";
import { makePerson, userSel } from "../managers/people-shared";

export default async function PropertyOwnersPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true, name: true, ownerId: true,
      owner: { select: userSel },
      coOwners: { orderBy: { createdAt: "asc" }, select: { user: { select: userSel } } },
    },
  });
  if (!property || !canEditProperty(me, property)) notFound();

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertyHome(me.role, property.id)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Owner details of this property</p>
        </div>
      </div>
      <ManagerAssigner
        mode="owners"
        propertyId={property.id}
        people={[makePerson(me, "owner", property.owner), ...property.coOwners.map((c) => makePerson(me, "coOwner", c.user))]}
        canAdd={me.role === "SUPER_ADMIN" || me.role === "PROPERTY_ADMIN"}
      />
    </AdminShell>
  );
}
