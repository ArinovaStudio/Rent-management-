import type { Role } from "./jwt";

export const CAN_CREATE: Record<Role, Role[]> = {
  SUPER_ADMIN: ["PROPERTY_ADMIN"],
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
export function canManageProperties(role: Role) {
  return role === "SUPER_ADMIN" || role === "PROPERTY_ADMIN";
}

// Super Admin can edit any property 
// a Property Admin only the ones they own
export function canEditProperty(me: { id: string; role: Role }, property: { ownerId: string }) {
  if (me.role === "SUPER_ADMIN") return true;
  return me.role === "PROPERTY_ADMIN" && property.ownerId === me.id;
}