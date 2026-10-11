import assert from "node:assert/strict";
import test from "node:test";
import { buildKarteWhere } from "../lib/karteFilters";

test("性別・カテゴリ・来店期間は同一来店と店舗に絞り込む", () => {
  const { where, error } = buildKarteWhere({ gender: "female", category: "カラー", from: "2026-10-01", to: "2026-10-11" }, "store-a");
  assert.equal(error, undefined);
  assert.deepEqual(where, {
    active: true, storeId: "store-a", gender: "female",
    visits: { some: { storeId: "store-a", category: "カラー", date: {
      gte: new Date("2026-09-30T15:00:00Z"), lt: new Date("2026-10-11T15:00:00Z"),
    } } },
  });
});

test("単日検索は日本時間の翌日0時まで、片側のみも検索できる", () => {
  const sameDay = buildKarteWhere({ from: "2026-10-11", to: "2026-10-11" }).where.visits?.some?.date;
  assert.deepEqual(sameDay, { gte: new Date("2026-10-10T15:00:00Z"), lt: new Date("2026-10-11T15:00:00Z") });
  assert.deepEqual(buildKarteWhere({ to: "2026-10-11" }).where.visits?.some?.date, { gte: undefined, lt: new Date("2026-10-11T15:00:00Z") });
  assert.deepEqual(buildKarteWhere({ from: "2026-10-11" }).where.visits?.some?.date, { gte: new Date("2026-10-10T15:00:00Z"), lt: undefined });
});

test("不正日付と逆転期間を拒否し、うるう日は受け付ける", () => {
  for (const from of ["2026-02-29", "2026-13-01", "invalid"]) assert.ok(buildKarteWhere({ from }).error);
  assert.ok(buildKarteWhere({ from: "2026-10-12", to: "2026-10-11" }).error);
  assert.equal(buildKarteWhere({ from: "2028-02-29" }).error, undefined);
});

test("未登録性別・名前の部分一致・条件なしで未来店客も対象にする", () => {
  assert.deepEqual(buildKarteWhere({ gender: "unknown", q: "  山田  " }, "store-a").where, {
    active: true, storeId: "store-a", gender: null,
    OR: [{ name: { contains: "山田", mode: "insensitive" } }, { kana: { contains: "山田", mode: "insensitive" } }],
  });
  assert.equal(buildKarteWhere({}, "store-a").where.visits, undefined);
});


test("未分類はカテゴリ未登録と空文字の来店を、指定店舗・期間で検索する", () => {
  const { where, error } = buildKarteWhere({ category: "uncategorized", gender: "male", from: "2026-10-11", to: "2026-10-11" }, "store-a");
  assert.equal(error, undefined);
  assert.equal(where.gender, "male");
  assert.deepEqual(where.visits?.some, {
    storeId: "store-a",
    OR: [{ category: null }, { category: "" }],
    date: { gte: new Date("2026-10-10T15:00:00Z"), lt: new Date("2026-10-11T15:00:00Z") },
  });
});
