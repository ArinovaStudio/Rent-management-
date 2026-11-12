import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import IssueForm from "./issue-form";
import IssueStatus from "./issue-status";

export default async function IssuesPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  const isManager = me.role === "PROPERTY_MANAGER";

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

  return (
    <main className="wide">
      <p><a href="/dashboard">← Dashboard</a></p>
      <h1>Issues</h1>

      {isManager && (
        properties.length === 0
          ? <p className="notice">You aren't assigned to any property yet.</p>
          : <IssueForm properties={properties} />
      )}

      {issues.length === 0 ? (
        <p className="muted">No issues yet.</p>
      ) : (
        issues.map((i) => (
          <div key={i.id} className="card">
            <strong>{i.title}</strong>{" "}
            <span className="badge">{i.status.replace("_", " ").toLowerCase()}</span>{" "}
            <span className="badge">{i.priority.toLowerCase()}</span>
            <div className="muted" style={{ margin: "4px 0" }}>
              {i.property.name}{i.room ? ` · ${i.room.label}` : ""} · by {i.reportedBy.name} ·{" "}
              {i.createdAt.toLocaleDateString("en-IN")}
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{i.description}</p>
            {i.resolutionNote && <p><strong>Response:</strong> {i.resolutionNote}</p>}
            {!isManager && <IssueStatus id={i.id} status={i.status} note={i.resolutionNote ?? ""} />}
          </div>
        ))
      )}
    </main>
  );
}