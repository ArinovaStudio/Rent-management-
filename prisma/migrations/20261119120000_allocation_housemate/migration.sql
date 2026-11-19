-- AlterTable: a person sharing a Building flat with the main tenant (no own link, rent/bills on the main tenant)
ALTER TABLE "Allocation" ADD COLUMN "isHousemate" BOOLEAN NOT NULL DEFAULT false;
