import { describe, expect, it } from 'vitest';
import { importDatasetBuffer } from '../datasetImportModel';
const parse = (text: string) => importDatasetBuffer(new TextEncoder().encode(text).buffer, 'synthetic_quotes.csv');
describe('CSV quote integrity', () => {
  it.each([
    'Group,Value\n"unfinished,10\nA,20\n',
    'Group,Value\nA"B,10\n',
    'Group,Value\n"A"tail,10\n',
  ])('rejects malformed input instead of altering or combining records: %j', async text => {
    const result = await parse(text); expect(result.dataset).toBeUndefined();
    expect(result.error).toMatch(/CSV.*record 2.*column 1/); expect(result.error).not.toContain('unfinished');
  });
  it('preserves escaped quotes, commas and embedded line breaks inside fields', async () => {
    const result = await parse('Group,Value,Note\r\n"A, B",10,"First\r\nsecond ""quoted"" line"\r\nC,20,""\r\n');
    expect(result.error).toBeUndefined();
    expect(result.dataset?.rows).toEqual([{ Group: 'A, B', Value: '10', Note: 'First\r\nsecond "quoted" line' }, { Group: 'C', Value: '20', Note: '' }]);
  });
  it.each(['\n', '\r\n', '\r'])('keeps existing line-ending and surrounding-space compatibility for %j', async ending => {
    const result = await parse(`Group,Value${ending}  "A"  ,10${ending}B,20`);
    expect(result.error).toBeUndefined(); expect(result.dataset?.rows).toEqual([{ Group: 'A', Value: '10' }, { Group: 'B', Value: '20' }]);
  });
});
