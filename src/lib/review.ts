import { prisma } from "./db";
import { notify } from "./mailer";
import { SMS_VERIFICATION_ENABLED } from "./owner-status";

export type ReviewAction = "APPROVE" | "REJECT" | "REQUEST_INFO" | "RESTRICT";
export type ReviewResult = { ok: true } | { ok: false; error: string; status: number };

const fail = (error: string, status = 400): ReviewResult => ({ ok: false, error, status });

export function parseReview(body: unknown): { action: ReviewAction; note: string } | null {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const action = b.action as ReviewAction;
  if (!["APPROVE", "REJECT", "REQUEST_INFO", "RESTRICT"].includes(action)) return null;
  return { action, note: typeof b.note === "string" ? b.note.trim().slice(0, 2000) : "" };
}

const NEEDS_NOTE: ReviewAction[] = ["REJECT", "REQUEST_INFO", "RESTRICT"];
const NOTE_ERROR: Record<string, string> = {
  REJECT: "Give a reason for rejecting.",
  REQUEST_INFO: "Explain what the owner needs to provide.",
  RESTRICT: "Give a reason for restricting.",
};

// ---------- Owner KYC ----------

const OWNER_TARGET = {
  APPROVE: "VERIFIED", REJECT: "REJECTED", REQUEST_INFO: "NEEDS_MORE_INFO", RESTRICT: "RESTRICTED",
} as const;

// Moves an owner's verification status. Independent of property approval.
export async function reviewOwner(adminId: string, profileId: string, action: ReviewAction, note: string): Promise<ReviewResult> {
  if (NEEDS_NOTE.includes(action) && !note) return fail(NOTE_ERROR[action]);

  const profile = await prisma.ownerProfile.findUnique({ where: { id: profileId }, include: { user: true } });
  if (!profile) return fail("Application not found.", 404);
  const from = profile.verificationStatus;
  const to = OWNER_TARGET[action];
  // if (from === to) return fail("The application is already in that state.", 409);
  // Re-sending "request more information" (e.g. with a corrected note) is allowed.
  if (from === to && action !== "REQUEST_INFO") return fail("The application is already in that state.", 409);
  
  if (action === "APPROVE") {
    if (!profile.onboardingCompletedAt) return fail("The owner hasn't submitted their registration yet.", 409);
    if (!profile.user.emailVerifiedAt || (SMS_VERIFICATION_ENABLED && !profile.phoneVerifiedAt)) {
      return fail("The owner's contact details aren't verified yet.", 409);
    }
  }

  const now = new Date();
  // The "from" check makes two admins acting at once safe: the second one gets a conflict.
  const changed = await prisma.$transaction(async (tx) => {
    const r = await tx.ownerProfile.updateMany({
      where: { id: profileId, verificationStatus: from },
      data: {
        verificationStatus: to, statusUpdatedAt: now,
        reviewedById: adminId, reviewedAt: now, reviewNote: note || null,
      },
    });
    if (r.count === 0) return false;
    await tx.auditEvent.create({
      data: { subjectType: "OWNER_KYC", subjectId: profileId, actorId: adminId, action, fromStatus: from, toStatus: to, note: note || null },
    });
    return true;
  });
  if (!changed) return fail("This application was just changed by someone else. Reload and try again.", 409);

  const name = profile.legalName;
  const mail = {
    APPROVE: ["Your account is verified", `Hi ${name},\n\nYour account has been verified. You can now add properties.`],
    REJECT: ["Your verification was not approved", `Hi ${name},\n\nWe couldn't verify your account.\n\nReason: ${note}`],
    REQUEST_INFO: ["More information needed for your verification", `Hi ${name},\n\nWe need more information before we can verify your account:\n\n${note}\n\nSign in, upload the requested document on your dashboard and it will go back to review.`],
    RESTRICT: ["Your account has been restricted", `Hi ${name},\n\nYour account has been restricted.\n\nReason: ${note}`],
  }[action];
  await notify(profile.user.email, mail[0], mail[1]);
  return { ok: true };
}

// ---------- Property approval ----------

const PROPERTY_TARGET = { APPROVE: "APPROVED", REJECT: "REJECTED", REQUEST_INFO: "NEEDS_MORE_INFO" } as const;

// Approves or rejects one property. Deliberately never looks at the owner's KYC status.
export async function reviewProperty(adminId: string, propertyId: string, action: ReviewAction, note: string): Promise<ReviewResult> {
  if (action === "RESTRICT") return fail("Invalid action.");
  if (NEEDS_NOTE.includes(action) && !note) return fail(action === "REJECT" ? "Give a reason for rejecting." : NOTE_ERROR[action]);

  const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { owner: true } });
  if (!property) return fail("Property not found.", 404);
  const from = property.status;
  const to = PROPERTY_TARGET[action];
  // if (from === to) return fail("The property is already in that state.", 409);
  if (from === to && action !== "REQUEST_INFO") return fail("The property is already in that state.", 409);

  const now = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const r = await tx.property.updateMany({
      where: { id: propertyId, status: from },
      data: { status: to, reviewNote: note || null, reviewedAt: now, reviewedById: adminId },
    });
    if (r.count === 0) return false;
    await tx.auditEvent.create({
      data: { subjectType: "PROPERTY", subjectId: propertyId, actorId: adminId, action, fromStatus: from, toStatus: to, note: note || null },
    });
    return true;
  });
  if (!changed) return fail("This property was just changed by someone else. Reload and try again.", 409);

  const n = property.name;
  const mail = {
    APPROVE: [`"${n}" is approved`, `Your property "${n}" has been approved and is now live.`],
    REJECT: [`"${n}" was not approved`, `Your property "${n}" was not approved.\n\nReason: ${note}`],
    REQUEST_INFO: [`More information needed for "${n}"`, `We need more information about "${n}":\n\n${note}\n\nEdit the property to update it; saving sends it back for review.`],
  }[action];
  await notify(property.owner.email, mail[0], mail[1]);
  return { ok: true };
}
