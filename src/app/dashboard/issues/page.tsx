import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { AdminShell, PageHeader, Panel } from "@/components/admin/AdminShell";
import { Chip } from "@/app/admin/ui";
import IssueForm from "./issue-form";
import IssueStatus from "./issue-status";

const statusTone = (s: string) => (s === "RESOLVED" || s === "CLOSED" ? "good" : "neutral");

export default async function IssuesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const isManager = me.role === "PROPERTY_MANAGER";
  const name = (me as unknown as { name?: string }).name ?? "Account";

  const where =
    me.role === "SUPER_ADMIN" ? {}
    : isManager ? { property: { managers: { some: { managerId: me.id } } } }
    : { property: { ownerId: me.id } };

  const issues = await prisma.issue.findMany({
    where,
    include: {
      property: { select: { name: true } },
      room: { select: { label: true } },
      reportedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const properties = isManager
    ? await prisma.property.findMany({
        where: { managers: { some: { managerId: me.id } } },
        select: { id: true, name: true, rooms: { select: { id: true, label: true }, orderBy: { createdAt: "asc" } } },
        orderBy: { name: "asc" },
      })
    : [];

  const open = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;

  return (
    <AdminShell role={me.role} name={name}>
      <PageHeader title="Issues" sub={isManager ? "Report problems to the property owner." : `${open} open · ${issues.length} total`} />

      {isManager && (
        properties.length === 0
          ? <p className="mb-6 rounded-2xl bg-cream px-5 py-3 text-sm">You aren&apos;t assigned to any property yet.</p>
          : <IssueForm properties={properties} />
      )}

      {issues.length === 0 ? (
        <Panel><p className="text-muted-foreground">No issues yet.</p></Panel>
      ) : (
        <div className="space-y-4">
          {issues.map((i) => (
            <Panel key={i.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{i.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {i.property.name}{i.room ? ` · ${i.room.label}` : ""} · by {i.reportedBy.name} · {i.createdAt.toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Chip tone={statusTone(i.status)}>{i.status.replace("_", " ").toLowerCase()}</Chip>
                  <Chip tone={i.priority === "HIGH" ? "bad" : "neutral"}>{i.priority.toLowerCase()}</Chip>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{i.description}</p>
              {i.resolutionNote && <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm"><strong>Response:</strong> {i.resolutionNote}</p>}
              {!isManager && <IssueStatus id={i.id} status={i.status} note={i.resolutionNote ?? ""} />}
            </Panel>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
