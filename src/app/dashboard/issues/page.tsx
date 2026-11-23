import Link from "next/link";
import { redirect } from "next/navigation";
import type { IssueStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip } from "@/app/admin/ui";
import { CATEGORY_LABEL, PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL, issueScope, priorityTone, statusTone, withWho } from "@/lib/issues";
import RaiseIssue, { type RaiseProperty } from "./raise-issue";

const FILTERS = [["open", "Open"], ["escalated", "With Super Admin"], ["closed", "Resolved"], ["all", "All"]] as const;
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const isManager = me.role === "PROPERTY_MANAGER";
  const name = (me as unknown as { name?: string }).name ?? "Account";

  const { f = "open" } = await searchParams;
  const filter =
    f === "closed" ? { status: { in: ["RESOLVED", "CLOSED"] as IssueStatus[] } }
    : f === "escalated" ? { escalatedAt: { not: null } }
    : f === "all" ? {}
    : { status: { in: ["OPEN", "IN_PROGRESS"] as IssueStatus[] } };

  const [issues, properties] = await Promise.all([
    prisma.issue.findMany({
      where: { ...issueScope(me), ...filter },
      include: {
        property: { select: { name: true } },
        room: { select: { label: true } },
        reportedBy: { select: { name: true } },
        replies: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { name: true, role: true } } } },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    isManager
      ? prisma.property.findMany({
          where: { managers: { some: { managerId: me.id } } },
          select: {
            id: true, name: true, ownerId: true,
            owner: { select: { name: true } },
            coOwners: { select: { userId: true, user: { select: { name: true } } } },
            rooms: {
              select: { id: true, label: true, floor: true, allocations: { where: { status: "ACTIVE" }, select: { id: true, fullName: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  const raise: RaiseProperty[] = properties.map((p) => ({
    id: p.id, name: p.name,
    recipients: [{ id: p.ownerId, name: p.owner.name, label: "Main owner" }, ...p.coOwners.map((c) => ({ id: c.userId, name: c.user.name, label: "Co-owner" }))],
    rooms: p.rooms.map((r) => ({ id: r.id, label: r.label, floor: r.floor ?? null, residents: r.allocations.map((a) => ({ id: a.id, name: a.fullName })) })),
  }));

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader
        title="Issues"
        sub={isManager ? "Raise issues to the property owner and track the replies." : "Tickets from managers. Reply, update the status, or escalate."}
        action={isManager && <RaiseIssue properties={raise} variant="primary" />}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map(([key, text]) => (
          <Link key={key} href={`/dashboard/issues?f=${key}`} className={`rounded-full px-4 py-2 text-sm ${f === key || (key === "open" && !FILTERS.some(([k]) => k === f)) ? "bg-primary text-primary-foreground" : "bg-background hover:bg-cream"}`}>{text}</Link>
        ))}
      </div>

      {isManager && properties.length === 0 && <p className="mb-6 rounded-2xl bg-cream px-5 py-3 text-sm">You aren&apos;t assigned to any property yet.</p>}

      {issues.length === 0 ? (
        <Panel><p className="text-muted-foreground">No issues here.</p></Panel>
      ) : (
        <div className="space-y-4">
          {issues.map((i) => {
            const last = i.replies[0];
            return (
              <Link key={i.id} href={`/dashboard/issues/${i.id}`} className="block">
                <Panel className="transition-colors hover:bg-cream/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold"><span className="text-muted-foreground">#{i.ticketNo}</span> {i.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {i.property.name}{i.room ? ` · ${i.room.label}` : ""} · {CATEGORY_LABEL[i.category]} · by {i.reportedBy.name} · {fmt(i.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip tone={statusTone(i.status)}>{STATUS_LABEL[i.status]}</Chip>
                      <Chip tone={priorityTone(i.priority)}>{PRIORITY_LABEL[i.priority]}</Chip>
                      <Chip tone={i.escalatedAt ? "bad" : "neutral"}>With {withWho(i)}</Chip>
                    </div>
                  </div>
                  {last ? (
                    <p className="mt-3 line-clamp-2 rounded-2xl bg-cream px-4 py-3 text-sm">
                      <strong>{last.author.name} ({ROLE_LABEL[last.author.role]}):</strong> {last.message}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No response yet.</p>
                  )}
                  {i._count.replies > 1 && <p className="mt-2 text-xs text-muted-foreground">{i._count.replies} responses</p>}
                </Panel>
              </Link>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
