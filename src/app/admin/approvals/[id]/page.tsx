import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { getHistory } from "@/lib/audit";
import { STATUS_LABEL as OWNER_STATUS } from "@/lib/owner-status";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, Chip, PageTop, Row, toneFor } from "../../ui";
import ReviewPanel from "../../review-panel";
import HistoryList from "../../history-list";

const LABEL = { PENDING: "Awaiting approval", NEEDS_MORE_INFO: "More information needed", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const TYPE = { PG: "PG", APARTMENT: "Apartment", FLAT: "Flat" } as const;
const fmt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const link = "text-primary underline";

export default async function PropertyReview({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireSuperAdmin();
  const { id } = await params;
  const p = await prisma.property.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true, ownerProfile: { select: { id: true, verificationStatus: true } } } },
      rooms: true, images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }, documents: true, authorityProof: true,
      coOwners: { include: { user: { select: { name: true, email: true, ownerProfile: { select: { id: true, verificationStatus: true } } } }, documents: { orderBy: { uploadedAt: "desc" } } } },
    },
  });
  if (!p) notFound();
  const history = await getHistory("PROPERTY", p.id);
  const reviewer = p.reviewedById ? await prisma.user.findUnique({ where: { id: p.reviewedById }, select: { name: true } }) : null;
  const ownerProfile = p.owner.ownerProfile;
  const name = (me as unknown as { name?: string }).name ?? "Admin";

  return (
    <AdminShell role={me.role} name={name}>
      <PageTop
        href="/admin/approvals"
        title={p.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={toneFor(p.status)}>{LABEL[p.status]}</Chip>
            <span>{TYPE[p.type]}{p.sharing ? " · sharing" : ""}</span>
            {p.reviewedAt && <span className="text-sm">Last decision: {fmt(p.reviewedAt)}{reviewer ? ` by ${reviewer.name}` : ""}{p.reviewNote ? ` — “${p.reviewNote}”` : ""}</span>}
          </span>
        }
      />

      <div className="space-y-6">
        <Card title="Details">
          <Row label="Address">{p.address}, {p.city}</Row>
          {p.description && <p>{p.description}</p>}
          <p>
            {[p.bedrooms != null && `${p.bedrooms} bedrooms`, p.bathrooms != null && `${p.bathrooms} bathrooms`, p.areaSqft != null && `${p.areaSqft} sq ft`, p.floors != null && `${p.floors} floors`].filter(Boolean).join(" · ") || "No size details"}
          </p>
          <Row label="Rooms">{p.rooms.map((r) => `${r.label} (${r.capacity}, ₹${r.rent})`).join("; ") || "—"}</Row>
          {p.images.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {p.images.map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i.id} src={`/api/uploads/${i.path}`} alt="" className="h-24 w-32 rounded-xl object-cover" />
              ))}
            </div>
          )}
        </Card>

        <Card title="Owner and authority documents">
          <Row label="Owner">
            {p.owner.name} ({p.owner.email})
            {ownerProfile && <> · account: {OWNER_STATUS[ownerProfile.verificationStatus]} (<a className={link} href={`/admin/kyc/${ownerProfile.id}`}>KYC</a>)</>}
          </Row>
          <p className="text-muted-foreground">Account verification doesn&apos;t approve this property. Check the proof below.</p>
          <Row label="Ownership/authority proof">
            {p.authorityProof ? <a className={link} href={`/api/property-authority/${p.id}`} target="_blank" rel="noreferrer">{p.authorityProof.originalName}</a> : "none uploaded"}
          </Row>
          <Row label="Other documents">
            {p.documents.length === 0 ? "none" : p.documents.map((d) => (
              <span key={d.id}><a className={link} href={`/api/uploads/${d.path}`} target="_blank" rel="noreferrer">{d.name}</a>{" "}</span>
            ))}
          </Row>
        </Card>

        {p.coOwners.length > 0 && (
          <Card title="Co-owner and proof documents">
            {p.coOwners.map((assignment) => (
              <div key={assignment.id} className="border-b border-border py-3 last:border-0">
                <Row label="Co-owner">
                  {assignment.user.name} ({assignment.user.email})
                  {assignment.user.ownerProfile && <> · account: {OWNER_STATUS[assignment.user.ownerProfile.verificationStatus]} (<a className={link} href={`/admin/kyc/${assignment.user.ownerProfile.id}`}>KYC</a>)</>}
                </Row>
                <Row label="Submitted proof">
                  {assignment.documents.length === 0 ? "No co-owner proof submitted yet" : assignment.documents.map((doc) => (
                    <span key={doc.id} className="mr-3 inline-block"><a className={link} href={`/api/co-owner-documents/${doc.id}`} target="_blank" rel="noreferrer">{doc.name} ({doc.originalName})</a></span>
                  ))}
                </Row>
              </div>
            ))}
          </Card>
        )}

        <Card title="Decision">
          <ReviewPanel
            url={`/api/admin/properties/${p.id}/review`}
            options={[
              { action: "APPROVE", label: "Approve", needsNote: false },
              { action: "REJECT", label: "Reject", needsNote: true },
              { action: "REQUEST_INFO", label: "Request more information", needsNote: true },
            ]}
          />
        </Card>

        <Card title="Approval history"><HistoryList events={history} /></Card>
      </div>
    </AdminShell>
  );
}