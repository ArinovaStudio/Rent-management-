import type { Role } from "./jwt";
import type { VerificationStatusValue } from "./owner-status";

export const CAN_CREATE: Record<Role, Role[]> = {
  SUPER_ADMIN: ["PROPERTY_ADMIN", "PROPERTY_MANAGER"],
  PROPERTY_ADMIN: ["PROPERTY_MANAGER"],
  PROPERTY_MANAGER: [],
};

export function canDelete(
  me: { id: string; role: Role },
  target: { role: Role; createdById: string | null }
) {
  if (me.role === "SUPER_ADMIN") return target.role !== "SUPER_ADMIN";
  if (me.role === "PROPERTY_ADMIN") {
    return target.role === "PROPERTY_MANAGER" && target.createdById === me.id;
  }
  return false;
}

// ---- Properties ----
// `status` is the owner's verification status. Only VERIFIED owners can create properties.
// Accounts with no owner profile (created before onboarding existed) pass `null` and are not blocked.
export function canManageProperties(role: Role, status: VerificationStatusValue | null = null) {
  if (role === "SUPER_ADMIN") return true;
  if (role !== "PROPERTY_ADMIN") return false;
  return status === null || status === "VERIFIED";
}

// Super Admin can edit any property 
// a Property Admin only the ones they own
export function canEditProperty(me: { id: string; role: Role }, property: { ownerId: string }) {
  if (me.role === "SUPER_ADMIN") return true;
  return me.role === "PROPERTY_ADMIN" && property.ownerId === me.id;
}

// ---- Property field access ----
// Anything not listed: writable by Super Admin and Property Admin, readable by every role.
const WRITE_ROLES: Record<string, Role[]> = { featured: ["SUPER_ADMIN"] };
const READ_ROLES: Record<string, Role[]> = {
  titleDeedNumber: ["SUPER_ADMIN", "PROPERTY_ADMIN"],
};
export const canWriteField = (role: Role, field: string) => (WRITE_ROLES[field] ?? ["SUPER_ADMIN", "PROPERTY_ADMIN"]).includes(role);
export const canReadField = (role: Role, field: string) => (READ_ROLES[field] ?? ["SUPER_ADMIN", "PROPERTY_ADMIN", "PROPERTY_MANAGER"]).includes(role);