-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('CONTACT_PENDING', 'KYC_PENDING', 'NEEDS_MORE_INFO', 'VERIFIED', 'RESTRICTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE');

-- CreateEnum
CREATE TYPE "PropertyRelationship" AS ENUM ('OWNER', 'CO_OWNER', 'LEASEHOLDER', 'POWER_OF_ATTORNEY', 'AUTHORIZED_MANAGER');

-- CreateEnum
CREATE TYPE "SensitiveDocumentType" AS ENUM ('ID_DOCUMENT', 'ADDRESS_PROOF', 'COMPANY_REGISTRATION', 'AUTHORITY_PROOF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Existing Google-linked users already had their email verified by Google.
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP WHERE "googleId" IS NOT NULL;

-- CreateTable
CREATE TABLE "OwnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "legalName" TEXT NOT NULL,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "idType" "IdType",
    "idNumberMasked" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "companyRegistrationNumber" TEXT,
    "gstin" TEXT,
    "signatoryName" TEXT,
    "signatoryDesignation" TEXT,
    "propertyRelationship" "PropertyRelationship",
    "authorityDetails" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "privacyAcceptedAt" TIMESTAMP(3),
    "privacyVersion" TEXT,
    "kycConsentAt" TIMESTAMP(3),
    "kycConsentVersion" TEXT,
    "authorityDeclaredAt" TIMESTAMP(3),
    "authorityDeclarationVersion" TEXT,
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'CONTACT_PENDING',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitiveDocument" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "type" "SensitiveDocumentType" NOT NULL,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensitiveDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OwnerProfile_userId_key" ON "OwnerProfile"("userId");

-- CreateIndex
CREATE INDEX "OwnerProfile_verificationStatus_idx" ON "OwnerProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "SensitiveDocument_ownerProfileId_type_idx" ON "SensitiveDocument"("ownerProfileId", "type");

-- AddForeignKey
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensitiveDocument" ADD CONSTRAINT "SensitiveDocument_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
