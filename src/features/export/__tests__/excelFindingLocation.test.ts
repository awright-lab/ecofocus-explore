import { expect, it } from 'vitest';
import { checkExcelPreflight, excelCellAddress } from '../excelPreflightModel';
import { buildXlsxWorkbookPlan } from '../xlsxWorkbookPlan';
import { initialDashboard } from '../../document/documentSeeds';
import { excelFindingFixture } from './excelFindingFixture';
it.each(['x'.repeat(32768), 'x\n'.repeat(254), 'x\u0001y', 'x\ud800y'])('records exact cell coordinates for unsupported text without repairing it (%#)', async title => {
  const draft = structuredClone(initialDashboard); draft.pages = draft.pages.slice(0, 1); draft.pages[0].tiles = []; draft.pages[0].elements = []; draft.title = title;
  const before = JSON.stringify(draft), result = await checkExcelPreflight(draft, { signal: new AbortController().signal });
  expect(result.issues).toContainEqual(expect.objectContaining({ address: 'B1', cell: { sheetIndex: 0, row: 0, column: 1 } }));
  expect(result.sheets[0].rows[0][1]).toBe(title); expect(JSON.stringify(draft)).toBe(before);
});
it.each([1e-310, 1e308, 1.2345678901234567])('locates numeric advisory %s in the same unchanged workbook plan', async value => {
  const { draft, tile, location } = await excelFindingFixture();
  const row = tile.result.table.find(row => Object.values(row.values).includes(1.2345678901234567))!;
  const key = Object.keys(row.values).find(key => row.values[key] === 1.2345678901234567)!; row.values[key] = value;
  const before = JSON.stringify(draft), result = await checkExcelPreflight(draft, { signal: new AbortController().signal });
  const issue = result.issues.find(issue => issue.address === excelCellAddress(location.row, location.column) && issue.cell?.sheetIndex === 1)!;
  expect(issue.cell).toEqual(location); expect(issue.severity).toBe('advisory');
  expect(result.sheets[1].rows[location.row][location.column]).toBe(value);
  expect(result.sheets).toEqual(buildXlsxWorkbookPlan(draft, draft.pages, result.generatedAt)); expect(JSON.stringify(draft)).toBe(before);
});
it('keeps worksheet-level findings distinct from exact cell locations', async () => {
  const { draft, tile } = await excelFindingFixture(); tile.title = 'Invalid\u0001 worksheet';
  const result = await checkExcelPreflight(draft, { signal: new AbortController().signal });
  const worksheet = result.issues.find(issue => issue.address === 'Worksheet name');
  expect(worksheet).toBeDefined(); expect(worksheet!.cell).toBeUndefined();
  expect(result.issues.some(issue => issue.cell !== undefined)).toBe(true);
});
