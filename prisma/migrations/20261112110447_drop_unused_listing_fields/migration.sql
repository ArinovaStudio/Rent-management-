/*
  Warnings:

  - You are about to drop the column `agentCountryCode` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `agentName` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `agentPhone` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `completionStatus` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedAnnualRent` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `fiveYearGrowthPct` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `grossYieldPct` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `isInvestment` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `paymentPlan` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `seoDescription` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `seoTitle` on the `Property` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Property" DROP COLUMN "agentCountryCode",
DROP COLUMN "agentName",
DROP COLUMN "agentPhone",
DROP COLUMN "completionStatus",
DROP COLUMN "estimatedAnnualRent",
DROP COLUMN "fiveYearGrowthPct",
DROP COLUMN "grossYieldPct",
DROP COLUMN "isInvestment",
DROP COLUMN "paymentPlan",
DROP COLUMN "seoDescription",
DROP COLUMN "seoTitle";
