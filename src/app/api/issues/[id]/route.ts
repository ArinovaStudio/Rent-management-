import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { notify } from "@/lib/mailer";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

// Owner or Super Admin updates the status and leaves a note for the manager.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: { property: true, reportedBy: { select: { email: true, name: true } } },
  });
  if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  if (!canEditProperty(me, issue.property)) {
    return NextResponse.json({ error: "You can't update this issue." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const note = typeof b.resolutionNote === "string" ? b.resolutionNote.trim().slice(0, 2000) : "";

  await prisma.issue.update({
    where: { id },
    data: {
      status: b.status,
      resolutionNote: note || null,
      resolvedAt: b.status === "RESOLVED" || b.status === "CLOSED" ? new Date() : null,
    },
  });

  await notify(
    issue.reportedBy.email,
    `Issue update: ${issue.title}`,
    `Your issue at "${issue.property.name}" is now ${String(b.status).replace("_", " ").toLowerCase()}.${note ? `\n\nNote: ${note}` : ""}`
  );
  return NextResponse.json({ ok: true });
}