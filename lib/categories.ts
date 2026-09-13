// 集計・分析のカテゴリ別売上構成比に使う分類。店舗の業態ごとに選択肢が異なる（店販は別項目で金額を集計するためここには含めない）。
export const SALON_CATEGORIES = ["カット", "カラー", "パーマ", "縮毛矯正", "トリートメント", "その他"];
export const LASH_CATEGORIES = [
  "エクステ",
  "つけ放題",
  "リペア",
  "LEDエクステ",
  "LEDつけ放題",
  "LEDリペア",
  "下まつ毛エクステ",
  "まつ毛パーマ",
  "下まつ毛パーマ",
  "ヘアカラー",
  "トリートメント",
];

export function categoriesForStoreKind(kind: string): string[] {
  return kind === "LASH" ? LASH_CATEGORIES : SALON_CATEGORIES;
}
