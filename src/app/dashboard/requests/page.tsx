import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { STATUS_HELP, STATUS_LABEL } from "@/lib/owner-status";
import { propertiesBase } from "@/lib/routes";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip, toneFor } from "@/app/admin/ui";

const PROPERTY_STATUS = { PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected", NEEDS_MORE_INFO: "More information needed" } as const;
const ATTENTION = ["NEEDS_MORE_INFO", "REJECTED"];
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const pill = "rounded-full bg-cream px-4 py-2 text-sm hover:bg-cream/70";

// Everything a Property Admin or Manager sent for review, with the answer, in one place.
export default async function RequestsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (me.role === "SUPER_ADMIN") redirect("/admin/approvals");
  const isManager = me.role === "PROPERTY_MANAGER";
  const name = (me as unknown as { name?: string }).name ?? "Account";
  const base = propertiesBase(me.role);

  const [user, properties, issues] = await Promise.all([
    isManager ? null : prisma.user.findUnique({ where: { id: me.id }, include: { ownerProfile: true } }),
    isManager ? [] : prisma.property.findMany({
      where: { ownerId: me.id },
      select: { id: true, name: true, status: true, reviewNote: true, reviewedAt: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    isManager ? prisma.issue.findMany({
      where: { reportedById: me.id },
      include: { property: { select: { name: true } }, room: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
    }) : [],
  ]);

  const profile = user?.ownerProfile;
  const profileNeedsAction = !!profile && ["NEEDS_MORE_INFO", "REJECTED", "RESTRICTED"].includes(profile.verificationStatus);
  const sortedProps = [...properties].sort((a, b) => Number(ATTENTION.includes(b.status)) - Number(ATTENTION.includes(a.status)));
  const attention = (profileNeedsAction ? 1 : 0) + properties.filter((p) => ATTENTION.includes(p.status)).length
    + issues.filter((i) => i.resolutionNote && (i.status === "OPEN" || i.status === "IN_PROGRESS")).length;

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader title="My requests" sub={isManager ? "Issues you sent and the replies you got." : "Status of what you sent for review, and any reply from the reviewer."} />

      <div className="space-y-6">
        {attention > 0 && (
          <p className="rounded-2xl bg-primary/10 px-5 py-3 text-sm text-primary">{attention} {attention === 1 ? "request needs" : "requests need"} your attention.</p>
        )}

        {!isManager && profile && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Account verification</h2>
              <Chip tone={toneFor(profile.verificationStatus)}>{STATUS_LABEL[profile.verificationStatus]}</Chip>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{STATUS_HELP[profile.verificationStatus]}</p>
            {profile.reviewNote && (
              <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm">Reviewer note ({fmt(profile.statusUpdatedAt)}): {profile.reviewNote}</p>
            )}
            {profileNeedsAction && <Link href="/dashboard" className={`${pill} mt-4 inline-block`}>Open dashboard to respond</Link>}
          </Panel>
        )}

        {!isManager && (
          <Panel>
            <h2 className="mb-4 text-lg font-semibold">Property submissions</h2>
            {sortedProps.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven&apos;t submitted any property yet.</p>
            ) : (
              <ul className="space-y-3">
                {sortedProps.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-cream/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">Submitted {fmt(p.createdAt)}{p.reviewedAt ? ` · Reviewed ${fmt(p.reviewedAt)}` : " · Waiting for the reviewer"}</p>
                      </div>
                      <Chip tone={toneFor(p.status)}>{PROPERTY_STATUS[p.status]}</Chip>
                    </div>
                    {p.reviewNote && p.status !== "APPROVED" && (
                      <p className="mt-3 rounded-2xl bg-background px-4 py-3">{p.status === "REJECTED" ? "Rejected" : "Reviewer note"}: {p.reviewNote}</p>
                    )}
                    {ATTENTION.includes(p.status) && <Link href={`${base}/${p.id}/edit`} className={`${pill} mt-3 inline-block`}>Update and resubmit</Link>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {isManager && (
          <Panel>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Issues you sent</h2>
              <Link href="/dashboard/issues" className="text-sm text-primary underline">Report a new issue</Link>
            </div>
            {issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven&apos;t sent any issue yet.</p>
            ) : (
              <ul className="space-y-3">
                {issues.map((i) => (
                  <li key={i.id} className="rounded-2xl bg-cream/60 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium"><Link href={`/dashboard/issues/${i.id}`} className="hover:underline">#{i.ticketNo} · {i.title}</Link></p>
                        <p className="text-xs text-muted-foreground">{i.property.name}{i.room ? ` · ${i.room.label}` : ""} · Sent {fmt(i.createdAt)}</p>
                      </div>
                      <Chip tone={i.status === "RESOLVED" || i.status === "CLOSED" ? "good" : "neutral"}>{i.status.replace("_", " ").toLowerCase()}</Chip>
                    </div>
                    {i.resolutionNote
                      ? <p className="mt-3 rounded-2xl bg-background px-4 py-3">Latest reply: {i.resolutionNote}</p>
                      : <p className="mt-3 text-xs text-muted-foreground">No reply yet.</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}
