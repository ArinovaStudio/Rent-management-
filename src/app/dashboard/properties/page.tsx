import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canManageProperties } from "@/lib/permissions";
import { getVerificationStatus } from "@/lib/owner-status";

const TYPE_LABEL = { PG: "PG", APARTMENT: "Apartment", FLAT: "Flat" } as const;
const STATUS_LABEL = { PENDING: "Pending review", APPROVED: "Live", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!canManageProperties(me.role, await getVerificationStatus(me.id))) redirect("/dashboard");

  const { saved } = await searchParams;
  const properties = await prisma.property.findMany({
    where: me.role === "SUPER_ADMIN" ? {} : { ownerId: me.id },
    include: {
      rooms: {
        include: {
          allocations: {
            where: { status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
      owner: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="wide">
      <h1>Properties</h1>
      {saved === "pending" && <p className="notice">Saved. It will go live once the Super Admin approves it.</p>}
      {saved === "live" && <p className="notice">Saved.</p>}
      <p><a className="button" href="/dashboard/properties/new">Add property</a></p>

      {properties.length === 0 ? (
        <p className="muted">No properties yet.</p>
      ) : (
        properties.map((p) => {
          const cap = p.rooms.reduce((s, r) => s + r.capacity, 0);
          const occ = p.rooms.reduce((s, r) => s + r.allocations.length, 0);
          return (
            <div key={p.id} className="card">
              <strong>{p.name}</strong>{" "}
              <span className={`badge ${p.status.toLowerCase()}`}>{STATUS_LABEL[p.status]}</span>
              <div className="muted" style={{ margin: "4px 0" }}>
                {TYPE_LABEL[p.type]}{p.sharing && p.type !== "PG" ? " (sharing)" : ""} · {p.city}
                {me.role === "SUPER_ADMIN" && ` · Owner: ${p.owner.name}`}
              </div>
              <div>Occupancy {occ}/{cap}{occ >= cap ? " · no rooms available" : ""}</div>
              {p.status === "REJECTED" && p.reviewNote && <p className="error">Rejected: {p.reviewNote}</p>}
              {p.status === "NEEDS_MORE_INFO" && p.reviewNote && <p className="error">More information needed: {p.reviewNote}</p>}
              <p style={{ marginBottom: 0 }}><a href={`/dashboard/properties/${p.id}/edit`}>Edit</a></p>
              <a href={`/dashboard/properties/${p.id}/rooms`}>Room status & allocations</a>
            </div>
          );
        })
      )}
      <p className="muted"><a href="/dashboard">Back to dashboard</a></p>
    </main>
  );
}
