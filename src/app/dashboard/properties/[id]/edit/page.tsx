import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import PropertyForm from "../../property-form";

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { createdAt: "asc" },
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
      images: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!property || !canEditProperty(me, property)) notFound();

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
    sharing: property.sharing,
    rooms: property.rooms.map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, ac: r.ac, rent: r.rent, occupied: r.allocations.length, })),
    images: property.images.map((i) => ({ id: i.id, path: i.path })),
    documents: property.documents.map((d) => ({ id: d.id, name: d.name, path: d.path })),
  };

  return (
    <main className="wide">
      <h1>Edit property</h1>
      {property.status === "REJECTED" && property.reviewNote && (
        <p className="error">Rejected: {property.reviewNote}</p>
      )}
      {me.role === "PROPERTY_ADMIN" && (
        <p className="muted" style={{ marginTop: 0 }}>After you save, this property goes back to the Super Admin for review.</p>
      )}
      <PropertyForm initial={initial} />
      <p className="muted"><a href="/dashboard/properties">Back to properties</a></p>
    </main>
  );
}
