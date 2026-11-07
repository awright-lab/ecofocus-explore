import { expect, it } from 'vitest';
import { immediateGuidedPreviewKey } from '../immediateGuidedPreviewKey';
import { guidedPreviewFixture } from './guidedPreviewFixture';
import { allRespondentsGroupingField } from '../numericSummaryScope';

it.each(['group', 'measure', 'banner', 'filter'] as const)('tracks same-reference %s values exactly', async role => {
  const f = await guidedPreviewFixture(120);
  f.config.measureField = f.dataset.fields[2]; f.config.metric = 'average';
  f.config.filter = { field: f.dataset.fields[3], value: 'Keep' };
  const before = structuredClone(f.dataset), key = immediateGuidedPreviewKey(f.config);
  const column = { group: 'Answer', measure: 'Amount', banner: 'Group', filter: 'Filter' }[role];
  f.dataset.rows[0][column] = 'changed';
  expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);
  Object.assign(f.dataset.rows[0], before.rows[0]);
  expect(immediateGuidedPreviewKey(f.config)).toBe(key);
  expect(f.dataset).toEqual(before);
});
it('keeps unrelated columns private and does not invalidate for unselected edits', async () => {
  const f = await guidedPreviewFixture(120), key = immediateGuidedPreviewKey(f.config);
  expect(key).not.toContain('PRIVATE-UNSELECTED');
  f.dataset.rows[0].Unrelated = 'changed'; f.dataset.fields[4].label = 'Changed unrelated label';
  expect(immediateGuidedPreviewKey(f.config)).toBe(key);
});
it.each(['mapping', 'labels', 'import', 'count'] as const)('invalidates in-place %s metadata', async kind => {
  const f = await guidedPreviewFixture(120), key = immediateGuidedPreviewKey(f.config);
  if (kind === 'mapping') f.config.field.sourceColumn = 'Group';
  if (kind === 'labels') f.config.field.valueLabels!['1'] = 'New label';
  if (kind === 'import') f.dataset.importedAt += 'changed';
  if (kind === 'count') f.dataset.fieldCount++;
  expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);
});
it('uses the engine case-key rules and rejects ambiguous fallbacks', async () => {
  const f = await guidedPreviewFixture(120), original = immediateGuidedPreviewKey(f.config);
  for (const row of f.dataset.rows) { row.answer = row.Answer; delete row.Answer; }
  expect(immediateGuidedPreviewKey(f.config)).toBe(original);
  f.dataset.rows[0].answer = 'changed';
  expect(immediateGuidedPreviewKey(f.config)).not.toBe(original);
  f.dataset.rows[0].ANSWER = 'ambiguous';
  expect(() => immediateGuidedPreviewKey(f.config)).toThrow('Ambiguous source column');
});
it('keeps virtual grouping separate from a physical reserved-ID measure', async () => {
  const f = await guidedPreviewFixture(120); f.dataset.fields[2].id = '__ecofocus_all_respondents__';
  f.config = { ...f.config, field: allRespondentsGroupingField(f.dataset), groupingScope: 'all_respondents', measureField: f.dataset.fields[2], metric: 'average' };
  const key = immediateGuidedPreviewKey(f.config); f.dataset.rows[0].Amount = '99';
  expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);
});
it('does not run metadata serialization hooks or allocate oversized JSON', async () => {
  const f = await guidedPreviewFixture(120); let called = false;
  Object.defineProperty(f.config.field, 'toJSON', { configurable: true, value: () => { called = true; return {}; } });
  expect(() => immediateGuidedPreviewKey(f.config)).toThrow(); expect(called).toBe(false);
  delete (f.config.field as unknown as Record<string, unknown>).toJSON;
  const text = 'x'.repeat(180000); for (const row of f.dataset.rows) row.Answer = text;
  expect(() => immediateGuidedPreviewKey(f.config)).toThrow('identity budget');
});

it("tracks the engine's complete previewRows fallback without changing legacy sources",async()=>{const f=await guidedPreviewFixture(120);f.dataset.previewRows=f.dataset.rows;f.dataset.rows=[];const before=structuredClone(f.dataset),key=immediateGuidedPreviewKey(f.config);f.dataset.previewRows[0].Answer="changed";expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);f.dataset.previewRows[0].Answer=before.previewRows[0].Answer;expect(immediateGuidedPreviewKey(f.config)).toBe(key);expect(f.dataset).toEqual(before);});

it("distinguishes equal values in full rows from the complete preview-row fallback",async()=>{const f=await guidedPreviewFixture(120),key=immediateGuidedPreviewKey(f.config);f.dataset.previewRows=f.dataset.rows;f.dataset.rows=[];expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);});
it("tracks normalized source-reference provenance under same-object mutation",async()=>{const f=await guidedPreviewFixture(120);f.dataset.sourceRef={id:"synthetic:original",kind:"imported_file",provider:"local_file",label:"Original source",datasetId:f.dataset.id};const key=immediateGuidedPreviewKey(f.config);f.dataset.sourceRef.id="synthetic:replacement";f.dataset.sourceRef.label="Replacement source";expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);});

it("uses normalized sourceRef semantics rather than irrelevant raw overrides",async()=>{const f=await guidedPreviewFixture(120);f.dataset.sourceRef={id:`imported:${f.dataset.id}`,kind:"imported_file",provider:"local_file",label:f.dataset.title,datasetId:f.dataset.id};const key=immediateGuidedPreviewKey(f.config);f.dataset.sourceRef.datasetId="ignored-stale-override";f.dataset.sourceRef.label="";expect(immediateGuidedPreviewKey(f.config)).toBe(key);});
it("does not invalidate because unused preview rows changed while full rows remain authoritative",async()=>{const f=await guidedPreviewFixture(120),key=immediateGuidedPreviewKey(f.config);f.dataset.previewRows=structuredClone(f.dataset.rows);f.dataset.previewRows[0].Answer="unused";expect(immediateGuidedPreviewKey(f.config)).toBe(key);});
it.each(["id","label","connectionId","remoteRecordId","objectPath"] as const)("tracks normalized sourceRef %s",async property=>{const f=await guidedPreviewFixture(120);f.dataset.sourceRef={id:"synthetic:source",kind:"imported_file",provider:"local_file",label:"Source",datasetId:f.dataset.id};const key=immediateGuidedPreviewKey(f.config);f.dataset.sourceRef[property]="changed";expect(immediateGuidedPreviewKey(f.config)).not.toBe(key);});
