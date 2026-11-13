import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canOperateProperty } from "@/lib/property-access";
import { propertiesBase } from "@/lib/routes";
import { AdminShell, Panel } from "@/components/admin/AdminShell";
import AllocationForm from "./allocation-form";
import AllocationActions from "./allocation-actions";

export default async function PropertyRoomsPage({ params }: { params: Promise<{ id: string }> }) {
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
            include: { documents: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!property || !(await canOperateProperty(me, property))) notFound();

  const capacity = property.rooms.reduce((sum, room) => sum + room.capacity, 0);
  const occupied = property.rooms.reduce((sum, room) => sum + room.allocations.length, 0);
  const available = Math.max(0, capacity - occupied);
  const name = (me as unknown as { name?: string }).name ?? "Account";

  return (
    <AdminShell role={me.role} name={name}>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href={propertiesBase(me.role)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-background hover:bg-cream"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-4xl font-medium tracking-tight">{property.name}</h1>
          <p className="text-muted-foreground">Room status & tenant allocation</p>
        </div>
      </div>

      <div className="space-y-6">
        <Panel className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-lg font-medium">Overall occupancy: {occupied}/{capacity}</p>
          <span className="rounded-full bg-cream px-3 py-1 text-sm">
            {available > 0 ? `${available} bed${available === 1 ? "" : "s"} available` : "No rooms available"}
          </span>
        </Panel>

        {property.rooms.map((room) => {
          const count = room.allocations.length;
          const full = count >= room.capacity;
          return (
            <Panel key={room.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{room.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    {room.ac ? "AC · " : ""}₹{room.rent.toLocaleString("en-IN")} / person / month
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium">{count}/{room.capacity}</p>
                  <span className={`rounded-full px-3 py-1 text-xs ${full ? "bg-destructive/10 text-destructive" : count === 0 ? "bg-primary/10 text-primary" : "bg-cream"}`}>
                    {full ? "Full · No vacancy" : count === 0 ? "Vacant" : `${room.capacity - count} bed(s) available`}
                  </span>
                </div>
              </div>

              {room.allocations.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No residents allocated.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {room.allocations.map((resident) => (
                    <div key={resident.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-cream/60 p-4">
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{resident.fullName}</p>
                        <p className="text-muted-foreground">{resident.phone}{resident.email ? ` · ${resident.email}` : ""}</p>
                        <p className="text-muted-foreground">
                          Move-in: {resident.moveInDate.toLocaleDateString("en-IN")} · {resident.documents.length} document(s)
                        </p>
                        <a className="text-primary underline" href={`/resident/${resident.accessToken}`} target="_blank" rel="noreferrer">Open resident link</a>
                      </div>
                      <AllocationActions allocationId={resident.id} residentUrl={`/resident/${resident.accessToken}`} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}

        {available === 0 ? (
          <p className="rounded-2xl bg-background px-5 py-3 text-sm text-muted-foreground">
            No rooms available. All beds in this property are occupied.
          </p>
        ) : (
          <AllocationForm
            propertyId={property.id}
            rooms={property.rooms.map((r) => ({ id: r.id, label: r.label, capacity: r.capacity, rent: r.rent, occupied: r.allocations.length }))}
          />
        )}
      </div>
    </AdminShell>
  );
}