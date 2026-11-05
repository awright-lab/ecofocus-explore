import { describe, expect, it } from 'vitest';
import { importDatasetBuffer } from '../datasetImportModel';
import { runImportedDatasetQuery } from '../importedDatasetAnalytics';
import { encodeImportedRows, decodeImportedRows } from '../../document/workspaceRowStorage';
const parse = (text: string) => importDatasetBuffer(new TextEncoder().encode(text).buffer, 'synthetic_columns.csv');

describe('independent imported column identities', () => {
  it.each([
    ['Amount,Amount', ['Amount', 'Amount (2)']],
    ['Column 2,', ['Column 2', 'Column 2 (2)']],
    ['A,A,A (2)', ['A', 'A (3)', 'A (2)']],
    [',Column 1,Column 1 (2)', ['Column 1 (3)', 'Column 1', 'Column 1 (2)']],
  ])('preserves every column for %s', async (header, expected) => {
    const values = expected.map((_, index) => String(index + 10));
    const result = await parse(`${header}\n${values.join(',')}\n`);
    expect(result.error).toBeUndefined(); const dataset = result.dataset!;
    expect(dataset.fields.map(field => field.sourceColumn)).toEqual(expected);
    expect(dataset.fields.map(field => dataset.rows[0][field.sourceColumn])).toEqual(values);
    expect(dataset.notes.join(' ')).toContain('preserve its values separately');
    expect(dataset.importMetadata?.parserNotes).toEqual(expect.arrayContaining(dataset.notes.filter(note => note.startsWith('Column '))));
  });
  it('keeps duplicated numeric columns independently queryable through encoded storage', async () => {
    const result = await parse('Group,Amount,Amount\n' + 'A,10,20\n'.repeat(60));
    const dataset = result.dataset!, restored = decodeImportedRows(encodeImportedRows(dataset));
    expect(restored.rows).toEqual(dataset.rows);
    const totals = restored.fields.slice(1).map(measureField => runImportedDatasetQuery({ dataset: restored, field: restored.fields[0], measureField, metric: 'sum', chartType: 'table' }).table[0].values.summary);
    expect(totals).toEqual([600, 1200]);
  });
  it('retains ragged observations and reserved object keys', async () => {
    const result = await parse('__proto__,constructor,toString\nfirst,second,third,fourth\nlast\n');
    const dataset = result.dataset!;
    expect(dataset.fields.map(field => field.sourceColumn)).toEqual(['__proto__', 'constructor', 'toString', 'Column 4']);
    expect(dataset.fields.map(field => dataset.rows[0][field.sourceColumn])).toEqual(['first', 'second', 'third', 'fourth']);
    expect(dataset.fields.map(field => dataset.rows[1][field.sourceColumn])).toEqual(['last', '', '', '']);
    expect(Object.getPrototypeOf(dataset.rows[0])).toBe(Object.prototype);
  });
  it('imports all 150000 narrow rows without a variadic argument-stack limit', async () => {
    const result = await parse('Answer,Value\n' + Array.from({ length: 150000 }, (_, index) => `Yes,${index}`).join('\n'));
    expect(result.error).toBeUndefined(); expect(result.dataset?.rowCount).toBe(150000);
    expect(result.dataset?.rows.at(-1)?.Value).toBe('149999');
  });
});
