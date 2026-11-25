import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip } from "@/app/admin/ui";
import { CATEGORY_LABEL, PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL, canSeeIssue, canUpdateIssue, priorityTone, statusTone, ticketLabel, withWho } from "@/lib/issues";
import TicketActions from "./ticket-actions";

const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{children}</p></div>;
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const name = (me as unknown as { name?: string }).name ?? "Account";
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      property: { select: { name: true, ownerId: true, owner: { select: { name: true } } } },
      room: { select: { label: true } },
      allocation: { select: { fullName: true, phone: true } },
      reportedBy: { select: { name: true } },
      recipient: { select: { name: true } },
      replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
    },
  });
  if (!issue || !(await canSeeIssue(me, issue))) notFound();

  const canUpdate = canUpdateIssue(me, issue);
  const canEscalate = me.role === "PROPERTY_ADMIN" && canUpdate && !issue.escalatedAt;
  const images = (Array.isArray(issue.images) ? issue.images : []) as string[];

  return (
    <AdminShell role={me.role} name={name}>
      <Link href="/dashboard/issues" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All issues</Link>
      <PageHeader title={`${ticketLabel(issue)} · ${issue.title}`} sub={`${issue.property.name}${issue.room ? ` · ${issue.room.label}` : ""}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel>
            <div className="mb-4 flex flex-wrap gap-2">
              <Chip tone={statusTone(issue.status)}>{STATUS_LABEL[issue.status]}</Chip>
              <Chip tone={priorityTone(issue.priority)}>{PRIORITY_LABEL[issue.priority]} priority</Chip>
              <Chip tone="neutral">{CATEGORY_LABEL[issue.category]}</Chip>
              <Chip tone={issue.escalatedAt ? "bad" : "neutral"}>With {withWho(issue)}</Chip>
            </div>
            <p className="whitespace-pre-wrap text-sm">{issue.description}</p>
            {images.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {images.map((p) => (
                  <a key={p} href={`/api/uploads/${p}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/uploads/${p}`} alt="Issue photo" className="h-24 w-32 rounded-xl object-cover" />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-5 grid gap-4 border-t border-cream pt-4 sm:grid-cols-3">
              <Field label="Raised by">{issue.reportedBy.name}</Field>
              <Field label="Raised on">{fmt(issue.createdAt)}</Field>
              <Field label="Needed by">{issue.neededBy ? issue.neededBy.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—"}</Field>
              <Field label="Sent to">{issue.recipient ? `${issue.recipient.name} (co-owner)` : `${issue.property.owner.name} (owner)`}</Field>
              <Field label="Resident affected">{issue.allocation ? `${issue.allocation.fullName} · ${issue.allocation.phone}` : "—"}</Field>
              {issue.escalatedAt && <Field label="Escalated on">{fmt(issue.escalatedAt)}</Field>}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-lg font-semibold">Responses</h2>
            {issue.replies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No response yet.</p>
            ) : (
              <ul className="space-y-3">
                {issue.replies.map((r) => (
                  <li key={r.id} className={`rounded-2xl p-4 text-sm ${r.kind === "ESCALATED" ? "bg-destructive/10" : r.author.role === "PROPERTY_MANAGER" ? "bg-cream/60" : "bg-primary/10"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{r.author.name} <span className="font-normal text-muted-foreground">· {ROLE_LABEL[r.author.role]}</span></p>
                      <p className="text-xs text-muted-foreground">{fmt(r.createdAt)}</p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{r.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="h-fit">
          <TicketActions issueId={issue.id} status={issue.status} canUpdate={canUpdate} canEscalate={canEscalate} />
        </Panel>
      </div>
    </AdminShell>
  );
}
