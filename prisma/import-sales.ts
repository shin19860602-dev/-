// 過去の日別売上（Excel雛形）を一括インポートするスクリプト。
// カルテ明細は無いため、店舗ごとの「過去データ（インポート）」プレースホルダー顧客に紐付けて登録する。
// 使い方: npx tsx prisma/import-sales.ts <変換済みJSONのパス>
import fs from "node:fs";
import { prisma } from "../lib/prisma";

type Row = [string, ...number[]]; // [日付文字列(YYYY/MM/DD), 店舗ごとに 技術現金,技術クレジット,ポイント,商品現金,商品クレジット ×3店舗]

const STORE_CONFIGS = [
  { slug: "chura-re", offset: 0 },
  { slug: "shell-valley", offset: 5 },
  { slug: "lien", offset: 10 },
];

const PLACEHOLDER_NAME = "過去データ（インポート）";
const MENU_NAME = "過去データ（一括インポート）";

async function main() {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error("使い方: npx tsx prisma/import-sales.ts <変換済みJSONのパス>");
    process.exit(1);
  }
  const rows: Row[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  for (const cfg of STORE_CONFIGS) {
    const store = await prisma.store.findUniqueOrThrow({ where: { slug: cfg.slug } });

    let placeholder = await prisma.customer.findFirst({
      where: { storeId: store.id, name: PLACEHOLDER_NAME },
    });
    if (!placeholder) {
      placeholder = await prisma.customer.create({
        data: { storeId: store.id, name: PLACEHOLDER_NAME, active: false },
      });
    }

    const staff = await prisma.staff.findFirstOrThrow({
      where: { storeId: store.id, active: true, role: { not: "OWNER" } },
      orderBy: { createdAt: "asc" },
    });

    const existing = await prisma.visit.findMany({
      where: { storeId: store.id, customerId: placeholder.id },
      select: { date: true, paymentMethod: true },
    });
    const existingKeys = new Set(existing.map((v) => `${v.date.toISOString()}_${v.paymentMethod}`));

    const toCreate: {
      storeId: string;
      staffId: string;
      customerId: string;
      date: Date;
      menuName: string;
      amount: number;
      pointAmount: number | null;
      productName: string | null;
      productAmount: number | null;
      paymentMethod: string;
    }[] = [];
    let total = 0;

    for (const [dateStr, ...vals] of rows) {
      const [y, m, d] = dateStr.split("/").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

      const techCash = vals[cfg.offset] ?? 0;
      const techCredit = vals[cfg.offset + 1] ?? 0;
      const point = vals[cfg.offset + 2] ?? 0;
      const productCash = vals[cfg.offset + 3] ?? 0;
      const productCredit = vals[cfg.offset + 4] ?? 0;

      const cashKey = `${date.toISOString()}_cash`;
      if ((techCash > 0 || point > 0 || productCash > 0) && !existingKeys.has(cashKey)) {
        toCreate.push({
          storeId: store.id,
          staffId: staff.id,
          customerId: placeholder.id,
          date,
          menuName: MENU_NAME,
          amount: techCash,
          pointAmount: point > 0 ? point : null,
          productName: productCash > 0 ? "店販（インポート）" : null,
          productAmount: productCash > 0 ? productCash : null,
          paymentMethod: "cash",
        });
        total += techCash + point + productCash;
      }

      const creditKey = `${date.toISOString()}_credit`;
      if ((techCredit > 0 || productCredit > 0) && !existingKeys.has(creditKey)) {
        toCreate.push({
          storeId: store.id,
          staffId: staff.id,
          customerId: placeholder.id,
          date,
          menuName: MENU_NAME,
          amount: techCredit,
          pointAmount: null,
          productName: productCredit > 0 ? "店販（インポート）" : null,
          productAmount: productCredit > 0 ? productCredit : null,
          paymentMethod: "credit",
        });
        total += techCredit + productCredit;
      }
    }

    if (toCreate.length > 0) {
      await prisma.visit.createMany({ data: toCreate });
    }
    console.log(`${store.name}: ${toCreate.length}件登録（合計 ¥${total.toLocaleString()}）`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
