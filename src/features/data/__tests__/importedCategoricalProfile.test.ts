import { afterEach, expect, it, vi } from 'vitest';
import { buildImportedCategoricalProfile } from '../importedCategoricalProfile';
import { importDatasetBuffer } from '../datasetImportModel';
async function study(text = 'Answer,Record\n1,a\n1,b\n2,c\n,d\n9,e\n') {
  const result = await importDatasetBuffer(new TextEncoder().encode(text).buffer, 'synthetic_categories.csv');
  const dataset = result.dataset!; dataset.fields[0] = { ...dataset.fields[0], type: 'categorical', modelingRole: 'candidate_dimension' }; return dataset;
}
afterEach(() => vi.unstubAllGlobals());
it('uses the analysis engine labels and a nonblank response base without modifying data', async () => {
  const dataset = await study(); dataset.fields[0].valueLabels = { '1': 'Same', '2': 'Same', '3': 'Unused' }; const before = structuredClone(dataset);
  const profile = buildImportedCategoricalProfile(dataset, dataset.fields[0]);
  expect(profile).toMatchObject({ status: 'ready', rows: 5, valid: 4, blank: 1, observedCategories: 3, unusedLabels: 1, omittedCategories: 0 });
  if (profile.status !== 'ready') throw Error('profile');
  expect(profile.categories.map(row => [row.label, row.count, row.share])).toEqual([['Same [1]', 2, 50], ['9', 1, 25], ['Same [2]', 1, 25]]);
  expect(dataset).toEqual(before);
});
it('does not fabricate percentages for all-blank or empty stored responses', async () => {
  const dataset = await study('Answer,Record\n,1\n ,2\n'); dataset.fields[0].valueLabels = { '1': 'Yes' };
  expect(buildImportedCategoricalProfile(dataset, dataset.fields[0])).toMatchObject({ status: 'ready', valid: 0, blank: 2, unusedLabels: 1, categories: [] });
  dataset.rows = []; dataset.previewRows = []; dataset.rowCount = 0;
  expect(buildImportedCategoricalProfile(dataset, dataset.fields[0])).toMatchObject({ status: 'ready', rows: 0, valid: 0, blank: 0 });
});
it('bounds the displayed categories and accounts for every omitted response', async () => {
  const dataset = await study('Answer\n' + Array.from({ length: 25 }, (_, index) => `Category ${index}`).join('\n'));
  const profile = buildImportedCategoricalProfile(dataset, dataset.fields[0]);
  expect(profile).toMatchObject({ status: 'ready', observedCategories: 25, omittedCategories: 15, omittedResponses: 15 });
  if (profile.status === 'ready') expect(profile.categories).toHaveLength(10);
});
it('refuses incomplete browser or remote previews without fetching', async () => {
  const dataset = await study(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); dataset.rows = []; dataset.previewRows = dataset.previewRows.slice(0, 1);
  expect(buildImportedCategoricalProfile(dataset, dataset.fields[0])).toMatchObject({ status: 'unavailable' });
  dataset.remote = { provider: 'netlify', projectUrl: '', bucket: '', objectPath: 'synthetic.csv', uploadedAt: dataset.importedAt };
  expect(buildImportedCategoricalProfile(dataset, dataset.fields[0])).toMatchObject({ status: 'unavailable' }); expect(fetcher).not.toHaveBeenCalled();
});
it('uses complete stored preview rows and case-insensitive source matching consistently', async () => {
  const dataset = await study('Answer,Record\nA,1\nB,2\n'); dataset.rows = []; dataset.previewRows = [{ answer: 'A' }, { answer: 'B' }];
  expect(buildImportedCategoricalProfile(dataset, dataset.fields[0])).toMatchObject({ status: 'ready', valid: 2, observedCategories: 2, blank: 0 });
});
it('declines a numeric field rather than treating its measure as a category', async () => {
  const dataset = await study(); dataset.fields[0].type = 'numeric'; dataset.fields[0].modelingRole = 'candidate_measure';
  expect(buildImportedCategoricalProfile(dataset, dataset.fields[0])).toMatchObject({ status: 'unavailable' });
});
