
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function ResidentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const resident = await prisma.allocation.findUnique({
    where: { accessToken: token },
    include: {
      room: {
        include: { property: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!resident) notFound();

  return (
    <main className="wide">
      <h1>Resident details</h1>

      <section className="card">
        <strong>{resident.fullName}</strong>

        <div>
          {resident.room.property.name} · {resident.room.label}
        </div>

        <div>
          {resident.room.property.address},{" "}
          {resident.room.property.city}
        </div>

        <div>Phone: {resident.phone}</div>

        {resident.email && (
          <div>Email: {resident.email}</div>
        )}

        <div>
          Move-in date:{" "}
          {resident.moveInDate.toLocaleDateString("en-IN")}
        </div>

        <div>
          Monthly rent: ₹
          {resident.monthlyRent.toLocaleString("en-IN")}
        </div>

        <div>
          Security deposit: ₹
          {resident.securityDeposit.toLocaleString("en-IN")}
        </div>

        <div>
          Status:{" "}
          {resident.status === "ACTIVE" ? "Active resident" : "Checked out"}
        </div>
      </section>

      <h2>Your documents</h2>

      {resident.documents.length === 0 ? (
        <p className="muted">
          No documents have been uploaded.
        </p>
      ) : (
        <ul>
          {resident.documents.map((doc) => (
            <li key={doc.id}>
              <a href={`/api/resident/${token}/documents/${doc.id}`} target="_blank" rel="noreferrer">
                {doc.name}
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="muted">
        This private link is intended only for you.
        Avoid sharing it publicly.
      </p>
    </main>
  );
}
