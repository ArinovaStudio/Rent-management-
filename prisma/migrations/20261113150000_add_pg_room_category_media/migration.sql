CREATE TYPE "RoomMediaType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "RoomCategoryMedia" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "mediaType" "RoomMediaType" NOT NULL,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomCategoryMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RoomCategoryMedia_propertyId_capacity_mediaType_idx"
ON "RoomCategoryMedia"("propertyId", "capacity", "mediaType");

ALTER TABLE "RoomCategoryMedia" ADD CONSTRAINT "RoomCategoryMedia_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
