import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { notifyEmails, superAdminEmails } from "@/lib/issues";

// The Property Admin who owns the property passes the ticket on to the Super Admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: { property: { select: { name: true, ownerId: true } }, reportedBy: { select: { email: true } } },
  });
  if (!issue) return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  if (me.role !== "PROPERTY_ADMIN" || issue.property.ownerId !== me.id) {
    return NextResponse.json({ error: "Only the Property Admin of this property can escalate." }, { status: 403 });
  }
  if (issue.escalatedAt) return NextResponse.json({ error: "Already with the Super Admin." }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "";

  await prisma.$transaction([
    prisma.issue.update({ where: { id }, data: { escalatedAt: new Date() } }),
    prisma.issueReply.create({
      data: { issueId: id, authorId: me.id, kind: "ESCALATED", message: `Escalated to Super Admin${note ? `: ${note}` : "."}` },
    }),
  ]);

  await notifyEmails(
    [...(await superAdminEmails()), issue.reportedBy.email],
    `Ticket #${issue.ticketNo} escalated: ${issue.title}`,
    `${me.name} escalated the ticket at "${issue.property.name}" to the Super Admin.${note ? `\n\nNote: ${note}` : ""}`
  );
  return NextResponse.json({ ok: true });
}
