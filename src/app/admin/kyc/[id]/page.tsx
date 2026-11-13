import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { getHistory } from "@/lib/audit";
import { SMS_VERIFICATION_ENABLED, STATUS_LABEL } from "@/lib/owner-status";
import { ID_TYPE_LABEL, RELATIONSHIP_LABEL } from "@/lib/owner-validation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, Chip, PageTop, Row, toneFor } from "../../ui";
import ReviewPanel from "../../review-panel";
import HistoryList from "../../history-list";

const fmt = (d: Date | null) => (d ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const DOC_LABEL = { ID_DOCUMENT: "ID document", ADDRESS_PROOF: "Address proof", COMPANY_REGISTRATION: "Company registration", AUTHORITY_PROOF: "Authority proof" } as const;
const link = "text-primary underline";

export default async function KycReview({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireSuperAdmin();
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
  const name = (me as unknown as { name?: string }).name ?? "Admin";

  return (
    <AdminShell role={me.role} name={name}>
      <PageTop
        href="/admin/kyc"
        title={p.legalName}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={toneFor(p.verificationStatus)}>{STATUS_LABEL[p.verificationStatus]}</Chip>
            <span>{company ? "Company" : "Individual"}</span>
          </span>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Owner">
            <Row label="Email">{p.user.email} ({p.user.emailVerifiedAt ? "verified" : "not verified"})</Row>
            <Row label="Mobile">{p.phone ?? "—"}{SMS_VERIFICATION_ENABLED ? ` (${p.phoneVerifiedAt ? "verified" : "not verified"})` : " (SMS verification not enabled)"}</Row>
            <Row label="Submitted">{fmt(p.onboardingCompletedAt)}</Row>
          </Card>

          <Card title="Identity">
            <Row label={p.idType ? ID_TYPE_LABEL[p.idType] : "ID"}>{p.idNumberMasked ?? "—"}</Row>
            <Row label="Address">{[p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode].filter(Boolean).join(", ") || "—"}</Row>
            {company && (
              <>
                <Row label="Registration number">{p.companyRegistrationNumber ?? "—"}</Row>
                <Row label="GSTIN">{p.gstin ?? "—"}</Row>
                <Row label="Signatory">{p.signatoryName ?? "—"}{p.signatoryDesignation ? `, ${p.signatoryDesignation}` : ""}</Row>
              </>
            )}
            <Row label="Documents">
              {p.documents.length === 0
                ? "none uploaded"
                : p.documents.map((d) => (
                    <span key={d.id}>
                      <a className={link} href={`/api/owner-documents/${d.id}`} target="_blank" rel="noreferrer">{DOC_LABEL[d.type]} ({d.originalName})</a>{" "}
                    </span>
                  ))}
            </Row>
            {!p.documents.some((d) => d.type === "ADDRESS_PROOF") && (
              <p className="text-destructive">No address proof on file. Request it with “Request more information”.</p>
            )}
            <p className="text-muted-foreground">Opening a document is recorded in the access log below.</p>
          </Card>
        </div>

        <Card title="Property relationship and declarations">
          {!p.onboardingCompletedAt && <p className="text-destructive">This person hasn&apos;t completed their own declarations yet.</p>}
          <Row label="Relationship">{p.propertyRelationship ? RELATIONSHIP_LABEL[p.propertyRelationship] : "—"}</Row>
          {p.authorityDetails && <Row label="Authority details">{p.authorityDetails}</Row>}
          <ul className="space-y-1">
            <li>Terms: {fmt(p.termsAcceptedAt)} {p.termsVersion && `(v${p.termsVersion})`}</li>
            <li>Privacy: {fmt(p.privacyAcceptedAt)} {p.privacyVersion && `(v${p.privacyVersion})`}</li>
            <li>KYC consent: {fmt(p.kycConsentAt)} {p.kycConsentVersion && `(v${p.kycConsentVersion})`}</li>
            <li>Authority declaration: {fmt(p.authorityDeclaredAt)} {p.authorityDeclarationVersion && `(v${p.authorityDeclarationVersion})`}</li>
          </ul>
        </Card>

        <Card title="Decision">
          <p className="text-muted-foreground">This only affects the owner&apos;s account. Properties are approved separately.</p>
          <ReviewPanel
            url={`/api/admin/kyc/${p.id}/review`}
            options={[
              { action: "APPROVE", label: "Approve", needsNote: false },
              { action: "REJECT", label: "Reject", needsNote: true },
              { action: "REQUEST_INFO", label: "Request more information", needsNote: true },
              { action: "RESTRICT", label: "Restrict", needsNote: true },
            ]}
          />
        </Card>

        <Card title="Review history"><HistoryList events={history} /></Card>

        <Card title="Document access log">
          {accessLogs.length === 0 ? (
            <p className="text-muted-foreground">No access yet.</p>
          ) : (
            <ul className="space-y-1">
              {accessLogs.map((l) => (
                <li key={l.id}>{fmt(l.createdAt)} · {actorName.get(l.actorId) ?? "Unknown"} ({l.actorRole.replace("_", " ").toLowerCase()}) {l.action.toLowerCase()}ed {DOC_LABEL[p.documents.find((d) => d.id === l.documentId)?.type ?? "ID_DOCUMENT"].toLowerCase()}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}