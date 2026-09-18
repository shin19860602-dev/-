-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "savingsFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "savingsLockedUntil" TIMESTAMP(3),
ADD COLUMN     "savingsPassword" TEXT;
