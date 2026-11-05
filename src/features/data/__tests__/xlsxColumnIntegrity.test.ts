// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { importDatasetFile } from '../datasetImportModel';
import { buildZip } from '../../export/zip';

it('preserves duplicate XLSX columns without taking later authored names', async () => {
  const bytes = buildZip([
    { path: 'xl/workbook.xml', content: '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Synthetic" r:id="rId1"/></sheets></workbook>' },
    { path: 'xl/_rels/workbook.xml.rels', content: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
    { path: 'xl/worksheets/sheet1.xml', content: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Amount</t></is></c><c r="B1" t="inlineStr"><is><t>Amount</t></is></c><c r="C1" t="inlineStr"><is><t>Amount (2)</t></is></c></row><row r="2"><c r="A2"><v>10</v></c><c r="B2"><v>20</v></c><c r="C2"><v>30</v></c></row></sheetData></worksheet>' },
  ]);
  const file = { name: 'synthetic.xlsx', arrayBuffer: async () => bytes.buffer } as File;
  const result = await importDatasetFile(file); expect(result.error).toBeUndefined();
  expect(result.dataset?.fields.map(field => field.sourceColumn)).toEqual(['Amount', 'Amount (3)', 'Amount (2)']);
  expect(result.dataset?.rows).toEqual([{ Amount: '10', 'Amount (3)': '20', 'Amount (2)': '30' }]);
  expect(result.dataset?.notes.join(' ')).toContain('duplicate header "Amount" imported as "Amount (3)"');
});
