-- CreateTable
CREATE TABLE "StoreSavings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSavings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSavings_storeId_yearMonth_key" ON "StoreSavings"("storeId", "yearMonth");

-- AddForeignKey
ALTER TABLE "StoreSavings" ADD CONSTRAINT "StoreSavings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
