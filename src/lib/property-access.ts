import { cache } from "react";
import { prisma } from "./db";
import type { Role } from "./jwt";
import { canEditProperty } from "./permissions";
import { getVerificationStatus } from "./owner-status";

// Cached per request: the same check is often asked more than once while one page renders.
export const isAssignedManager = cache(async (userId: string, propertyId: string) => {
  const row = await prisma.propertyManager.findUnique({
    where: { propertyId_managerId: { propertyId, managerId: userId } },
    select: { id: true },
  });
  return !!row;
});

export const isVerifiedManager = cache(async (userId: string) => (await getVerificationStatus(userId)) === "VERIFIED");

// Day-to-day operations (rooms, allocations, check-outs): owner, Super Admin, or an assigned manager.
// Editing the listing itself stays on canEditProperty, so managers can't change it.
export async function canOperateProperty( me: { id: string; role: Role }, property: { id: string; ownerId: string }) {
  if (canEditProperty(me, property)) return true;
  return (
    me.role === "PROPERTY_MANAGER" && (await isAssignedManager(me.id, property.id)) && (await isVerifiedManager(me.id))
  );
}