CREATE TABLE "PropertyCoOwner" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyCoOwner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyCoOwnerDocument" (
    "id" TEXT NOT NULL,
    "propertyCoOwnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyCoOwnerDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyCoOwner_propertyId_userId_key" ON "PropertyCoOwner"("propertyId", "userId");
CREATE INDEX "PropertyCoOwner_userId_idx" ON "PropertyCoOwner"("userId");
CREATE INDEX "PropertyCoOwnerDocument_propertyCoOwnerId_uploadedAt_idx" ON "PropertyCoOwnerDocument"("propertyCoOwnerId", "uploadedAt");

ALTER TABLE "PropertyCoOwner" ADD CONSTRAINT "PropertyCoOwner_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyCoOwner" ADD CONSTRAINT "PropertyCoOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyCoOwner" ADD CONSTRAINT "PropertyCoOwner_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropertyCoOwnerDocument" ADD CONSTRAINT "PropertyCoOwnerDocument_propertyCoOwnerId_fkey" FOREIGN KEY ("propertyCoOwnerId") REFERENCES "PropertyCoOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
