import test from "node:test";
import assert from "node:assert/strict";
import { paymentTotals } from "../lib/paymentTotals";

test("現金・カードは技術と店販を合算し、ポイントを含めない", () => {
  const rows = [
    { amount: 16000, productAmount: 2000, pointAmount: 800, paymentMethod: "cash" },
    { amount: 5000, productAmount: 3000, pointAmount: 100, paymentMethod: "credit" },
    { amount: 400, productAmount: null, pointAmount: 0, paymentMethod: null },
  ];
  assert.deepEqual(paymentTotals(rows), { cash: 18000, credit: 8000, unknown: 400 });
  assert.deepEqual(paymentTotals([]), { cash: 0, credit: 0, unknown: 0 });
});
