-- AlterTable
ALTER TABLE "Property" ADD COLUMN "mapUrl" TEXT,
ADD COLUMN "amenityCharges" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "inactiveNote" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "inactiveNote" TEXT;
