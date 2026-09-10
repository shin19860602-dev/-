// HotPepper Beautyのクーポンをメニュー登録として一括追加するスクリプト。
// 通常メニューと見分けられるよう、名前の末尾に「（クーポン）」を付ける。
// 使い方: npx tsx prisma/import-coupons.ts
import { prisma } from "../lib/prisma";

const COUPONS: { slug: string; name: string; price: number }[] = [
  // private salon Lien
  { slug: "lien", name: "★大人気★《オフ込み》フラットラッシュつけ放題【コーティング付】（クーポン）", price: 6300 },
  { slug: "lien", name: "★大人気★《オフ込み》フラットラッシュ120本【コーティング付】（クーポン）", price: 5800 },
  { slug: "lien", name: "☆LEDエクステ☆《オフ込》フラットラッシュつけ放題【コーティング付】（クーポン）", price: 7400 },
  { slug: "lien", name: "☆LEDエクステ☆《オフ込み》フラットラッシュ120本【コーティング付】（クーポン）", price: 6900 },
  { slug: "lien", name: "【ナチュラルな濃さへ】パリエク《パリジェンヌ×エクステ》（クーポン）", price: 10400 },
  { slug: "lien", name: "★カールをつけて可愛い目元に★マスカラパーマ（クーポン）", price: 6000 },
  { slug: "lien", name: "★カールをつけて可愛い目元に★まつげパーマ（クーポン）", price: 5200 },
  { slug: "lien", name: "★次世代パーマ★パリジェンヌラッシュリフト（クーポン）", price: 5200 },
  { slug: "lien", name: "人気メニュー！！《オフ込み》ダブルフラットラッシュ80束（クーポン）", price: 6500 },
  { slug: "lien", name: "人気メニュー！《オフ込み》ダブルフラットラッシュ100束（クーポン）", price: 7000 },
  { slug: "lien", name: "人気メニュー！《オフ込み》ダブルフラットラッシュ120束（クーポン）", price: 7500 },
  { slug: "lien", name: "人気メニュー！《オフ込み》ダブルフラットラッシュ140束（クーポン）", price: 8000 },
  { slug: "lien", name: "人気メニュー！《オフ込み》ダブルフラットラッシュ160束（クーポン）", price: 8500 },
  { slug: "lien", name: "人気メニュー！《オフ込み》ダブルフラットラッシュ180束（クーポン）", price: 9000 },
  { slug: "lien", name: "人気メニュー！《オフ込み》ダブルフラットラッシュ200束（クーポン）", price: 9500 },

  // hairsalon shell valley
  { slug: "shell-valley", name: "【人気No.1】カット＋つるりんちょ。髪質改善トリートメント配合カラー（クーポン）", price: 11550 },
  { slug: "shell-valley", name: "手触りツヤ感UP☆髪質改善MSOカラー+選べるSP・TR（クーポン）", price: 8750 },
  { slug: "shell-valley", name: "カット＋髪質改善プレミアム縮毛矯正（クーポン）", price: 20500 },
  { slug: "shell-valley", name: "カット+髪質改善 微還元ストレート（クーポン）", price: 18000 },
  { slug: "shell-valley", name: "【もっと綺麗な艶と手触り】髪質改善縮毛矯正＆inMAS-Oカラー+カット（クーポン）", price: 24000 },
  { slug: "shell-valley", name: "カット＋つるりんちょ。SYSTEMライト（2ステップ）（クーポン）", price: 6500 },
  { slug: "shell-valley", name: "カット＋つるりんちょ。SYSTEMトリートメント・レギュラー（4ステップ）（クーポン）", price: 7900 },
  { slug: "shell-valley", name: "カット＋つるりんちょ。SYSTEMプレミアム（6ステップ）（クーポン）", price: 10800 },
  { slug: "shell-valley", name: "カット＋髪質改善カラー＋つるりんちょ。SYSTEMライト（2ステップ）（クーポン）", price: 12500 },
  { slug: "shell-valley", name: "髪質改善カラー＋つるりんちょ。SYSTEMトリートメント・ライト（2ステップ）（クーポン）", price: 9300 },
  { slug: "shell-valley", name: "カット＋パーマ＋つるりんちょ。SYSTEMライト（2ステップ）（クーポン）", price: 12500 },
  { slug: "shell-valley", name: "カット＋リタッチカラー（クーポン）", price: 8800 },
  { slug: "shell-valley", name: "【気になる前髪に】前髪カット＆前髪縮毛矯正＆クイックトリートメント（クーポン）", price: 7350 },
  { slug: "shell-valley", name: "カット＋髪質改善カラー＋微還元ストレート（クーポン）", price: 22000 },
  { slug: "shell-valley", name: "カット＋パーマ＋トリートメント（クーポン）", price: 14800 },
  { slug: "shell-valley", name: "カット＋5種類の香りから選べるクリームズヘッドスパ（クーポン）", price: 6200 },
  { slug: "shell-valley", name: "【髪質改善ストレート☆ほんのりくせとりツヤ髪へ】ST＆TR全部おまかせコース（クーポン）", price: 15900 },
  { slug: "shell-valley", name: "カット＋髪質改善MAS-Oトリートメント（クーポン）", price: 10450 },
  { slug: "shell-valley", name: "カット＋微還元ストレート＋トリートメント（クーポン）", price: 18800 },
  { slug: "shell-valley", name: "【最強うる艶カラー】ケアブリーチ+髪質改善カラー+MASOトリートメント（クーポン）", price: 20000 },
  { slug: "shell-valley", name: "カット+カラー+ブリーチ+トリートメント（クーポン）", price: 24000 },
  { slug: "shell-valley", name: "【2回目以降の方限定】リタッチカラー＋カット＋ヘッドスパ（クーポン）", price: 9900 },
  { slug: "shell-valley", name: "カット＋5種類の香りから選べるクリームズヘッドスパ（併用不可）（クーポン）", price: 6000 },
  { slug: "shell-valley", name: "【2回目以降のご来店の方はこちら】根本2cmまでのリタッチカラー（クーポン）", price: 4550 },

  // hairsalon ちゅら：re
  { slug: "chura-re", name: "手触りツヤ感UP☆髪質改善配合MSOカラー&カット&選べるSP・TR（再来・クーポン）", price: 9600 },
  { slug: "chura-re", name: "【髪質改善カラーカット】悩んだらこちら！ワンカラーのお任せフルコース（再来・クーポン）", price: 10800 },
  { slug: "chura-re", name: "手触りツヤ感UP☆髪質改善MSOカラー+選べるSP・TR（再来・クーポン）", price: 8200 },
  { slug: "chura-re", name: "【髪質改善カラー】悩んだらこちら！ワンカラーのお任せフルコース（再来・クーポン）", price: 8800 },
  { slug: "chura-re", name: "ツヤ感up☆髪質改善SK酸性縮毛矯正&カット&選べるSP&TR（再来・クーポン）", price: 16800 },
  { slug: "chura-re", name: "もっと綺麗な艶と手触り☆酸性縮毛矯正＆MSOカラー+カット(選べるTR付)（再来・クーポン）", price: 21800 },
  { slug: "chura-re", name: "艶と癖のおさまりも良くする！髪質改善☆WKストレート&カット（再来・クーポン）", price: 15500 },
  { slug: "chura-re", name: "艶と癖のおさまりも良くする！髪質改善☆WKストレート&カット＆カラー（再来・クーポン）", price: 20800 },
  { slug: "chura-re", name: "ふわッとウエーブスタイル☆カット+髪質改善配合パーマ（再来・クーポン）", price: 9800 },
  { slug: "chura-re", name: "【髪質改善配合】悩んだらこちら☆カット+髪質改善配合デジタルパーマ（再来・クーポン）", price: 11800 },
  { slug: "chura-re", name: "根元2cmまでのリタッチカラー（再来・クーポン）", price: 3800 },
  { slug: "chura-re", name: "【髪質改善トリートメント】貴女の髪質に合わせた贅沢トリートメントコース（再来・クーポン）", price: 9900 },
  { slug: "chura-re", name: "髪質改善配合MSOカラー&カット&選べるSP・TR（全員・クーポン）", price: 10500 },
  { slug: "chura-re", name: "手触りツヤ感UP！髪質改善酸性縮毛矯正&カット&クイックトリートメント（全員・クーポン）", price: 18800 },
  { slug: "chura-re", name: "艶と癖のおさまりも良くする！髪質改善☆WKストレート&カット（全員・クーポン）", price: 16500 },
  { slug: "chura-re", name: "もっと綺麗な艶と手触り☆髪質改善縮毛矯正＆MSOカラー+カット(選べるTR付)（全員・クーポン）", price: 23500 },
  { slug: "chura-re", name: "艶と癖のおさまりも良くする！髪質改善☆WKストレート&カット＆カラー（全員・クーポン）", price: 22800 },
  { slug: "chura-re", name: "ボリュームダウンしてサラツヤ髪に☆髪質改善☆トリートメント＋カット（全員・クーポン）", price: 11500 },
  { slug: "chura-re", name: "ふわッとウエーブスタイル☆カット+髪質改善配合パーマ（全員・クーポン）", price: 10300 },
];

async function main() {
  const stores = await prisma.store.findMany({ where: { slug: { in: ["lien", "shell-valley", "chura-re"] } } });
  const storeIdBySlug = new Map(stores.map((s) => [s.slug, s.id]));

  const existing = await prisma.menuItem.findMany({
    where: { storeId: { in: [...storeIdBySlug.values()] } },
    select: { storeId: true, name: true },
  });
  const existingKeys = new Set(existing.map((m) => `${m.storeId}_${m.name}`));

  const toCreate = COUPONS.filter((c) => {
    const storeId = storeIdBySlug.get(c.slug);
    return storeId && !existingKeys.has(`${storeId}_${c.name}`);
  }).map((c) => ({
    storeId: storeIdBySlug.get(c.slug)!,
    type: "service",
    name: c.name,
    price: c.price,
  }));

  if (toCreate.length > 0) {
    await prisma.menuItem.createMany({ data: toCreate });
  }

  const lienCount = toCreate.filter((c) => c.storeId === storeIdBySlug.get("lien")).length;
  const svCount = toCreate.filter((c) => c.storeId === storeIdBySlug.get("shell-valley")).length;
  const crCount = toCreate.filter((c) => c.storeId === storeIdBySlug.get("chura-re")).length;
  console.log(`Lien: ${lienCount}件登録、Shell Valley: ${svCount}件登録、ちゅら：re: ${crCount}件登録`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
