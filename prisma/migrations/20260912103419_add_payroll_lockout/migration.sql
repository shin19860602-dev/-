-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "payrollFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payrollLockedUntil" TIMESTAMP(3);
