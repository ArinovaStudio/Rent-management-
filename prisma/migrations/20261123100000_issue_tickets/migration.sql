-- AlterEnum
ALTER TYPE "IssuePriority" ADD VALUE 'URGENT';

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANING', 'SECURITY', 'RESIDENT_COMPLAINT', 'BILLING', 'SAFETY', 'OTHER');

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "ticketNo" SERIAL NOT NULL,
ADD COLUMN "category" "IssueCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "allocationId" TEXT,
ADD COLUMN "neededBy" TIMESTAMP(3),
ADD COLUMN "images" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "escalatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Issue_ticketNo_key" ON "Issue"("ticketNo");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "IssueReply" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'REPLY',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueReply_issueId_createdAt_idx" ON "IssueReply"("issueId", "createdAt");

-- AddForeignKey
ALTER TABLE "IssueReply" ADD CONSTRAINT "IssueReply_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReply" ADD CONSTRAINT "IssueReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing owner notes become the first reply on their ticket
INSERT INTO "IssueReply" ("id", "issueId", "authorId", "kind", "message", "createdAt")
SELECT 'm' || i."id", i."id", p."ownerId", 'STATUS', i."resolutionNote", i."updatedAt"
FROM "Issue" i JOIN "Property" p ON p."id" = i."propertyId"
WHERE i."resolutionNote" IS NOT NULL;
