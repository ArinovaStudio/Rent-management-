import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAssignedManager } from "@/lib/property-access";
import { notify } from "@/lib/mailer";

export * from "./issue-constants";

// Which tickets a person sees: Super Admin all, Property Admin their own properties', Manager their assigned properties'.
export function issueScope(me: { id: string; role: Role }) {
  return me.role === "SUPER_ADMIN" ? {}
    : me.role === "PROPERTY_MANAGER" ? { property: { managers: { some: { managerId: me.id } } } }
    : { property: { ownerId: me.id } };
}

export async function canSeeIssue(me: { id: string; role: Role }, issue: { propertyId: string; property: { ownerId: string } }) {
  if (me.role === "SUPER_ADMIN") return true;
  if (me.role === "PROPERTY_ADMIN") return issue.property.ownerId === me.id;
  return isAssignedManager(me.id, issue.propertyId);
}

export async function superAdminEmails() {
  const rows = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { email: true } });
  return rows.map((r) => r.email);
}

export async function notifyEmails(to: (string | null | undefined)[], subject: string, text: string) {
  const list = [...new Set(to.filter((e): e is string => !!e))];
  await Promise.all(list.map((e) => notify(e, subject, text)));
}
