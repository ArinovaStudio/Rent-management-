
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import AllocationForm from "./allocation-form";
import AllocationActions from "./allocation-actions";

export default async function PropertyRoomsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  if (!property || !canEditProperty(me, property)) {
    notFound();
  }

  const capacity = property.rooms.reduce(
    (sum, room) => sum + room.capacity,
    0
  );

  const occupied = property.rooms.reduce(
    (sum, room) => sum + room.allocations.length,
    0
  );

  const available = Math.max(0, capacity - occupied);

  return (
    <main className="wide">
      <p>
        <a href="/dashboard/properties">← Properties</a>
      </p>

      <h1>{property.name} — Room status</h1>

      <div className="card">
        <strong>
          Overall occupancy: {occupied}/{capacity}
        </strong>

        <span className="muted">
          {available > 0
            ? `${available} bed${available === 1 ? "" : "s"} available`
            : "No rooms available"}
        </span>
      </div>

      <h2>Rooms</h2>

      {property.rooms.map((room) => {
        const count = room.allocations.length;
        const full = count >= room.capacity;

        return (
          <section className="card" key={room.id}>
            <div className="row" style={{ alignItems: "center" }}>
              <div>
                <strong>{room.label}</strong>

                <div className="muted" style={{ margin: "4px 0" }}>
                  {room.ac ? "AC · " : ""}
                  ₹{room.rent.toLocaleString("en-IN")}
                  {" / person / month"}
                </div>
              </div>

              <div>
                <strong>
                  {count}/{room.capacity}
                </strong>

                <div className="muted" style={{ margin: "4px 0" }}>
                  {full
                    ? "Full · No vacancy"
                    : count === 0
                    ? "Vacant"
                    : `${room.capacity - count} bed(s) available`}
                </div>
              </div>
            </div>

            {room.allocations.length === 0 ? (
              <p className="muted">
                No residents allocated.
              </p>
            ) : (
              <div>
                {room.allocations.map((resident) => (
                  <div key={resident.id} className="resident-row">
                    <div>
                      <strong>{resident.fullName}</strong>

                      <div className="muted" style={{ margin: "3px 0" }}>
                        {resident.phone}
                        {resident.email ? ` · ${resident.email}` : ""}
                      </div>

                      <div className="muted" style={{ margin: "3px 0" }}>
                        Move-in: {resident.moveInDate.toLocaleDateString("en-IN")}
                        {" · "}
                        {resident.documents.length} document(s)
                      </div>

                      <a href={`/resident/${resident.accessToken}`} target="_blank" rel="noreferrer">
                        Open resident link
                      </a>
                    </div>

                    <AllocationActions
                      allocationId={resident.id}
                      residentUrl={`/resident/${resident.accessToken}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <h2>Allocate a person</h2>

      {available === 0 ? (
        <p className="notice">
          No rooms available. All beds in this property are occupied.
        </p>
      ) : (
        <AllocationForm
          propertyId={property.id}
          rooms={property.rooms.map((r) => ({
            id: r.id,
            label: r.label,
            capacity: r.capacity,
            rent: r.rent,
            occupied: r.allocations.length,
          }))}
        />
      )}
    </main>
  );
}
