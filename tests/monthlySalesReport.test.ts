import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { aggregateMonthlySales, monthlyExportScope, parseSalesMonth, type ExportVisit } from "../lib/monthlySalesReport";
import { monthlySalesWorkbook } from "../lib/monthlySalesWorkbook";

const month = parseSalesMonth("2026-10")!;
const visit = (values: Partial<ExportVisit> = {}): ExportVisit => ({ date: new Date("2026-10-01T01:00:00Z"), amount: 16000, productAmount: 2200, pointAmount: 800, paymentMethod: "cash", ...values });

test("月の日数・うるう年・日本時間の月境界を正しく処理する", () => {
  assert.equal(month.days, 31);
  assert.equal(parseSalesMonth("2026-04")!.days, 30);
  assert.equal(parseSalesMonth("2026-02")!.days, 28);
  assert.equal(parseSalesMonth("2028-02")!.days, 29);
  assert.equal(month.start.toISOString(), "2026-09-30T15:00:00.000Z");
  for (const value of ["", "2026-1", "2026-00", "2026-13", "../2026-10", "1999-12"]) assert.equal(parseSalesMonth(value), null);
});

test("技術・商品・ポイントを二重計上せず経費を日ごとに合計する", () => {
  const rows = aggregateMonthlySales(month, [visit(), visit({ paymentMethod: "credit", amount: 5000, pointAmount: 0, productAmount: 1000 })], [{ date: visit().date, amount: 300 }, { date: visit().date, amount: 700 }]);
  assert.deepEqual(rows[0], { day: 1, cash: 16000, credit: 5000, points: 800, productCash: 2200, productCredit: 1000, expenses: 1000, expenseSupplies: 0, expenseParking: 0, expenseOther: 1000, unknownService: 0, unknownProduct: 0 });
  assert.equal(rows.length, 31);
  assert.equal(rows[30].cash, 0);
});

test("日本時間の0時と月末を含み、前月末・翌月初を除外する", () => {
  const rows = aggregateMonthlySales(month, [visit({ date: new Date("2026-09-30T14:59:59Z") }), visit({ date: month.start }), visit({ date: new Date("2026-10-31T14:59:59Z") }), visit({ date: month.end })], [{ date: month.end, amount: 9999 }]);
  assert.equal(rows[0].cash, 16000);
  assert.equal(rows[30].cash, 16000);
  assert.equal(rows.reduce((sum, row) => sum + row.cash, 0), 32000);
  assert.equal(rows.reduce((sum, row) => sum + row.expenses, 0), 0);
});

test("支払方法未登録を現金に見せず、確認用の金額とポイントを保持する", () => {
  const rows = aggregateMonthlySales(month, [visit({ paymentMethod: null })], []);
  assert.equal(rows[0].cash, 0);
  assert.equal(rows[0].credit, 0);
  assert.equal(rows[0].unknownService, 16000);
  assert.equal(rows[0].unknownProduct, 2200);
  assert.equal(rows[0].points, 800);
});

const stores = [{ id: "a", slug: "chura", name: "ちゅら", kind: "SALON" }, { id: "b", slug: "lien", name: "Lien", kind: "LASH" }, { id: "v", slug: "vintage", name: "古着", kind: "VINTAGE" }];
test("スタッフのURL改ざん・未所属・古着店舗・無効権限を拒否する", () => {
  const staff = { role: "STAFF", storeId: "a", active: true };
  assert.deepEqual(monthlyExportScope(staff, stores)?.storeIds, ["a"]);
  assert.equal(monthlyExportScope(staff, stores, "lien"), null);
  assert.equal(monthlyExportScope({ ...staff, storeId: null }, stores), null);
  assert.equal(monthlyExportScope({ ...staff, active: false }, stores), null);
  assert.equal(monthlyExportScope({ ...staff, role: "OTHER" }, stores), null);
  assert.equal(monthlyExportScope({ ...staff, storeId: "v" }, stores), null);
});
test("オーナーはサロン全体か指定サロンのみを出力し、未知の店舗は全店舗に広げない", () => {
  const owner = { role: "OWNER", storeId: null, active: true };
  assert.deepEqual(monthlyExportScope(owner, stores)?.storeIds, ["a", "b"]);
  assert.deepEqual(monthlyExportScope(owner, stores, "lien")?.storeIds, ["b"]);
  assert.equal(monthlyExportScope(owner, stores, "missing"), null);
  assert.equal(monthlyExportScope(owner, stores, "vintage"), null);
});

test("Excelを再読込し、指定列・全日付・数値型・月合計の数式とキャッシュを照合する", async () => {
  const rows = aggregateMonthlySales(month, [visit(), visit({ date: new Date("2026-10-31T01:00:00Z"), paymentMethod: "credit", productAmount: 0 })], [{ date: visit().date, amount: 980 }]);
  const bytes = await monthlySalesWorkbook(month, "ちゅら", rows);
  assert.equal(Buffer.from(bytes.subarray(0, 2)).toString(), "PK");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.deepEqual((sheet.getRow(4).values as unknown[]).slice(1), [ "日付", "現金売上", "クレジット売上", "ポイント", "商品現金売上", "商品クレジット売上", "経費"]);
  assert.equal(sheet.getCell("A5").value, "1日");
  assert.equal(sheet.getCell("A35").value, "31日");
  assert.equal(sheet.getCell("B5").value, 16000);
  assert.equal(sheet.getCell("G5").value, 980);
  assert.equal(sheet.getCell("B6").value, 0);
  assert.deepEqual(sheet.getCell("D36").value, { formula: "SUM(D5:D35)", result: 1600 });
  assert.deepEqual(sheet.getCell("G36").value, { formula: "SUM(G5:G35)", result: 980 });
  assert.equal(workbook.worksheets.length, 1);
});

test("短い月・空の月も正しい最終日と0円の合計を出し、支払方法不明は別シートに残す", async () => {
  const feb = parseSalesMonth("2028-02")!;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await monthlySalesWorkbook(feb, "テスト店舗", aggregateMonthlySales(feb, [], []))).buffer as ArrayBuffer);
  assert.equal(workbook.worksheets[0].getCell("A33").value, "29日");
  assert.deepEqual(workbook.worksheets[0].getCell("B34").value, { formula: "SUM(B5:B33)" });
  const unknownWorkbook = new ExcelJS.Workbook();
  await unknownWorkbook.xlsx.load((await monthlySalesWorkbook(month, "=架空店舗", aggregateMonthlySales(month, [visit({ paymentMethod: null })], []))).buffer as ArrayBuffer);
  assert.equal(unknownWorkbook.worksheets.length, 2);
  assert.equal(unknownWorkbook.worksheets[1].getCell("B2").value, 16000);
  assert.equal(unknownWorkbook.worksheets[0].getCell("A2").type, ExcelJS.ValueType.String);
});

test("リアンを単独表示する時だけ経費内訳を出し、スタッフの自店舗表示にも適用する", () => {
  const owner = { role: "OWNER", storeId: null, active: true };
  assert.equal(monthlyExportScope(owner, stores, "lien")?.expenseBreakdown, true);
  assert.equal(monthlyExportScope({ role: "STAFF", storeId: "b", active: true }, stores)?.expenseBreakdown, true);
  assert.equal(monthlyExportScope(owner, stores)?.expenseBreakdown, false);
  assert.equal(monthlyExportScope(owner, stores, "chura")?.expenseBreakdown, false);
});

test("消耗品・駐車場代・その他の経費を日別集計し、全カテゴリと返金調整を合計に残す", () => {
  const day = visit().date;
  const rows = aggregateMonthlySales(month, [], [
    { date: day, amount: 1000, category: "消耗品" },
    { date: day, amount: -100, category: "消耗品" },
    { date: day, amount: 300, category: "駐車場" },
    { date: day, amount: 200, category: "駐車場代" },
    { date: day, amount: 5000, category: "HPB" },
    { date: day, amount: 1500, category: "光熱費" },
    { date: day, amount: 100, category: "未分類の旧項目" },
    { date: month.end, amount: 99999, category: "消耗品" },
  ]);
  assert.equal(rows[0].expenseSupplies, 900);
  assert.equal(rows[0].expenseParking, 500);
  assert.equal(rows[0].expenseOther, 6600);
  assert.equal(rows[0].expenses, 8000);
  for (const row of rows) assert.equal(row.expenses, row.expenseSupplies + row.expenseParking + row.expenseOther);
  assert.equal(rows[1].expenses, 0);
});

test("リアンExcelの内訳列・月合計・支払不明の注意表示と印刷範囲を再読込で照合する", async () => {
  const rows = aggregateMonthlySales(month, [visit({ paymentMethod: null })], [
    { date: visit().date, amount: 1200, category: "消耗品" },
    { date: visit().date, amount: 500, category: "駐車場" },
    { date: new Date("2026-10-31T02:00:00Z"), amount: 700, category: "その他" },
  ]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await monthlySalesWorkbook(month, "Lien", rows, { expenseBreakdown: true })).buffer as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  assert.deepEqual((sheet.getRow(4).values as unknown[]).slice(7), ["消耗品", "駐車場代", "その他の経費", "経費合計"]);
  assert.equal(sheet.getCell("G5").value, 1200);
  assert.equal(sheet.getCell("H5").value, 500);
  assert.equal(sheet.getCell("J5").value, 1700);
  assert.equal(sheet.getCell("I35").value, 700);
  assert.equal(sheet.getCell("G6").value, 0);
  assert.deepEqual(sheet.getCell("G36").value, { formula: "SUM(G5:G35)", result: 1200 });
  assert.deepEqual(sheet.getCell("H36").value, { formula: "SUM(H5:H35)", result: 500 });
  assert.deepEqual(sheet.getCell("I36").value, { formula: "SUM(I5:I35)", result: 700 });
  assert.deepEqual(sheet.getCell("J36").value, { formula: "SUM(J5:J35)", result: 2400 });
  assert.equal(sheet.pageSetup.printArea, "A1:J37");
  assert.equal(workbook.worksheets[1].name, "支払方法の確認");
});
