import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canEditProperty } from "@/lib/permissions";
import { STATUS_LABEL, notifyEmails, superAdminEmails } from "@/lib/issues";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

// The handler (Property Admin of the property, or Super Admin) updates the status and can leave a note.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: { property: { include: { owner: { select: { email: true } } } }, reportedBy: { select: { email: true } } },
  });
  if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  if (!canEditProperty(me, issue.property)) {
    return NextResponse.json({ error: "You can't update this issue." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  const note = typeof b.resolutionNote === "string" ? b.resolutionNote.trim().slice(0, 2000) : "";
  const changed = b.status !== issue.status;
  const label = STATUS_LABEL[b.status as keyof typeof STATUS_LABEL];

  await prisma.$transaction([
    prisma.issue.update({
      where: { id },
      data: {
        status: b.status,
        resolutionNote: note || issue.resolutionNote,
        resolvedAt: b.status === "RESOLVED" || b.status === "CLOSED" ? new Date() : null,
      },
    }),
    ...(note || changed
      ? [prisma.issueReply.create({
          data: { issueId: id, authorId: me.id, kind: "STATUS", message: note ? `${changed ? `Status: ${label}. ` : ""}${note}` : `Status changed to ${label}.` },
        })]
      : []),
  ]);

  await notifyEmails(
    [issue.reportedBy.email, issue.property.owner.email, ...(issue.escalatedAt ? await superAdminEmails() : [])].filter((e) => e !== me.email),
    `Ticket #${issue.ticketNo} update: ${issue.title}`,
    `${me.name} updated the ticket at "${issue.property.name}". Status: ${label}.${note ? `\n\nNote: ${note}` : ""}`
  );
  return NextResponse.json({ ok: true });
}
