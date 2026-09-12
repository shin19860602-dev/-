/*
  Warnings:

  - You are about to drop the column `amount` on the `Salary` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Salary" DROP COLUMN "amount",
ADD COLUMN     "baseSalary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "employmentInsurance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incomeTax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productCommission" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "residentTax" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceCommission" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "specialAllowance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "productCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "serviceCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "insuranceRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
