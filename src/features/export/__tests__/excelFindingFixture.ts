import { tableExplorerFixture } from '../../builder/components/__tests__/tableExplorerFixture';
import { buildXlsxWorkbookPlan } from '../xlsxWorkbookPlan';
import { excelCellAddress } from '../excelPreflightModel';
export async function excelFindingFixture() {
  const fixture = await tableExplorerFixture('average'), { draft, tile } = fixture;
  const row = tile.result.table.slice(50).find(row => tile.result.columns.slice(8).some(column => row.bases[column.id] > 0))!;
  const column = tile.result.columns.slice(8).find(column => row.bases[column.id] > 0)!;
  const value = 1.2345678901234567; row.values[column.id] = value;
  const plan = buildXlsxWorkbookPlan(draft, draft.pages, '2026-11-07T00:00:00Z');
  const rowIndex = plan[1].rows.findIndex(row => row.includes(value)), columnIndex = plan[1].rows[rowIndex].indexOf(value);
  if (rowIndex < 25 || columnIndex < 8) throw Error('Finding must start outside the initial row and column windows');
  return { ...fixture, value, location: { sheetIndex: 1, row: rowIndex, column: columnIndex }, address: excelCellAddress(rowIndex, columnIndex), sheetName: plan[1].name };
}
