import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin";
import { SMS_VERIFICATION_ENABLED, STATUS_LABEL, type VerificationStatusValue } from "@/lib/owner-status";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, Tabs, toneFor } from "../ui";

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
  const me = await requireSuperAdmin();
  const { filter } = await searchParams;
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const profiles = await prisma.ownerProfile.findMany({
    where: active.status ? { verificationStatus: active.status } : {},
    include: { user: { select: { email: true, emailVerifiedAt: true } } },
    orderBy: [{ onboardingCompletedAt: "desc" }, { createdAt: "desc" }],
  });
  const name = (me as unknown as { name?: string }).name ?? "Admin";

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader title="KYC review" sub="Verify the identity of owners, admins and managers." />
      <Tabs base="/admin/kyc" active={active.key} items={FILTERS.map((f) => ({ key: f.key, label: f.label }))} />
      <Panel className="mt-6 overflow-x-auto">
        {profiles.length === 0 ? (
          <p className="text-muted-foreground">Nothing here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                {["Owner", "Account", "Submitted", "Contact", "Verification", ""].map((h) => <th key={h} className="py-3 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-cream">
                  <td className="py-3 pr-4 font-medium">{p.legalName}</td>
                  <td className="py-3 pr-4">{p.accountType === "COMPANY" ? "Company" : "Individual"}</td>
                  <td className="py-3 pr-4">{p.onboardingCompletedAt ? p.onboardingCompletedAt.toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not submitted"}</td>
                  <td className="py-3 pr-4">
                    Email: {p.user.emailVerifiedAt ? "verified" : "no"}
                    {SMS_VERIFICATION_ENABLED && <> · Mobile: {p.phoneVerifiedAt ? "verified" : "no"}</>}
                  </td>
                  <td className="py-3 pr-4"><Chip tone={toneFor(p.verificationStatus)}>{STATUS_LABEL[p.verificationStatus]}</Chip></td>
                  <td className="py-3"><Link href={`/admin/kyc/${p.id}`} className="rounded-full bg-primary px-4 py-2 text-primary-foreground hover:bg-ink">Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AdminShell>
  );
}