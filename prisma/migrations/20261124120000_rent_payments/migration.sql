-- CreateTable
CREATE TABLE "RentPayment" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentPayment_allocationId_period_key" ON "RentPayment"("allocationId", "period");

-- CreateIndex
CREATE INDEX "RentPayment_allocationId_idx" ON "RentPayment"("allocationId");

-- AddForeignKey
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
