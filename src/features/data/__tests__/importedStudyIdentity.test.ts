import { afterEach, describe, expect, it, vi } from 'vitest';
import { createImportedStudyId } from '../../../../shared/importedStudyId';
import { importDatasetBuffer } from '../datasetImportModel';
import { normalizeDashboardWorkspace, upsertWorkspaceImportedDataset } from '../../document/workspacePersistence';
import { deferredWorkspaceImports } from '../../document/deferredWorkspaceImports';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); deferredWorkspaceImports.clear(); });
const parse = (value: number) => importDatasetBuffer(new TextEncoder().encode(`Amount\n${value}\n`).buffer, 'study.csv');

describe('new import identities', () => {
  it('keeps same-name same-tick imports distinct in the workspace and recovery queue', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1793847600000);
    const first = (await parse(10)).dataset!, second = (await parse(20)).dataset!;
    expect(first.id).not.toBe(second.id);
    const workspace = [first, second].reduce(upsertWorkspaceImportedDataset, normalizeDashboardWorkspace(undefined));
    expect(workspace.importedDatasets).toHaveLength(2);
    expect(workspace.importedDatasets.map(item => item.rows[0].Amount).sort()).toEqual(['10', '20']);
    deferredWorkspaceImports.remember(first); deferredWorkspaceImports.remember(second);
    expect(deferredWorkspaceImports.getPending()).toEqual([first, second]);
  });
  it('keeps intentional updates under the existing identity', async () => {
    const first = (await parse(10)).dataset!;
    const workspace = upsertWorkspaceImportedDataset(normalizeDashboardWorkspace(undefined), first);
    const updated = { ...first, title: 'Reviewed study' };
    const next = upsertWorkspaceImportedDataset(workspace, updated);
    expect(next.importedDatasets).toHaveLength(1); expect(next.importedDatasets[0]).toMatchObject({ id: first.id, title: updated.title });
    expect(first.title).toBe('study');
  });
  it('retains same-runtime uniqueness without UUID even with a frozen clock and random source', () => {
    vi.stubGlobal('crypto', undefined); vi.spyOn(Date, 'now').mockReturnValue(1); vi.spyOn(Math, 'random').mockReturnValue(0);
    const ids = Array.from({ length: 1000 }, () => createImportedStudyId('same.csv'));
    expect(new Set(ids).size).toBe(1000); expect(ids.every(id => id.startsWith('dataset_same_'))).toBe(true);
  });
  it('uses separate UUID entropy for imports across runtime instances', () => {
    const randomUUID = vi.fn().mockReturnValueOnce('first-uuid').mockReturnValueOnce('second-uuid');
    vi.stubGlobal('crypto', { randomUUID });
    expect(createImportedStudyId('study.csv')).toContain('first-uuid');
    expect(createImportedStudyId('study.csv')).toContain('second-uuid'); expect(randomUUID).toHaveBeenCalledTimes(2);
  });
});
