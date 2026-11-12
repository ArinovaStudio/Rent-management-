import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
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

  return (
    <main>
      <p><a href="/dashboard/properties">← Properties</a></p>
      <h1>{property.name} — Managers</h1>
      <ManagerAssigner propertyId={property.id} assigned={property.managers.map((m) => m.manager)} candidates={candidates} />
      <p className="muted">Need a new manager account? <a href="/dashboard/users">Create one here</a>.</p>
    </main>
  );
}