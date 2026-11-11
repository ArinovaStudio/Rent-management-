import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";

const FILTERS = [
  { key: "pending", label: "Awaiting approval", status: "PENDING" },
  { key: "info", label: "Needs more information", status: "NEEDS_MORE_INFO" },
  { key: "approved", label: "Approved", status: "APPROVED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
] as const;
const LABEL = { PENDING: "Awaiting approval", NEEDS_MORE_INFO: "More information needed", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const TYPE = { PG: "PG", APARTMENT: "Apartment", FLAT: "Flat" } as const;

export default async function PropertyApprovals({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireSuperAdmin();
  const { filter } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const properties = await prisma.property.findMany({
    where: { status: active.status },
    include: { owner: { select: { name: true } }, authorityProof: { select: { id: true } } },
    orderBy: { updatedAt: "asc" },
  });

  return (
    <main className="wide">
      <h1>Property approvals</h1>
      <p className="muted"><a href="/dashboard">Dashboard</a> · <a href="/dashboard/admin/kyc">KYC review</a></p>
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <a key={f.key} className={`button ${f.key === active.key ? "" : "secondary"}`} href={`/dashboard/admin/properties?filter=${f.key}`}>{f.label}</a>
        ))}
      </p>
      {properties.length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Property</th><th>Type</th><th>City</th><th>Owner</th><th>Authority proof</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{TYPE[p.type]}</td>
                <td>{p.city}</td>
                <td>{p.owner.name}</td>
                <td>{p.authorityProof ? "Provided" : "None"}</td>
                <td>{LABEL[p.status]}</td>
                <td><a href={`/dashboard/admin/properties/${p.id}`}>Review</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
