import { prisma } from "./db";

export type VerificationStatusValue =
  | "CONTACT_PENDING"
  | "KYC_PENDING"
  | "NEEDS_MORE_INFO"
  | "VERIFIED"
  | "RESTRICTED"
  | "REJECTED";

export const STATUS_LABEL: Record<VerificationStatusValue, string> = {
  CONTACT_PENDING: "Contact verification pending",
  KYC_PENDING: "KYC review pending",
  NEEDS_MORE_INFO: "More information needed",
  VERIFIED: "Verified",
  RESTRICTED: "Restricted",
  REJECTED: "Rejected",
};

// SMS OTP is not built yet, so mobile verification is skipped. Flip to true once it exists.
export const SMS_VERIFICATION_ENABLED = false;

export const STATUS_HELP: Record<VerificationStatusValue, string> = {
  CONTACT_PENDING: "Verify your email to continue",
  KYC_PENDING: "Your details are with our team for review. You can't add properties until you're verified.",
  NEEDS_MORE_INFO: "We need more information from you. Re-upload your ID document below, then wait for review.",
  VERIFIED: "Your account is fully verified.",
  RESTRICTED: "Your account has been restricted. Contact support.",
  REJECTED: "We couldn't verify your account. Contact support.",
};

// Moves an owner from CONTACT_PENDING to KYC_PENDING once both contact channels are verified and
// onboarding is submitted. It never touches any other status, so it can't undo a review decision.
// Call it after anything that could complete the checklist: submitting step 3, Google sign-in,
// and (Phase 2) a successful phone or email OTP.
export async function syncVerificationStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, createdById: true, ownerProfile: true },
  });
  const p = user?.ownerProfile;
  if (!user || !p || p.verificationStatus !== "CONTACT_PENDING") return;
  if (user.emailVerifiedAt && (!SMS_VERIFICATION_ENABLED || p.phoneVerifiedAt) && p.onboardingCompletedAt) {
    // Accounts created by an admin were vouched for by that admin when the documents were collected,
    // so confirming the email completes their verification. Self-registered owners go to KYC review.
    const vouchedBy = user.createdById;
    const res = await prisma.ownerProfile.updateMany({
      where: { id: p.id, verificationStatus: "CONTACT_PENDING" },
      data: { verificationStatus: vouchedBy ? "VERIFIED" : "KYC_PENDING", statusUpdatedAt: new Date() },
    });
    if (vouchedBy && res.count === 1) {
      await prisma.auditEvent.create({
        data: {
          subjectType: "OWNER_KYC", subjectId: p.id, actorId: vouchedBy, action: "APPROVE",
          fromStatus: "CONTACT_PENDING", toStatus: "VERIFIED",
          note: "Verified automatically on email confirmation. Account was created and vouched for by an admin.",
        },
      });
    }
  }
}

// True for owners who registered through the wizard but haven't finished it. Accounts with no
// profile (created before onboarding existed, Super Admins, managers) are never blocked.
export async function hasUnfinishedOnboarding(userId: string) {
  const p = await prisma.ownerProfile.findUnique({
    where: { userId },
    select: { onboardingCompletedAt: true },
  });
  return !!p && !p.onboardingCompletedAt;
}

// The owner's verification status, or null for accounts with no owner profile.
export async function getVerificationStatus(userId: string): Promise<VerificationStatusValue | null> {
  const p = await prisma.ownerProfile.findUnique({ where: { userId }, select: { verificationStatus: true } });
  return p?.verificationStatus ?? null;
}
