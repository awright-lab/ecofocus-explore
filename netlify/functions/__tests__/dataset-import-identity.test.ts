import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handler } from '../dataset-import';
import { importDatasetBuffer } from '../../../src/features/data/datasetImportModel';
const mocks = vi.hoisted(() => ({ set: vi.fn(), setJSON: vi.fn(), query: vi.fn(), connect: vi.fn(), release: vi.fn(), poolQuery: vi.fn(), fetch: vi.fn() }));
vi.mock('@netlify/blobs', () => ({ connectLambda: vi.fn(), getStore: () => ({ set: mocks.set, setJSON: mocks.setJSON }) }));
vi.mock('@netlify/database', () => ({ getDatabase: () => ({ pool: { query: mocks.poolQuery, connect: mocks.connect } }), MissingDatabaseConnectionError: class extends Error {} }));
vi.mock('node:module', () => ({ createRequire: () => () => ({ SavBufferReader: class {
  meta = { sysvars: [{ name: 'Amount', type: 0 }], getValueLabels: () => [] };
  async open() {} async readAllRows() { return [{ Amount: 10 }]; }
} }) }));
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(1793847600000); mocks.set.mockResolvedValue(undefined); mocks.setJSON.mockResolvedValue(undefined); mocks.query.mockResolvedValue({ rows: [] });
  mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  mocks.poolQuery.mockRejectedValue(new Error('Transactions must use one acquired client'));
  mocks.fetch.mockRejectedValue(new Error('Live network forbidden in synthetic handler tests')); vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function upload(fileName: string, fileType: string, dataset?: unknown) {
  const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ fileName, fileType, dataset, contentBase64: Buffer.from('synthetic parser fallback fixture').toString('base64') }) } as never, {} as never, undefined as never);
  expect(response?.statusCode).toBe(200); return JSON.parse(response?.body ?? '{}');
}
it('assigns separate storage paths to same-name SAV fallback imports in one clock tick', async () => {
  const first = await upload('study.sav', 'sav'), second = await upload('study.sav', 'sav');
  expect(first.dataset.id).not.toBe(second.dataset.id);
  expect(first.storage.objectPath).not.toBe(second.storage.objectPath);
  expect(first.dataset.rowCount).toBe(1); expect(second.dataset.rowCount).toBe(1);
  expect(mocks.set).toHaveBeenCalledTimes(2); expect(mocks.setJSON).toHaveBeenCalledTimes(2); expect(mocks.fetch).not.toHaveBeenCalled();
});
it('retains a supplied browser study identity and respondent values', async () => {
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Amount\n10\n').buffer, 'study.csv');
  const dataset = { ...parsed.dataset!, id: 'existing_study_identity' };
  const result = await upload('study.csv', 'csv', dataset);
  expect(result.dataset.id).toBe(dataset.id); expect(result.dataset.previewRows).toEqual(dataset.rows);
  expect(result.storage.objectPath).toContain('/existing_study_identity/'); expect(mocks.fetch).not.toHaveBeenCalled();
});
it('pins every database write to one acquired connection and releases it after commit', async () => {
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Amount\n10\n').buffer, 'study.csv');
  const result = await upload('study.csv', 'csv', parsed.dataset);
  expect(result.storage.database).toBe('stored'); expect(mocks.connect).toHaveBeenCalledOnce(); expect(mocks.poolQuery).not.toHaveBeenCalled();
  const statements = mocks.query.mock.calls.map(call => String(call[0]));
  expect(statements[0]).toBe('begin'); expect(statements.at(-1)).toBe('commit');
  expect(statements.some(statement => statement.startsWith('delete from imported_dataset_rows'))).toBe(true);
  expect(statements.some(statement => statement.includes('insert into imported_dataset_rows'))).toBe(true);
  expect(mocks.release).toHaveBeenCalledOnce();
});
it('rolls back on the same connection and releases it when a respondent insert fails', async () => {
  mocks.query.mockImplementation(async (statement: string) => { if (statement.includes('insert into imported_dataset_rows')) throw new Error('Synthetic row write failed'); return { rows: [] }; });
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Amount\n10\n').buffer, 'study.csv');
  const result = await upload('study.csv', 'csv', parsed.dataset);
  expect(result.storage.database).toBe('not_stored'); expect(result.storage.databaseWarning).toContain('Synthetic row write failed');
  expect(mocks.poolQuery).not.toHaveBeenCalled(); expect(mocks.query.mock.calls.at(-1)?.[0]).toBe('rollback');
  expect(mocks.query.mock.calls.some(call => call[0] === 'commit')).toBe(false); expect(mocks.release).toHaveBeenCalledOnce();
});
it('discards a connection whose rollback fails while preserving the original write error', async () => {
  const rollbackError = new Error('Synthetic rollback failed');
  mocks.query.mockImplementation(async (statement: string) => { if (statement === 'rollback') throw rollbackError; if (statement.includes('insert into imported_dataset_rows')) throw new Error('Synthetic original insert failed'); return { rows: [] }; });
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Amount\n10\n').buffer, 'study.csv');
  const result = await upload('study.csv', 'csv', parsed.dataset);
  expect(result.storage.database).toBe('not_stored'); expect(result.storage.databaseWarning).toContain('Synthetic original insert failed');
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith(rollbackError); expect(mocks.poolQuery).not.toHaveBeenCalled();
});
it('reports an acquisition failure without starting a transaction or releasing an unowned client', async () => {
  mocks.connect.mockRejectedValue(new Error('Synthetic connection unavailable'));
  const parsed = await importDatasetBuffer(new TextEncoder().encode('Amount\n10\n').buffer, 'study.csv');
  const result = await upload('study.csv', 'csv', parsed.dataset);
  expect(result.storage.database).toBe('not_stored'); expect(result.storage.databaseWarning).toContain('Synthetic connection unavailable');
  expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.release).not.toHaveBeenCalled(); expect(mocks.poolQuery).not.toHaveBeenCalled();
});
