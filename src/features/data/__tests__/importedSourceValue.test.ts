import { encodeImportedRows } from '../../document/workspaceRowStorage';
import { readSavedStudies } from '../../document/workspaceStorageValidation';
import { expect, it } from 'vitest';
import { importDatasetBuffer } from '../datasetImportModel';
import { importedRawFieldValue, runImportedDatasetQuery } from '../importedDatasetAnalytics';
import { buildImportedNumericProfile } from '../importedNumericProfile';

it.each(['constructor', '__proto__', 'toString'])('treats missing own source column %s as blank', sourceColumn => {
  const field = { sourceColumn } as Parameters<typeof importedRawFieldValue>[1];
  expect(importedRawFieldValue({ Other: 'value' }, field)).toBe('');
  expect(importedRawFieldValue(Object.fromEntries([[sourceColumn, 'own value']]), field)).toBe('own value');
});
it('finds an own case-insensitive column before inherited properties', () => {
  expect(importedRawFieldValue({ Constructor: 'recorded value' }, { sourceColumn: 'constructor' } as Parameters<typeof importedRawFieldValue>[1])).toBe('recorded value');
});
it('keeps a sparse valid imported numeric profile and query usable', async () => {
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Group,constructor\nA,10\nB,20\n').buffer, 'synthetic_sparse.csv');
  const dataset = parsed.dataset!; dataset.rows = [{ Group: 'A' }, { Group: 'B', constructor: '20' }];
  const before = structuredClone(dataset);
  expect(buildImportedNumericProfile(dataset, dataset.fields[1])).toMatchObject({ valid: 1, blank: 1, mean: 20, total: 20 });
  const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], measureField: dataset.fields[1], metric: 'average', chartType: 'table' });
  expect(result.table.find(row => row.label === 'B')?.values.summary).toBe(20);
  expect(dataset).toEqual(before);
});

it('preserves missing prototype-shaped columns through valid sparse storage and analysis',async()=>{
 const parsed=await importDatasetBuffer(new TextEncoder().encode('Group,constructor\n'+'A,20\n'.repeat(60)).buffer,'synthetic_sparse.csv');
 const dataset=parsed.dataset!;dataset.rows=dataset.rows.map((row,index)=>index%2?row:{Group:'A'});
 const encoded=encodeImportedRows(dataset);expect(encoded.rows).toHaveLength(0);
 const reopened=readSavedStudies([encoded],'v2')[0];expect(Object.hasOwn(reopened.rows[0],'constructor')).toBe(false);expect(reopened.rows).toEqual(dataset.rows);
 expect(buildImportedNumericProfile(reopened,reopened.fields[1])).toMatchObject({valid:30,blank:30,total:600,mean:20});
 const result=runImportedDatasetQuery({dataset:reopened,field:reopened.fields[0],measureField:reopened.fields[1],metric:'average',chartType:'table'});
 expect(result.table[0].values.summary).toBe(20);expect(result.table[0].bases.summary).toBe(30);
});
