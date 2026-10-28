import ExcelJS from "exceljs";
import type { SalesMonth } from "./monthlySalesReport";
import { aggregateVintageSales, type VintageExportSale } from "./vintageSalesReport";

export async function vintageSalesWorkbook(month: SalesMonth, storeName: string, sales: VintageExportSale[]) {
  const rows = aggregateVintageSales(month, sales);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "サロン売上管理";
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("古着の日別売上", {
    views: [{ state: "frozen", ySplit: 4, xSplit: 1 }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  sheet.columns = [{ width: 16 }, { width: 28 }, { width: 28 }];
  for (let row = 1; row <= 3; row++) sheet.mergeCells(`A${row}:C${row}`);
  sheet.getCell("A1").value = `${month.year}年${month.month}月　古着の日別売上`;
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF675287" } };
  sheet.getRow(1).height = 36;
  sheet.getCell("A2").value = `${storeName}　／　単位：円　／　日付：日本時間`;
  sheet.getCell("A3").value = "現金とクレジットは、売上登録時の支払方法に従って集計しています。";
  sheet.getCell("A3").font = { size: 10, color: { argb: "FF555555" } };
  sheet.getRow(4).values = ["日付", "現金売上", "クレジット売上"];
  sheet.getRow(4).height = 28;
  const moneyFormat = '#,##0;[Red]-#,##0;0';
  for (const row of rows) {
    const output = sheet.addRow([`${row.day}日`, row.cash, row.credit]);
    output.height = 22;
    output.getCell(1).alignment = { horizontal: "center" };
    output.getCell(2).numFmt = moneyFormat; output.getCell(3).numFmt = moneyFormat;
    if (row.day % 2 === 0) output.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F1F9" } }; });
  }
  const lastDayRow = month.days + 4;
  const total = sheet.addRow(["月合計"]);
  total.height = 28;
  total.getCell(2).value = { formula: `SUM(B5:B${lastDayRow})`, result: rows.reduce((sum, row) => sum + row.cash, 0) };
  total.getCell(3).value = { formula: `SUM(C5:C${lastDayRow})`, result: rows.reduce((sum, row) => sum + row.credit, 0) };
  for (const index of [4, total.number]) sheet.getRow(index).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FF48375E" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8DFF0" } };
  });
  total.getCell(2).numFmt = moneyFormat; total.getCell(3).numFmt = moneyFormat;
  sheet.autoFilter = `A4:C${lastDayRow}`;
  sheet.pageSetup.printArea = `A1:C${total.number}`;
  const unknown = rows.filter(row => row.unknown !== 0);
  if (unknown.length) {
    const note = sheet.addRow(["支払方法未登録の売上は、現金・クレジットに含めず「支払方法の確認」シートに記載しています。"]);
    sheet.mergeCells(`A${note.number}:C${note.number}`);
    note.height = 36; note.getCell(1).alignment = { wrapText: true };
    sheet.pageSetup.printArea = `A1:C${note.number}`;
    const check = workbook.addWorksheet("支払方法の確認");
    check.columns = [{ header: "日付", width: 16 }, { header: "支払方法未登録の売上", width: 30 }];
    for (const row of unknown) check.addRow([`${row.day}日`, row.unknown]);
    check.getColumn(2).numFmt = moneyFormat;
    check.getRow(1).font = { bold: true };
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
