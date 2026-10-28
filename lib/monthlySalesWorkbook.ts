import ExcelJS from "exceljs";
import type { DailySalesRow, SalesMonth } from "./monthlySalesReport";

export async function monthlySalesWorkbook(month: SalesMonth, scope: string, rows: DailySalesRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "サロン売上管理";
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("日別売上・経費", { views: [{ state: "frozen", ySplit: 4, xSplit: 1 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
  sheet.columns = [{ width: 12 }, ...Array.from({ length: 6 }, () => ({ width: 23 }))];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = `${month.year}年${month.month}月　日別売上・経費`;
  sheet.getCell("A1").font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF187F83" } };
  sheet.getRow(1).height = 38;
  sheet.mergeCells("A2:G2"); sheet.getCell("A2").value = `${scope}　／　単位：円　／　日付：日本時間`;
  sheet.mergeCells("A3:G3"); sheet.getCell("A3").value = "現金・クレジット売上は技術分。商品は別列。ポイントは登録済みの金額を別計上。経費は全項目の合計です。";
  sheet.getCell("A3").font = { size: 10, color: { argb: "FF555555" } };
  const headers = ["日付", "現金売上", "クレジット売上", "ポイント", "商品現金売上", "商品クレジット売上", "経費"];
  sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 30;
  sheet.getRow(4).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FF164B4D" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EFEC" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  for (const row of rows) {
    const excelRow = sheet.addRow([`${row.day}日`, row.cash, row.credit, row.points, row.productCash, row.productCredit, row.expenses]);
    excelRow.height = 23;
    excelRow.getCell(1).alignment = { horizontal: "center" };
    for (let col = 2; col <= 7; col++) { excelRow.getCell(col).numFmt = '#,##0;[Red]-#,##0;0'; }
    if (row.day % 2 === 0) excelRow.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F8F7" } }; });
  }
  const lastDayRow = 4 + rows.length;
  const total = sheet.addRow(["月合計"]);
  total.height = 30;
  for (let col = 2; col <= 7; col++) {
    const letter = String.fromCharCode(64 + col);
    const value = rows.reduce((sum, _, i) => sum + Number(sheet.getRow(5 + i).getCell(col).value), 0);
    total.getCell(col).value = { formula: `SUM(${letter}5:${letter}${lastDayRow})`, result: value };
    total.getCell(col).numFmt = '#,##0;[Red]-#,##0;0';
  }
  total.eachCell(cell => { cell.font = { bold: true, color: { argb: "FF164B4D" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9EFEC" } }; });
  sheet.autoFilter = `A4:G${lastDayRow}`;
  sheet.pageSetup.printArea = `A1:G${total.number}`;
  const unknownRows = rows.filter(row => row.unknownService || row.unknownProduct);
  if (unknownRows.length) {
    const note = sheet.addRow(["支払方法が未登録の売上があります。「支払方法の確認」シートをご確認ください。現金・クレジット列には含めていません。"]);
    sheet.mergeCells(`A${note.number}:G${note.number}`); note.height = 32;
    note.getCell(1).alignment = { wrapText: true };
    sheet.pageSetup.printArea = `A1:G${note.number}`;
    const unknown = workbook.addWorksheet("支払方法の確認");
    unknown.columns = [{ header: "日付", width: 14 }, { header: "技術売上（支払方法未登録）", width: 36 }, { header: "商品売上（支払方法未登録）", width: 36 }];
    for (const row of unknownRows) unknown.addRow([`${row.day}日`, row.unknownService, row.unknownProduct]);
    unknown.getColumn(2).numFmt = "#,##0"; unknown.getColumn(3).numFmt = "#,##0";
    unknown.getRow(1).font = { bold: true };
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
