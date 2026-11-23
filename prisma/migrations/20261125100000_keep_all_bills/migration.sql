-- A new bill no longer replaces the bill of the same month: every bill is kept as history
DROP INDEX IF EXISTS "ResidentBill_allocationId_type_period_key";

-- CreateIndex
CREATE INDEX "ResidentBill_allocationId_type_period_idx" ON "ResidentBill"("allocationId", "type", "period");
