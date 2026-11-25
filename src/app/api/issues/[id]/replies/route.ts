import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeIssue, notifyEmails, superAdminEmails, ticketLabel } from "@/lib/issues";

// Anyone on the ticket (manager, Property Admin, Super Admin) can add a reply.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: { property: { include: { owner: { select: { email: true } } } }, recipient: { select: { email: true } }, reportedBy: { select: { email: true } } },
  });
  if (!issue || !(await canSeeIssue(me, issue))) return NextResponse.json({ error: "Issue not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });

  await prisma.issueReply.create({ data: { issueId: id, authorId: me.id, kind: "REPLY", message } });

  await notifyEmails(
    [issue.reportedBy.email, issue.property.owner.email, issue.recipient?.email, ...(issue.escalatedAt ? await superAdminEmails() : [])].filter((e) => e !== me.email),
    `New reply on ticket ${ticketLabel(issue)}: ${issue.title}`,
    `${me.name} replied on the ticket at "${issue.property.name}":\n\n${message}`
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
