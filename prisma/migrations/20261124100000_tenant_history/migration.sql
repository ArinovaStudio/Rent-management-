-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "moveOutDate" TIMESTAMP(3),
ADD COLUMN     "roomBhk" INTEGER,
ADD COLUMN     "roomLabel" TEXT;

-- Backfill snapshots for existing allocations
UPDATE "Allocation" a SET "roomLabel" = r."label", "roomBhk" = r."bedrooms" FROM "Room" r WHERE r."id" = a."roomId";
UPDATE "Allocation" SET "moveOutDate" = "updatedAt" WHERE "status" = 'CHECKED_OUT' AND "moveOutDate" IS NULL;
