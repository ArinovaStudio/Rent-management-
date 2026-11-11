import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { getHistory } from "@/lib/audit";
import { STATUS_LABEL as OWNER_STATUS } from "@/lib/owner-status";
import ReviewPanel from "../../review-panel";
import HistoryList from "../../history-list";

const LABEL = { PENDING: "Awaiting approval", NEEDS_MORE_INFO: "More information needed", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const TYPE = { PG: "PG", APARTMENT: "Apartment", FLAT: "Flat" } as const;
const fmt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function PropertyReview({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const p = await prisma.property.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true, ownerProfile: { select: { id: true, verificationStatus: true } } } },
      rooms: true, images: true, documents: true, authorityProof: true,
    },
  });
  if (!p) notFound();
  const history = await getHistory("PROPERTY", p.id);
  const reviewer = p.reviewedById ? await prisma.user.findUnique({ where: { id: p.reviewedById }, select: { name: true } }) : null;
  const ownerProfile = p.owner.ownerProfile;

  return (
    <main className="wide">
      <p className="muted"><a href="/dashboard/admin/properties">Back to property approvals</a></p>
      <h1>{p.name}</h1>
      <p><strong>{LABEL[p.status]}</strong> · {TYPE[p.type]}{p.sharing ? " · sharing" : ""}</p>
      {p.reviewedAt && <p className="muted">Last decision: {fmt(p.reviewedAt)}{reviewer ? ` by ${reviewer.name}` : ""}{p.reviewNote ? ` — “${p.reviewNote}”` : ""}</p>}

      <fieldset>
        <legend>Details</legend>
        <p>Address: {p.address}, {p.city}</p>
        {p.description && <p>{p.description}</p>}
        <p>
          {[p.bedrooms != null && `${p.bedrooms} bedrooms`, p.bathrooms != null && `${p.bathrooms} bathrooms`, p.areaSqft != null && `${p.areaSqft} sq ft`, p.floors != null && `${p.floors} floors`].filter(Boolean).join(" · ") || "No size details"}
        </p>
        <p>Rooms: {p.rooms.map((r) => `${r.label} (${r.capacity}, ₹${r.rent})`).join("; ") || "—"}</p>
        {p.images.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.images.map((i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i.id} src={`/api/uploads/${i.path}`} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 4 }} />
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Owner and authority documents</legend>
        <p>
          Owner: {p.owner.name} ({p.owner.email})
          {ownerProfile && <> · account: {OWNER_STATUS[ownerProfile.verificationStatus]} (<a href={`/dashboard/admin/kyc/${ownerProfile.id}`}>KYC</a>)</>}
        </p>
        <p className="muted">Account verification doesn't approve this property. Check the proof below.</p>
        <p>
          Ownership/authority proof:{" "}
          {p.authorityProof ? <a href={`/api/property-authority/${p.id}`} target="_blank" rel="noreferrer">{p.authorityProof.originalName}</a> : "none uploaded"}
        </p>
        <p>
          Other documents:{" "}
          {p.documents.length === 0 ? "none" : p.documents.map((d) => (
            <span key={d.id}><a href={`/api/uploads/${d.path}`} target="_blank" rel="noreferrer">{d.name}</a>{" "}</span>
          ))}
        </p>
      </fieldset>

      <fieldset>
        <legend>Decision</legend>
        <ReviewPanel
          url={`/api/admin/properties/${p.id}/review`}
          options={[
            { action: "APPROVE", label: "Approve", needsNote: false },
            { action: "REJECT", label: "Reject", needsNote: true },
            { action: "REQUEST_INFO", label: "Request more information", needsNote: true },
          ]}
        />
      </fieldset>

      <fieldset>
        <legend>Approval history</legend>
        <HistoryList events={history} />
      </fieldset>
    </main>
  );
}
