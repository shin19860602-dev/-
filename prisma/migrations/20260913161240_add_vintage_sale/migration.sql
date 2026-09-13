-- CreateTable
CREATE TABLE "VintageSale" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "itemName" TEXT NOT NULL,
    "category" TEXT,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VintageSale_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VintageSale" ADD CONSTRAINT "VintageSale_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VintageSale" ADD CONSTRAINT "VintageSale_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
