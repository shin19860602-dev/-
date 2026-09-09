import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 決定論的な疑似乱数（毎回同じデータを再現するため）
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260908);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));

async function main() {
  console.log("シードデータを投入します…");

  await prisma.visit.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.store.deleteMany();

  const storeA = await prisma.store.create({
    data: { slug: "chura-re", name: "hairsalon ちゅら：re", kind: "SALON", colorKey: "a" },
  });
  const storeB = await prisma.store.create({
    data: { slug: "shell-valley", name: "hairsalon shell valley", kind: "SALON", colorKey: "b" },
  });
  const storeC = await prisma.store.create({
    data: { slug: "lien", name: "private salon Lien", kind: "LASH", colorKey: "c" },
  });

  const ownerPasswordHash = await bcrypt.hash("1005", 10);
  const owner = await prisma.staff.create({
    data: {
      storeId: null,
      name: "shinya",
      role: "OWNER",
      title: "オーナー",
      email: "shinya",
      passwordHash: ownerPasswordHash,
    },
  });

  const pin = async (p: string) => bcrypt.hash(p, 10);

  const kaitani = await prisma.staff.create({
    data: { storeId: storeA.id, name: "貝谷 真弥", role: "MANAGER", title: "店長", pinHash: await pin("1005"), hireDate: new Date("2021-04-01") },
  });
  const nagae = await prisma.staff.create({
    data: { storeId: storeB.id, name: "長永 美紀", role: "MANAGER", title: "店長", pinHash: await pin("0901"), hireDate: new Date("2019-03-01") },
  });
  const yoshida = await prisma.staff.create({
    data: { storeId: storeC.id, name: "吉田 麻衣", role: "MANAGER", title: "店長", pinHash: await pin("0910"), hireDate: new Date("2022-05-01") },
  });

  const staffByStore: Record<string, { id: string }[]> = {
    [storeA.id]: [kaitani],
    [storeB.id]: [nagae],
    [storeC.id]: [yoshida],
  };

  const sakura = await prisma.customer.create({
    data: {
      storeId: storeA.id, name: "中村 さくら", kana: "なかむら さくら", gender: "female",
      birthday: new Date("1983-04-12"), phone: "090-1234-4821", tier: "プレミアム会員",
      memberSince: new Date("2023-06-15"), allergyNote: "ジアミン系カラー剤にかぶれの既往あり。施術前に必ずパッチテストを実施してください。ノンジアミンカラー剤を使用中。",
      primaryStaffId: kaitani.id,
    },
  });
  const megumi = await prisma.customer.create({
    data: { storeId: storeA.id, name: "松本 恵", kana: "まつもと めぐみ", gender: "female", tier: "一般会員", memberSince: new Date("2024-01-10"), primaryStaffId: kaitani.id },
  });
  const kenta = await prisma.customer.create({
    data: { storeId: storeA.id, name: "佐々木 健太", kana: "ささき けんた", gender: "male", tier: "一般会員", memberSince: new Date("2024-09-02"), primaryStaffId: kaitani.id },
  });
  const reina = await prisma.customer.create({
    data: { storeId: storeB.id, name: "木村 玲奈", kana: "きむら れいな", gender: "female", tier: "一般会員", memberSince: new Date("2024-05-20"), primaryStaffId: nagae.id },
  });
  const mayumi = await prisma.customer.create({
    data: { storeId: storeB.id, name: "岡田 真由美", kana: "おかだ まゆみ", gender: "female", tier: "プレミアム会員", memberSince: new Date("2022-11-02"), primaryStaffId: nagae.id },
  });
  const hikari = await prisma.customer.create({
    data: { storeId: storeC.id, name: "石井 ひかり", kana: "いしい ひかり", gender: "female", tier: "一般会員", memberSince: new Date("2024-08-01"), primaryStaffId: yoshida.id },
  });
  const yoko = await prisma.customer.create({
    data: { storeId: storeC.id, name: "山口 陽子", kana: "やまぐち ようこ", gender: "female", tier: "一般会員", memberSince: new Date("2023-12-12"), primaryStaffId: yoshida.id },
  });

  const customersByStore: Record<string, { id: string }[]> = {
    [storeA.id]: [sakura, megumi, kenta],
    [storeB.id]: [reina, mayumi],
    [storeC.id]: [hikari, yoko],
  };

  // 中村さくら様のカルテ（施術履歴・薬剤詳細つき）
  await prisma.visit.createMany({
    data: [
      { storeId: storeA.id, staffId: kaitani.id, customerId: sakura.id, date: new Date("2026-04-18T11:00:00"), menuName: "カット＋カラー", amount: 17000, memo: "根本リタッチ＋艶出しトリートメント" },
      { storeId: storeA.id, staffId: kaitani.id, customerId: sakura.id, date: new Date("2026-06-03T13:30:00"), menuName: "デジタルパーマ＋カット", amount: 22000, memo: "", chemicalDetail: "薬剤：ミルボン デジパー1剤・2剤／ロッド：9mm／放置時間：1剤12分・2剤15分" },
      { storeId: storeA.id, staffId: kaitani.id, customerId: sakura.id, date: new Date("2026-07-22T10:30:00"), menuName: "カット", amount: 8000, memo: "レイヤーを軽めに調整。次回はカラーのタッチアップを提案予定。" },
      { storeId: storeA.id, staffId: kaitani.id, customerId: sakura.id, date: new Date("2026-09-08T14:20:00"), menuName: "カット＋カラー（ノンジアミン）", amount: 18500, memo: "毛先の乾燥が気になるとのご相談。洗い流さないトリートメントをご提案・ご購入。", chemicalDetail: "薬剤：ルベル ノンジアミンカラー 6NB＋7WB" },
    ],
  });

  // 直近の売上一覧
  await prisma.visit.createMany({
    data: [
      { storeId: storeA.id, staffId: kaitani.id, customerId: sakura.id, date: new Date("2026-09-06T15:00:00"), menuName: "ヘッドスパ", amount: 5500 },
      { storeId: storeB.id, staffId: nagae.id, customerId: reina.id, date: new Date("2026-09-06T11:20:00"), menuName: "カラー＋トリートメント", amount: 15600 },
      { storeId: storeC.id, staffId: yoshida.id, customerId: yoko.id, date: new Date("2026-09-07T16:10:00"), menuName: "まつ毛パーマ＋オフ", amount: 7200 },
      { storeId: storeA.id, staffId: kaitani.id, customerId: megumi.id, date: new Date("2026-09-07T09:40:00"), menuName: "カット", amount: 8000 },
      { storeId: storeB.id, staffId: nagae.id, customerId: mayumi.id, date: new Date("2026-09-08T11:40:00"), menuName: "パーマ＋トリートメント", amount: 22400 },
      { storeId: storeC.id, staffId: yoshida.id, customerId: hikari.id, date: new Date("2026-09-08T13:05:00"), menuName: "まつ毛エクステ 120本", amount: 9800 },
    ],
  });

  // 去年の同じ日（本日との日次比較用）
  await prisma.visit.createMany({
    data: [
      { storeId: storeA.id, staffId: kaitani.id, customerId: sakura.id, date: new Date("2025-09-08T10:20:00"), menuName: "カット＋カラー", amount: 16500, productName: "シャンプー", productAmount: 2800 },
      { storeId: storeA.id, staffId: kaitani.id, customerId: kenta.id, date: new Date("2025-09-08T13:00:00"), menuName: "カット", amount: 6800 },
      { storeId: storeB.id, staffId: nagae.id, customerId: reina.id, date: new Date("2025-09-08T11:10:00"), menuName: "カット＋カラー", amount: 15200, productName: "トリートメント剤", productAmount: 4200 },
      { storeId: storeC.id, staffId: yoshida.id, customerId: yoko.id, date: new Date("2025-09-08T14:30:00"), menuName: "まつ毛エクステ 100本", amount: 8400 },
    ],
  });

  // 過去18ヶ月分のダミー売上（集計グラフ・前年同月比の比較用）
  const menus: Record<string, { name: string; range: [number, number] }[]> = {
    SALON: [
      { name: "カット", range: [6000, 9000] },
      { name: "カット＋カラー", range: [14000, 20000] },
      { name: "パーマ＋カット", range: [18000, 24000] },
      { name: "トリートメント", range: [4000, 8000] },
      { name: "ヘッドスパ", range: [4000, 6000] },
    ],
    LASH: [
      { name: "まつ毛エクステ 100本", range: [8000, 9500] },
      { name: "まつ毛エクステ 120本", range: [9500, 11000] },
      { name: "まつ毛パーマ＋オフ", range: [6500, 8000] },
      { name: "まつ毛オフのみ", range: [2000, 3000] },
    ],
  };
  const products: Record<string, { name: string; range: [number, number] }[]> = {
    SALON: [
      { name: "シャンプー", range: [2200, 3800] },
      { name: "トリートメント剤", range: [3200, 5500] },
      { name: "ヘアオイル", range: [2800, 4200] },
      { name: "スタイリング剤", range: [1800, 3000] },
    ],
    LASH: [
      { name: "まつ毛美容液", range: [3500, 5000] },
      { name: "洗顔料", range: [2000, 3200] },
      { name: "コーティング剤", range: [2500, 4000] },
    ],
  };

  const stores = [storeA, storeB, storeC];

  // メニュー一覧（施術・店販）。売上登録画面のプルダウンに使う。
  const midPrice = (range: [number, number]) => Math.round((range[0] + range[1]) / 2 / 100) * 100;
  for (const store of stores) {
    await prisma.menuItem.createMany({
      data: [
        ...menus[store.kind].map((m) => ({ storeId: store.id, type: "service", name: m.name, price: midPrice(m.range) })),
        ...products[store.kind].map((p) => ({ storeId: store.id, type: "product", name: p.name, price: midPrice(p.range) })),
      ],
    });
  }

  const now = new Date("2026-09-08T00:00:00");
  const HISTORY_MONTHS = 17; // 今月＋過去17ヶ月＝18ヶ月分（前年同月比を出すため）
  for (let monthsAgo = HISTORY_MONTHS; monthsAgo >= 0; monthsAgo--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const maxDay = monthsAgo === 0 ? now.getDate() : 27; // 当月は「今日」より先の日付を作らない
    const growth = 1 - monthsAgo * 0.012; // ゆるやかな右肩上がり（前年同月比較で成長が見えるように）
    for (const store of stores) {
      const baseCount = monthsAgo === 0 ? randInt(6, 10) : randInt(16, 24);
      const visitCount = Math.max(4, Math.round(baseCount * growth));
      const menuPool = menus[store.kind];
      const productPool = products[store.kind];
      const staffPool = staffByStore[store.id];
      const custPool = customersByStore[store.id];
      const rows = [];
      for (let i = 0; i < visitCount; i++) {
        const day = randInt(1, maxDay);
        const hour = randInt(10, 19);
        const menu = pick(menuPool);
        const withProduct = rand() < 0.35;
        const product = withProduct ? pick(productPool) : null;
        rows.push({
          storeId: store.id,
          staffId: pick(staffPool).id,
          customerId: pick(custPool).id,
          date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day, hour, randInt(0, 5) * 10),
          menuName: menu.name,
          amount: randInt(menu.range[0], menu.range[1]),
          productName: product?.name,
          productAmount: product ? randInt(product.range[0], product.range[1]) : undefined,
        });
      }
      await prisma.visit.createMany({ data: rows });
    }
  }

  console.log("完了しました。");
  console.log("オーナーログイン: shinya / 1005");
  console.log("スタッフPIN: 貝谷真弥(ちゅら：re店長)=1005, 長永美紀(shell valley店長)=0901, 吉田麻衣(Lien店長)=0910");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
