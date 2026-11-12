import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { getHistory } from "@/lib/audit";
import { SMS_VERIFICATION_ENABLED, STATUS_LABEL } from "@/lib/owner-status";
import { ID_TYPE_LABEL, RELATIONSHIP_LABEL } from "@/lib/owner-validation";
import ReviewPanel from "../../review-panel";
import HistoryList from "../../history-list";

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const DOC_LABEL = { ID_DOCUMENT: "ID document", ADDRESS_PROOF: "Address proof", COMPANY_REGISTRATION: "Company registration", AUTHORITY_PROOF: "Authority proof" } as const;

export default async function KycReview({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const p = await prisma.ownerProfile.findUnique({
    where: { id },
    include: { user: { select: { email: true, emailVerifiedAt: true } }, documents: true },
  });
  if (!p) notFound();

  const [history, accessLogs] = await Promise.all([
    getHistory("OWNER_KYC", p.id),
    prisma.documentAccessLog.findMany({
      where: { documentId: { in: p.documents.map((d) => d.id) } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const actors = await prisma.user.findMany({ where: { id: { in: accessLogs.map((l) => l.actorId) } }, select: { id: true, name: true } });
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const company = p.accountType === "COMPANY";

  return (
    <main className="wide">
      <p className="muted"><a href="/dashboard/admin/kyc">Back to KYC queue</a></p>
      <h1>{p.legalName}</h1>
      <p><strong>{STATUS_LABEL[p.verificationStatus]}</strong> · {company ? "Company" : "Individual"}</p>

      <fieldset>
        <legend>Owner</legend>
        <p>Email: {p.user.email} ({p.user.emailVerifiedAt ? "verified" : "not verified"})</p>
        <p>Mobile: {p.phone ?? "—"}{SMS_VERIFICATION_ENABLED ? ` (${p.phoneVerifiedAt ? "verified" : "not verified"})` : " (SMS verification not enabled)"}</p>
        <p>Submitted: {fmt(p.onboardingCompletedAt)}</p>
      </fieldset>

      <fieldset>
        <legend>Identity</legend>
        <p>{p.idType ? ID_TYPE_LABEL[p.idType] : "ID"}: {p.idNumberMasked ?? "—"}</p>
        <p>Address: {[p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode].filter(Boolean).join(", ") || "—"}</p>
        {company && (
          <>
            <p>Registration number: {p.companyRegistrationNumber ?? "—"}</p>
            <p>GSTIN: {p.gstin ?? "—"}</p>
            <p>Signatory: {p.signatoryName ?? "—"}{p.signatoryDesignation ? `, ${p.signatoryDesignation}` : ""}</p>
          </>
        )}
        <p>
          Documents:{" "}
          {p.documents.length === 0
            ? "none uploaded"
            : p.documents.map((d) => (
                <span key={d.id}>
                  <a href={`/api/owner-documents/${d.id}`} target="_blank" rel="noreferrer">{DOC_LABEL[d.type]} ({d.originalName})</a>{" "}
                </span>
              ))}
        </p>
        {!p.documents.some((d) => d.type === "ADDRESS_PROOF") && <p className="error">No address proof on file. Request it with “Request more information”.</p>}
        <p className="muted">Opening a document is recorded in the access log below.</p>
      </fieldset>

      <fieldset>
        <legend>Property relationship and declarations</legend>
        {!p.onboardingCompletedAt && <p className="error">This person hasn&apos;t completed their own declarations yet.</p>}
        <p>Relationship: {p.propertyRelationship ? RELATIONSHIP_LABEL[p.propertyRelationship] : "—"}</p>
        {p.authorityDetails && <p>Authority details: {p.authorityDetails}</p>}
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>Terms: {fmt(p.termsAcceptedAt)} {p.termsVersion && `(v${p.termsVersion})`}</li>
          <li>Privacy: {fmt(p.privacyAcceptedAt)} {p.privacyVersion && `(v${p.privacyVersion})`}</li>
          <li>KYC consent: {fmt(p.kycConsentAt)} {p.kycConsentVersion && `(v${p.kycConsentVersion})`}</li>
          <li>Authority declaration: {fmt(p.authorityDeclaredAt)} {p.authorityDeclarationVersion && `(v${p.authorityDeclarationVersion})`}</li>
        </ul>
      </fieldset>

      <fieldset>
        <legend>Decision</legend>
        <p className="muted">This only affects the owner's account. Properties are approved separately.</p>
        <ReviewPanel
          url={`/api/admin/kyc/${p.id}/review`}
          options={[
            { action: "APPROVE", label: "Approve", needsNote: false },
            { action: "REJECT", label: "Reject", needsNote: true },
            { action: "REQUEST_INFO", label: "Request more information", needsNote: true },
            { action: "RESTRICT", label: "Restrict", needsNote: true },
          ]}
        />
      </fieldset>

      <fieldset>
        <legend>Review history</legend>
        <HistoryList events={history} />
      </fieldset>

      <fieldset>
        <legend>Document access log</legend>
        {accessLogs.length === 0 ? (
          <p className="muted">No access yet.</p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {accessLogs.map((l) => (
              <li key={l.id}>{fmt(l.createdAt)} · {actorName.get(l.actorId) ?? "Unknown"} ({l.actorRole.replace("_", " ").toLowerCase()}) {l.action.toLowerCase()}ed {DOC_LABEL[p.documents.find((d) => d.id === l.documentId)?.type ?? "ID_DOCUMENT"].toLowerCase()}</li>
            ))}
          </ul>
        )}
      </fieldset>
    </main>
  );
}
