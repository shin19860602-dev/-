import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { aggregateVintageSales, canExportVintage, vintageReportMonth, type VintageExportSale } from "../lib/vintageSalesReport";
import { vintageSalesWorkbook } from "../lib/vintageSalesWorkbook";

const month = vintageReportMonth("2026-10")!;
const sale = (values: Partial<VintageExportSale> = {}): VintageExportSale => ({ date: new Date("2026-10-01T02:00:00Z"), amount: 3500, paymentMethod: "cash", ...values });

test("過去の年・月を選択でき、未指定の今月はサーバーのTZに依存しない", () => {
  assert.equal(vintageReportMonth("2024-02")?.days, 29);
  assert.equal(vintageReportMonth("2025-02")?.days, 28);
  assert.equal(vintageReportMonth("2026-04")?.days, 30);
  assert.equal(vintageReportMonth(undefined, new Date("2026-09-30T15:00:00Z"))?.value, "2026-10");
  assert.equal(vintageReportMonth(undefined, new Date("2026-09-30T14:59:59Z"))?.value, "2026-09");
});

test("不正な年月や複数指定を今月・全期間に広げない", () => {
  for (const value of ["", "2026-13", "2026-1", "2026-02-01", ["2026-10"], ["2026-10", "2026-09"], 202610]) assert.equal(vintageReportMonth(value), null);
});

test("オーナーと古着の自店舗スタッフのみ出力できる", () => {
  const store = { id: "vintage-a", kind: "VINTAGE" };
  assert.equal(canExportVintage({ role: "OWNER", storeId: null, active: true }, store), true);
  for (const role of ["MANAGER", "STAFF"]) assert.equal(canExportVintage({ role, storeId: store.id, active: true }, store), true);
  for (const actor of [
    { role: "STAFF", storeId: "salon", active: true }, { role: "STAFF", storeId: "vintage-b", active: true },
    { role: "STAFF", storeId: null, active: true }, { role: "OWNER", storeId: null, active: false },
    { role: "INVALID", storeId: store.id, active: true },
  ]) assert.equal(canExportVintage(actor, store), false);
  assert.equal(canExportVintage({ role: "OWNER", storeId: null, active: true }, null), false);
  assert.equal(canExportVintage({ role: "OWNER", storeId: null, active: true }, { id: "salon", kind: "SALON" }), false);
});

test("日別の現金とクレジットを分け、支払方法未登録や返金も合計から落とさない", () => {
  const rows = aggregateVintageSales(month, [sale(), sale({ amount: 7000, paymentMethod: "credit" }), sale({ amount: -500 }), sale({ amount: 1000, paymentMethod: null })]);
  assert.equal(rows.length, 31);
  assert.deepEqual(rows[0], { day: 1, cash: 3000, credit: 7000, unknown: 1000 });
  assert.deepEqual(rows[1], { day: 2, cash: 0, credit: 0, unknown: 0 });
  assert.equal(rows.reduce((sum, row) => sum + row.cash + row.credit + row.unknown, 0), 11000);
});

test("月初と月末は日本時間で抽出し、隣接する月を混ぜない", () => {
  const rows = aggregateVintageSales(month, [sale({ date: new Date("2026-09-30T14:59:59Z") }), sale({ date: month.start }), sale({ date: new Date("2026-10-31T14:59:59Z"), paymentMethod: "credit" }), sale({ date: month.end })]);
  assert.equal(rows[0].cash, 3500);
  assert.equal(rows[30].credit, 3500);
  assert.equal(rows.reduce((sum, row) => sum + row.cash + row.credit, 0), 7000);
});

test("Excelを開き直し、3列・全日付・0円・月合計SUMと金額を照合する", async () => {
  const workbook = new ExcelJS.Workbook();
  const bytes = await vintageSalesWorkbook(month, "KUJEKUJE", [sale(), sale({ paymentMethod: "credit", amount: 9000, date: new Date("2026-10-31T03:00:00Z") })]);
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.deepEqual((sheet.getRow(4).values as unknown[]).slice(1), ["日付", "現金売上", "クレジット売上"]);
  assert.equal(sheet.getCell("A5").value, "1日");
  assert.equal(sheet.getCell("A35").value, "31日");
  assert.equal(sheet.getCell("B5").value, 3500);
  assert.equal(sheet.getCell("B6").value, 0);
  assert.equal(sheet.getCell("C35").value, 9000);
  assert.deepEqual(sheet.getCell("B36").value, { formula: "SUM(B5:B35)", result: 3500 });
  assert.deepEqual(sheet.getCell("C36").value, { formula: "SUM(C5:C35)", result: 9000 });
  assert.equal(sheet.pageSetup.printArea, "A1:C36");
  assert.equal(workbook.worksheets.length, 1);
});

test("2月の空売上と支払方法不明の別シートを正しく出力する", async () => {
  const feb = vintageReportMonth("2024-02")!;
  const empty = new ExcelJS.Workbook();
  await empty.xlsx.load((await vintageSalesWorkbook(feb, "KUJEKUJE", [])).buffer as ArrayBuffer);
  assert.equal(empty.worksheets[0].getCell("A33").value, "29日");
  assert.deepEqual(empty.worksheets[0].getCell("B34").value, { formula: "SUM(B5:B33)" });
  const unknown = new ExcelJS.Workbook();
  await unknown.xlsx.load((await vintageSalesWorkbook(month, "=架空店舗", [sale({ paymentMethod: null })])).buffer as ArrayBuffer);
  assert.equal(unknown.worksheets[0].getCell("B5").value, 0);
  assert.equal(unknown.worksheets[0].getCell("A2").type, ExcelJS.ValueType.String);
  assert.equal(unknown.worksheets[1].getCell("B2").value, 3500);
});
