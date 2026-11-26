import { headcount } from "@/lib/occupancy";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import PropertyForm from "../../property-form";
import { AdminShell } from "@/components/admin/AdminShell";
import { listingForClient, listedByInfo } from "@/lib/property-fields";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const { id } = await params;
  // Nested selects only pull fields the form needs; active allocations are id-only for headcount.
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, label: true, capacity: true, ac: true, rent: true, floor: true, roomType: true,
          sizeSqm: true, bathroomAttached: true, bathroomAreaSqm: true, bedrooms: true, bathrooms: true,
          furnishing: true, features: true, images: true,
          allocations: { where: { status: "ACTIVE" }, select: { id: true } },
        },
      },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, path: true } },
      categoryMedia: {
        orderBy: [{ capacity: "asc" }, { mediaType: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, capacity: true, mediaType: true, path: true, originalName: true },
      },
      documents: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, path: true } },
      authorityProof: { select: { originalName: true } },
      owner: {
        select: {
          name: true, email: true, role: true,
          ownerProfile: { select: { legalName: true, phone: true, accountType: true } },
        },
      },
      coOwners: {
        orderBy: { createdAt: "asc" },
        select: {
          user: { select: { id: true, name: true, email: true } },
          documents: { select: { id: true } },
        },
      },
      managers: {
        orderBy: { createdAt: "asc" },
        select: { manager: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!property || !canEditProperty(me, property)) notFound();

  const isOwnerAdmin = me.role === "PROPERTY_ADMIN";
  const initial = {
    id: property.id,
    name: property.name,
    description: property.description,
    type: property.type,
    address: property.address,
    city: property.city,
    latitude: property.latitude,
    longitude: property.longitude,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    areaSqft: property.areaSqft,
    floors: property.floors,
    roomsPerFloor: property.roomsPerFloor,
    totalRooms: property.totalRooms,
    pgConfig: property.pgConfig,
    sharing: property.sharing,
    rooms: property.rooms.map((r) => ({
      id: r.id, label: r.label, capacity: r.capacity, ac: r.ac, rent: r.rent, occupied: headcount(r.allocations),
      floor: r.floor, roomType: r.roomType, sizeSqm: r.sizeSqm, bathroomAttached: r.bathroomAttached,
      bathroomAreaSqm: r.bathroomAreaSqm, bedrooms: r.bedrooms, bathrooms: r.bathrooms, furnishing: r.furnishing,
      features: Array.isArray(r.features) ? (r.features as string[]) : [], images: (r.images as string[]) ?? [],
    })),
    images: property.images.map((i) => ({ id: i.id, path: i.path })),
    categoryMedia: property.categoryMedia.map((m) => ({ id: m.id, capacity: m.capacity, mediaType: m.mediaType, path: m.path, originalName: m.originalName })),
    documents: property.documents.map((d) => ({ id: d.id, name: d.name, path: d.path })),
    ...(isOwnerAdmin ? { authorityProof: property.authorityProof ? { name: property.authorityProof.originalName } : null } : {}),
    listing: listingForClient(property, me.role),
  };

  const note = "mb-6 rounded-2xl px-5 py-3 text-sm";

  return (
    <AdminShell role={me.role} name={me.name ?? "Account"}>
      {property.status === "REJECTED" && property.reviewNote && (
        <p className={`${note} bg-destructive/10 text-destructive`}>Rejected: {property.reviewNote}</p>
      )}
      {property.status === "NEEDS_MORE_INFO" && property.reviewNote && (
        <p className={`${note} bg-destructive/10 text-destructive`}>More information needed: {property.reviewNote}</p>
      )}
      {isOwnerAdmin && (
        <p className={`${note} bg-background text-muted-foreground`}>After you save, this property goes back to the Super Admin for review.</p>
      )}
      <PropertyForm
        initial={initial}
        role={me.role}
        listedBy={listedByInfo(property.owner)}
        propertyId={property.id}
        coOwners={property.coOwners.map((c) => ({ userId: c.user.id, name: c.user.name, email: c.user.email, documents: c.documents.length }))}
        managers={property.managers.map((m) => ({ id: m.manager.id, name: m.manager.name, email: m.manager.email }))}
      />
    </AdminShell>
  );
}
