import assert from "node:assert/strict";
import test from "node:test";
import type { Customer } from "@prisma/client";
import { mergedCustomerData } from "../lib/mergeCustomer";

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "target", storeId: "store-a", name: "山田花子", kana: null, gender: null,
  birthday: null, phone: null, postalCode: null, address: null, tier: "一般会員",
  memberSince: null, allergyNote: null, primaryStaffId: null, active: true,
  createdAt: new Date("2026-01-01"), ...overrides,
});

test("空欄を補完し、異なる基本情報がある場合は残すカルテを優先する", () => {
  const target = customer({ phone: "09011112222", gender: "female" });
  const source = customer({ id: "source", phone: "09099998888", gender: "other", kana: "やまだはなこ", address: "大阪", primaryStaffId: "staff-a" });
  const merged = mergedCustomerData(target, source);
  assert.equal(merged.phone, target.phone);
  assert.equal(merged.gender, target.gender);
  assert.equal(merged.kana, source.kana);
  assert.equal(merged.address, source.address);
  assert.equal(merged.primaryStaffId, source.primaryStaffId);
  assert.equal(source.phone, "09099998888");
});

test("アレルギー・注意事項は両方を保持し、同一の記載は重複させない", () => {
  assert.equal(mergedCustomerData(customer({ allergyNote: "ジアミン注意" }), customer({ allergyNote: "ラテックス注意" })).allergyNote, "ジアミン注意\nラテックス注意");
  assert.equal(mergedCustomerData(customer({ allergyNote: "ジアミン注意" }), customer({ allergyNote: "ジアミン注意" })).allergyNote, "ジアミン注意");
  assert.equal(mergedCustomerData(customer(), customer()).allergyNote, null);
});

test("早い会員登録日とプレミアム会員を引き継ぐ", () => {
  const merged = mergedCustomerData(customer({ memberSince: new Date("2026-10-01") }), customer({ memberSince: new Date("2024-01-01"), tier: "プレミアム会員" }));
  assert.equal(merged.memberSince?.toISOString(), "2024-01-01T00:00:00.000Z");
  assert.equal(merged.tier, "プレミアム会員");
  assert.equal(mergedCustomerData(customer({ tier: "プレミアム会員" }), customer()).tier, "プレミアム会員");
});
