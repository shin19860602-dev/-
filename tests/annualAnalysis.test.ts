import assert from "node:assert/strict";
import test from "node:test";
import { analyzeYear } from "../lib/annualAnalysis";

const visit = (menuName: string) => ({ date: new Date("2025-01-31T15:00:00Z"), menuName, customerId: "test", amount: 1000, productAmount: 200, pointAmount: 100 });
test("日本時間の月とポイント込み売上、来店と実人数を区別する", () => {
  const result = analyzeYear([visit("カット"), visit("カット")]);
  assert.equal(result.months[0].sales, 0);
  assert.equal(result.months[1].sales, 2600);
  assert.equal(result.count, 2);
  assert.equal(result.customers, 1);
  assert.equal(result.menus.get("カット")?.sales, 2200);
});
test("一括登録は売上のみ加算し人数・メニューに数えない", () => {
  const result = analyzeYear([visit("過去データ（一括インポート）"), visit("カット")]);
  assert.equal(result.imported, true);
  assert.equal(result.months[1].imported, true);
  assert.equal(result.months[1].sales, 2600);
  assert.equal(result.count, 1);
  assert.equal(result.menus.size, 1);
  assert.equal(analyzeYear([]).count, 0);
});
