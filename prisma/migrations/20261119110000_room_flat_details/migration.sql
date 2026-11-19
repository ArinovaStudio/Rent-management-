-- AlterTable: per-flat details for Building properties
ALTER TABLE "Room" ADD COLUMN "bedrooms" INTEGER,
ADD COLUMN "bathrooms" INTEGER,
ADD COLUMN "furnishing" TEXT;
