-- AlterTable
ALTER TABLE "Issue" ADD COLUMN "ticketCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Issue_ticketCode_key" ON "Issue"("ticketCode");
