-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "totalRooms" INTEGER;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "bathroomAreaSqm" DOUBLE PRECISION,
ADD COLUMN     "bathroomAttached" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "images" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "roomType" TEXT,
ADD COLUMN     "sizeSqm" DOUBLE PRECISION;
