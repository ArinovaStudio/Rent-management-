import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { propertiesBase, propertyHome } from "@/lib/routes";
import { AdminShell } from "@/components/admin/AdminShell";
import ManagerAssigner from "./manager-assigner";
import type { Person, PersonKind } from "./person-dialogs";

const profileSel = { phone: true, age: true, photoPath: true, verificationStatus: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, idType: true, idNumberMasked: true, documents: { select: { id: true, originalName: true, type: true }, orderBy: { uploadedAt: "asc" } } } as const;

export default async function PropertyManagersPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true, name: true, ownerId: true,
      owner: { select: { id: true, name: true, email: true, createdById: true, ownerProfile: { select: profileSel } } },
      managers: {
        orderBy: { createdAt: "asc" },
        select: { managerId: true, manager: { select: { id: true, name: true, email: true, createdById: true, ownerProfile: { select: profileSel } } } },
      },
      coOwners: {
        orderBy: { createdAt: "asc" },
        select: { user: { select: { id: true, name: true, email: true, createdById: true, ownerProfile: { select: profileSel } } } },
      },
    },
  });
  if (!property || !canEditProperty(me, property)) notFound();

  type Profile = { phone: string | null; age: number | null; photoPath: string | null; verificationStatus: string; addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; idType: string | null; idNumberMasked: string | null; documents: { id: string; originalName: string; type: string }[] } | null;
  // Super Admin edits anyone; a Property Admin only the people they created. Documents are listed only for people the viewer may open.
  const person = (kind: PersonKind, u: { id: string; name: string; email: string; createdById: string | null; ownerProfile: Profile }): Person => {
    const editable = me.role === "SUPER_ADMIN" || (me.role === "PROPERTY_ADMIN" && kind !== "owner" && u.createdById === me.id);
    const canOpenDocs = editable || u.id === me.id || me.role === "SUPER_ADMIN";
    return {
      id: u.id, kind, name: u.name, email: u.email, editable,
      phone: u.ownerProfile?.phone ?? null, age: u.ownerProfile?.age ?? null, photoPath: u.ownerProfile?.photoPath ?? null,
      verified: u.ownerProfile?.verificationStatus === "VERIFIED",
      addressLine1: u.ownerProfile?.addressLine1 ?? null, addressLine2: u.ownerProfile?.addressLine2 ?? null,
      city: u.ownerProfile?.city ?? null, state: u.ownerProfile?.state ?? null, postalCode: u.ownerProfile?.postalCode ?? null,
      idType: u.ownerProfile?.idType ?? null, idNumberMasked: u.ownerProfile?.idNumberMasked ?? null,
      documents: canOpenDocs ? (u.ownerProfile?.documents ?? []).map((d) => ({ id: d.id, name: d.originalName, type: d.type })) : [],
    };
  };

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertyHome(me.role, property.id)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Owners and managers of this property</p>
        </div>
      </div>
      <ManagerAssigner
        propertyId={property.id}
        owners={[person("owner", property.owner), ...property.coOwners.map((c) => person("coOwner", c.user))]}
        managers={property.managers.map((m) => person("manager", m.manager))}
        canAdd={me.role === "SUPER_ADMIN" || me.role === "PROPERTY_ADMIN"}
      />
    </AdminShell>
  );
}