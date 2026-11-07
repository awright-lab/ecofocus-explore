import { afterEach, expect, it, vi } from 'vitest';
import { runGuidedPreviewJob, type GuidedPreviewWorker } from '../guidedPreviewJob';
import { calculateGuidedPreview, type GuidedPreviewRequest } from '../guidedPreviewModel';
import { runImportedDatasetQuery } from '../importedDatasetAnalytics';
import { guidedPreviewFixture } from './guidedPreviewFixture';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function heldWorker() {
  let request: GuidedPreviewRequest | undefined;
  const worker: GuidedPreviewWorker = { onmessage: null, onerror: null, onmessageerror: null, terminate: vi.fn(), postMessage: vi.fn(value => { request = value; }) };
  return { worker, complete() { worker.onmessage?.({ data: { type: 'complete', result: calculateGuidedPreview(request!) } } as MessageEvent); } };
}
function slowPreparation() {
  const schedule = globalThis.setTimeout;
  return vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number, ...args: unknown[]) => schedule(callback, delay === 0 ? 1000 : delay, ...args)) as typeof setTimeout);
}
it('expires yielded preparation without starting a worker or changing the complete study', async () => {
  const f = await guidedPreviewFixture(8000), before = JSON.stringify(f.dataset), createWorker = vi.fn(), progress = vi.fn();
  vi.useFakeTimers(); slowPreparation();
  const task = runGuidedPreviewJob(f.config, { signal: new AbortController().signal, createWorker, onProgress: progress });
  const rejected = expect(task).rejects.toThrow(/Preparing.*30 seconds/);
  await vi.advanceTimersByTimeAsync(29_999); expect(createWorker).not.toHaveBeenCalled();
  expect(progress.mock.calls.at(-1)?.[0]).toMatchObject({ phase: 'preparing', done: 7250, total: 8000 });
  await vi.advanceTimersByTimeAsync(1); await rejected;
  expect(createWorker).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  const calls = progress.mock.calls.length; await vi.advanceTimersByTimeAsync(60_000); expect(progress).toHaveBeenCalledTimes(calls);
  expect(JSON.stringify(f.dataset)).toBe(before);
});
it('cancels preparation and clears both timers before the deadline', async () => {
  const f = await guidedPreviewFixture(8000), before = JSON.stringify(f.dataset), controller = new AbortController(), createWorker = vi.fn();
  vi.useFakeTimers(); slowPreparation();
  const task = runGuidedPreviewJob(f.config, { signal: controller.signal, createWorker });
  const rejected = expect(task).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(12_000); controller.abort(); await rejected;
  expect(vi.getTimerCount()).toBe(0); expect(createWorker).not.toHaveBeenCalled(); expect(JSON.stringify(f.dataset)).toBe(before);
});
it('permits a fresh explicit retry after preparation times out and matches the original engine', async () => {
  const f = await guidedPreviewFixture(8000), before = JSON.stringify(f.dataset), worker = heldWorker();
  vi.useFakeTimers(); const slow = slowPreparation();
  const task = runGuidedPreviewJob(f.config, { signal: new AbortController().signal, createWorker: () => worker.worker });
  const rejected = expect(task).rejects.toThrow(/Preparing/); await vi.advanceTimersByTimeAsync(30_000); await rejected;
  slow.mockRestore();
  const retry = runGuidedPreviewJob(f.config, { signal: new AbortController().signal, createWorker: () => worker.worker });
  await vi.advanceTimersByTimeAsync(1000); worker.complete(); const accepted = await retry;
  const values = (result: typeof accepted.result) => result.table.map(row => result.columns.map(column => [row.values[column.id], row.bases[column.id]]));
  expect(values(accepted.result)).toEqual(values(runImportedDatasetQuery(f.config))); expect(accepted.sourceStillCurrent()).toBe(true);
  expect(worker.worker.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0); expect(JSON.stringify(f.dataset)).toBe(before);
});
it('clears the preparation deadline when calculation starts and keeps the existing worker deadline', async () => {
  const f = await guidedPreviewFixture(6000), worker = heldWorker(); vi.useFakeTimers(); slowPreparation();
  let settled = false;
  const task = runGuidedPreviewJob(f.config, { signal: new AbortController().signal, createWorker: () => worker.worker }).finally(() => { settled = true; });
  const rejected = expect(task).rejects.toThrow('The background preview exceeded 30 seconds');
  await vi.advanceTimersByTimeAsync(30_000); expect(worker.worker.postMessage).toHaveBeenCalledOnce(); expect(settled).toBe(false);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(23_999); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1); await rejected; expect(worker.worker.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it('ignores an already-queued preparation callback after timeout', async () => {
  const f = await guidedPreviewFixture(8000), createWorker = vi.fn(), progress = vi.fn(); vi.useFakeTimers(); const slow = slowPreparation();
  const task = runGuidedPreviewJob(f.config, { signal: new AbortController().signal, createWorker, onProgress: progress });
  const rejected = expect(task).rejects.toThrow(/Preparing/);
  const queued = slow.mock.calls.find(call => call[1] === 0)![0] as () => void;
  await vi.advanceTimersByTimeAsync(30_000); await rejected; const count = progress.mock.calls.length;
  queued(); expect(progress).toHaveBeenCalledTimes(count); expect(createWorker).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('clears preparation timers on a source error before creating a worker', async () => {
  const f = await guidedPreviewFixture(8000), createWorker = vi.fn();
  vi.useFakeTimers(); slowPreparation();
  const task = runGuidedPreviewJob(f.config, { signal: new AbortController().signal, createWorker });
  f.dataset.rows[0] = null as never; const before = JSON.stringify(f.dataset);
  const rejected = expect(task).rejects.toThrow('source row is malformed'); await vi.advanceTimersByTimeAsync(1000); await rejected;
  expect(vi.getTimerCount()).toBe(0); expect(createWorker).not.toHaveBeenCalled(); expect(JSON.stringify(f.dataset)).toBe(before);
});
