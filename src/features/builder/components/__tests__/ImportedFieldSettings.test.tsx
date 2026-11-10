// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ImportedFieldSettings } from '../ImportedFieldSettings';
import { importDatasetBuffer } from '../../../data/datasetImportModel';
import { runImportedDatasetQuery } from '../../../data/importedDatasetAnalytics';
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace } from '../../../document/workspacePersistence';
import { initialDashboard } from '../../../document/documentSeeds';
import type { ImportedDatasetRecord } from '../../../../../shared/types/dashboard';
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function study() { return (await importDatasetBuffer(new TextEncoder().encode('Region,Spend\nNorth,$10\nNorth,invalid\nSouth,30\nSouth,\n').buffer, 'synthetic_settings.csv')).dataset!; }
async function choose(type: string) { const select = host.querySelector('select')!; await act(async () => { select.value = type; select.dispatchEvent(new Event('change', { bubbles: true })); }); }
it('turns mixed currency/text into an explicit numeric measure without changing raw values or a saved snapshot', async () => {
  const original = await study(), before = structuredClone(original), draft = structuredClone(initialDashboard); draft.importedDatasets = [original];
  const snapshot = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [original] }), draft), historical = structuredClone(snapshot.snapshot);
  let current!: ImportedDatasetRecord;
  function Harness() { const [dataset, setDataset] = useState(original); current = dataset; return <ImportedFieldSettings field={dataset.fields[1]} remote={false} onUpdate={updates => setDataset(previous => ({ ...previous, fields: previous.fields.map((field, index) => index === 1 ? { ...field, ...updates } : field) }))} />; }
  await act(async () => root.render(<Harness />)); expect(host.querySelector('select')?.value).toBe('categorical'); await choose('numeric');
  expect(current.fields[1]).toMatchObject({ type: 'numeric', modelingRole: 'candidate_measure', eligibleForFilter: false, eligibleForBanner: false, eligibleForSegment: false });
  const result = runImportedDatasetQuery({ dataset: current, field: current.fields[0], measureField: current.fields[1], metric: 'average', chartType: 'table' });
  expect(result.table.map(row => row.values.summary)).toEqual([10, 30]); expect(result.table.map(row => row.bases.summary)).toEqual([1, 1]);
  expect(current.rows).toEqual(before.rows); expect(original).toEqual(before); expect(snapshot.snapshot).toEqual(historical);
});
it('does not offer unsupported server-backed metadata writes', async () => {
  const dataset = await study(), update = vi.fn(); await act(async () => root.render(<ImportedFieldSettings field={dataset.fields[1]} remote onUpdate={update} />));
  expect(host.querySelector('select')?.disabled).toBe(true); await choose('numeric'); expect(update).not.toHaveBeenCalled(); expect(host.textContent).toContain('cannot be changed');
});
it.each([['categorical', 'candidate_dimension', true], ['text', 'raw_variable', false], ['date', 'candidate_date', false]] as const)('keeps %s roles and capabilities consistent', async (type, role, eligible) => {
  const dataset = await study(), update = vi.fn(); await act(async () => root.render(<ImportedFieldSettings field={dataset.fields[1]} remote={false} onUpdate={update} />)); await choose(type);
  expect(update).toHaveBeenCalledWith({ type, modelingRole: role, eligibleForFilter: eligible, eligibleForSegment: eligible, eligibleForBanner: eligible });
});
