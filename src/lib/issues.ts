import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAssignedManager } from "@/lib/property-access";
import { notify } from "@/lib/mailer";

export * from "./issue-constants";

// A Property Admin is on a ticket as the property's main owner, or as the co-owner it was sent to.
const onTicket = (me: { id: string }, i: { recipientId: string | null; property: { ownerId: string } }) =>
  i.property.ownerId === me.id || i.recipientId === me.id;

// Which tickets a person sees: Super Admin all, Property Admin their own properties' and the ones sent to them as co-owner,
// Manager their assigned properties'.
export function issueScope(me: { id: string; role: Role }) {
  return me.role === "SUPER_ADMIN" ? {}
    : me.role === "PROPERTY_MANAGER" ? { property: { managers: { some: { managerId: me.id } } } }
    : { OR: [{ property: { ownerId: me.id } }, { recipientId: me.id }] };
}

export async function canSeeIssue(me: { id: string; role: Role }, issue: { propertyId: string; recipientId: string | null; property: { ownerId: string } }) {
  if (me.role === "SUPER_ADMIN") return true;
  if (me.role === "PROPERTY_ADMIN") return onTicket(me, issue);
  return isAssignedManager(me.id, issue.propertyId);
}

// Who can change the status and escalate: Super Admin, and the Property Admin / co-owner the ticket is with.
export function canUpdateIssue(me: { id: string; role: Role }, issue: { recipientId: string | null; property: { ownerId: string } }) {
  return me.role === "SUPER_ADMIN" || (me.role === "PROPERTY_ADMIN" && onTicket(me, issue));
}

export async function superAdminEmails() {
  const rows = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { email: true } });
  return rows.map((r) => r.email);
}

export async function notifyEmails(to: (string | null | undefined)[], subject: string, text: string) {
  const list = [...new Set(to.filter((e): e is string => !!e))];
  await Promise.all(list.map((e) => notify(e, subject, text)));
}
