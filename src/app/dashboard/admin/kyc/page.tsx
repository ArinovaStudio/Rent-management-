import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { SMS_VERIFICATION_ENABLED, STATUS_LABEL, type VerificationStatusValue } from "@/lib/owner-status";

const FILTERS: { key: string; label: string; status?: VerificationStatusValue }[] = [
  { key: "pending", label: "Pending verification", status: "KYC_PENDING" },
  { key: "info", label: "Needs more information", status: "NEEDS_MORE_INFO" },
  { key: "verified", label: "Verified", status: "VERIFIED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "restricted", label: "Restricted", status: "RESTRICTED" },
  { key: "contact", label: "Awaiting contact verification", status: "CONTACT_PENDING" },
  { key: "all", label: "All" },
];

export default async function KycQueue({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireSuperAdmin();
  const { filter } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const profiles = await prisma.ownerProfile.findMany({
    where: active.status ? { verificationStatus: active.status } : {},
    include: { user: { select: { email: true, emailVerifiedAt: true } } },
    orderBy: [{ onboardingCompletedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="wide">
      <h1>KYC review</h1>
      <p className="muted"><a href="/dashboard">Dashboard</a> · <a href="/dashboard/admin/properties">Property approvals</a></p>
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <a key={f.key} className={`button ${f.key === active.key ? "" : "secondary"}`} href={`/dashboard/admin/kyc?filter=${f.key}`}>{f.label}</a>
        ))}
      </p>
      {profiles.length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <table>
          <thead>
            <tr><th>Owner</th><th>Account</th><th>Submitted</th><th>Contact</th><th>Verification</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.legalName}</td>
                <td>{p.accountType === "COMPANY" ? "Company" : "Individual"}</td>
                <td>{p.onboardingCompletedAt ? p.onboardingCompletedAt.toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not submitted"}</td>
                <td>
                  Email: {p.user.emailVerifiedAt ? "verified" : "no"}
                  {SMS_VERIFICATION_ENABLED && <> · Mobile: {p.phoneVerifiedAt ? "verified" : "no"}</>}
                </td>
                <td>{STATUS_LABEL[p.verificationStatus]}</td>
                <td><a href={`/dashboard/admin/kyc/${p.id}`}>Review</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
