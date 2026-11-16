-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('ELECTRICITY', 'WATER');

-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "floorNumber" INTEGER,
ADD COLUMN     "roomCategory" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "floor" INTEGER;

-- CreateTable
CREATE TABLE "ResidentBill" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "type" "BillType" NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidentBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResidentBill_allocationId_idx" ON "ResidentBill"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentBill_allocationId_type_period_key" ON "ResidentBill"("allocationId", "type", "period");

-- AddForeignKey
ALTER TABLE "ResidentBill" ADD CONSTRAINT "ResidentBill_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
