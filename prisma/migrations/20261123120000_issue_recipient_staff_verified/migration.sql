-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "recipientId" TEXT;

-- CreateIndex
CREATE INDEX "Issue_recipientId_idx" ON "Issue"("recipientId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Accounts created by an admin no longer go through email verification or the registration wizard.
-- Move the ones still waiting at that step to verified.
UPDATE "OwnerProfile" op
SET "verificationStatus" = 'VERIFIED',
    "onboardingCompletedAt" = COALESCE(op."onboardingCompletedAt", NOW()),
    "completedSteps" = 3,
    "statusUpdatedAt" = NOW()
FROM "User" u
WHERE u."id" = op."userId"
  AND u."createdById" IS NOT NULL
  AND op."verificationStatus" = 'CONTACT_PENDING';
