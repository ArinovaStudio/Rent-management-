-- AlterEnum
ALTER TYPE "ReviewStatus" ADD VALUE 'NEEDS_MORE_INFO';

-- AlterTable
ALTER TABLE "OwnerProfile" ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNote" TEXT;

ALTER TABLE "Property" ADD COLUMN "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_subjectType_subjectId_createdAt_idx" ON "AuditEvent"("subjectType", "subjectId", "createdAt");
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");
