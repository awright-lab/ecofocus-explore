import { afterEach, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { runLocalCsvImport, type LocalCsvWorker } from "../localCsvImportJob";
import { createLocalCsvImportController, localCsvPacketChars, type CsvImportMessage, type CsvImportRequest } from "../localCsvImportProtocol";

class Transport implements LocalCsvWorker {
  onmessage: LocalCsvWorker["onmessage"] = null;
  onerror: LocalCsvWorker["onerror"] = null;
  onmessageerror: LocalCsvWorker["onmessageerror"] = null;
  terminated = false;
  sent: CsvImportRequest[] = [];
  emit(message: unknown) { this.onmessage?.({ data: message } as MessageEvent<CsvImportMessage>); }
  receive = createLocalCsvImportController(message => queueMicrotask(() => { if (!this.terminated) this.emit(structuredClone(message)); }));
  postMessage(message: CsvImportRequest) { this.sent.push(message); if (this.real) this.receive(message); }
  terminate() { this.terminated = true; }
  constructor(public real = false) {}
}
const file = (text = 'Region,Score\nNorth,10\nSouth,20') => new File([text], 'study.csv');
afterEach(() => vi.useRealTimers());

it("preserves all source rows, metadata, representative previews and prototype-like columns across bounded delivery", async () => {
  const text = ['__proto__,constructor,toString,A,A,', ...Array.from({ length: 1_250 }, (_, i) => `p${i},c${i},t${i},"value, ${i}",${i},${i % 7}`)].join('\n');
  const source = file(text), transport = new Transport(true), progress: unknown[] = [];
  const original = (await importDatasetBuffer(await source.arrayBuffer(), source.name, 'csv')).dataset!;
  const result = await runLocalCsvImport(source, { signal: new AbortController().signal, createWorker: () => transport, onProgress: p => progress.push(p) });
  expect(result.rows).toEqual(original.rows); expect(result.fields).toEqual(original.fields);
  expect(result.previewRows).toEqual(original.previewRows); expect(result.notes).toEqual(original.notes);
  expect(result.importMetadata).toEqual(original.importMetadata);
  expect(transport.sent.filter(m => m.type === 'ack')).toHaveLength(3);
  expect(transport.terminated).toBe(true);
  expect(progress).toContainEqual({ phase: 'receiving', received: 1250, total: 1250 });
});

it("waits for each matching acknowledgement before sending more data", async () => {
  const messages: CsvImportMessage[] = [];
  const control = createLocalCsvImportController(m => messages.push(m));
  control({ type: 'start', file: file(['A', ...Array.from({ length: 501 }, (_, i) => `${i}`)].join('\n')), name: 'study.csv' });
  await vi.waitFor(() => expect(messages.some(m => m.type === 'rows')).toBe(true));
  expect(messages.filter(m => m.type === 'rows')).toHaveLength(1);
  control({ type: 'ack', sequence: 7 }); await Promise.resolve();
  expect(messages.filter(m => m.type === 'rows')).toHaveLength(1);
  control({ type: 'ack', sequence: 0 });
  await vi.waitFor(() => expect(messages.filter(m => m.type === 'rows')).toHaveLength(2));
  expect(messages.some(m => m.type === 'complete')).toBe(false);
  control({ type: 'ack', sequence: 1 });
  await vi.waitFor(() => expect(messages.some(m => m.type === 'complete')).toBe(true));
});

it.each(['A\n"bad', 'A\n"' + 'a'.repeat(128 * 1024 + 1) + '"'])('preserves parser errors without returning a dataset', async text => {
  const worker = new Transport(true);
  await expect(runLocalCsvImport(file(text), { signal: new AbortController().signal, createWorker: () => worker })).rejects.toThrow();
  expect(worker.terminated).toBe(true);
});

it("cancels before startup without creating a worker", async () => {
  const abort = new AbortController(); abort.abort(); const createWorker = vi.fn();
  await expect(runLocalCsvImport(file(), { signal: abort.signal, createWorker })).rejects.toMatchObject({ name: 'AbortError' });
  expect(createWorker).not.toHaveBeenCalled();
});

it.each(['reading', 'parsing', 'receiving'] as const)('cancels during %s and ignores late completion', async phase => {
  const abort = new AbortController(), worker = new Transport(true);
  const task = runLocalCsvImport(file(), { signal: abort.signal, createWorker: () => worker, onProgress: next => { if (next.phase === phase) abort.abort(); } });
  await expect(task).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.terminated).toBe(true); expect(worker.onmessage).toBeNull();
  worker.emit({ type: 'complete' });
});

it("rejects transport startup, runtime, decoding and timeout failures", async () => {
  await expect(runLocalCsvImport(file(), { signal: new AbortController().signal, createWorker: () => { throw Error('no workers'); } })).rejects.toThrow('could not start');
  for (const kind of ['onerror', 'onmessageerror'] as const) {
    const worker = new Transport(), task = runLocalCsvImport(file(), { signal: new AbortController().signal, createWorker: () => worker });
    worker[kind]?.({} as ErrorEvent & MessageEvent);
    await expect(task).rejects.toThrow('unavailable'); expect(worker.terminated).toBe(true);
  }
  vi.useFakeTimers(); const worker = new Transport();
  const task = runLocalCsvImport(file(), { signal: new AbortController().signal, createWorker: () => worker });
  const assertion = expect(task).rejects.toThrow('stopped responding');
  await vi.advanceTimersByTimeAsync(60_000); await assertion;
  expect(worker.terminated).toBe(true);
});

async function header() {
  const dataset = (await importDatasetBuffer(await file().arrayBuffer(), 'study.csv', 'csv')).dataset!;
  const { rows: _rows, previewRows: _preview, ...value } = dataset;
  return value;
}
it.each(['duplicate phase', 'remote header', 'wrong filename', 'bad preview', 'oversize header', 'wrong order', 'bad column', 'nonstring', 'extra rows', 'oversize packet', 'early end', 'unknown'])('rejects %s without returning partial data', async kind => {
  const worker = new Transport(), task = runLocalCsvImport(file(), { signal: new AbortController().signal, createWorker: () => worker });
  const assertion = expect(task).rejects.toThrow();
  worker.emit({ type: 'phase', phase: 'reading' });
  if (kind === 'duplicate phase') worker.emit({ type: 'phase', phase: 'reading' });
  worker.emit({ type: 'phase', phase: 'parsing' });
  let value = await header();
  if (kind === 'remote header') value = { ...value, sourceType: 'netlify' };
  if (kind === 'wrong filename') value.fileName = 'another.csv';
  worker.emit({ type: 'header', json: kind === 'oversize header' ? 'x'.repeat(2 * 1024 * 1024 + 1) : JSON.stringify(value), previewIndexes: kind === 'bad preview' ? [2] : [0, 1] });
  const good = [{ Region: 'North', Score: '10' }, { Region: 'South', Score: '20' }];
  worker.emit({ type: kind === 'unknown' ? 'surprise' : 'rows', sequence: kind === 'wrong order' ? 1 : 0, start: 0,
    json: kind === 'bad column' ? '[{"Wrong":"x","Score":"1"}]' : kind === 'nonstring' ? '[{"Region":"N","Score":1}]' :
      kind === 'extra rows' ? JSON.stringify([...good, good[0]]) : kind === 'oversize packet' ? 'x'.repeat(localCsvPacketChars + 1) : kind === 'early end' ? JSON.stringify(good.slice(0, 1)) : JSON.stringify(good) });
  worker.emit({ type: 'complete' });
  await assertion; expect(worker.terminated).toBe(true);
});

it("rejects unsupported and oversized files before worker creation", async () => {
  const createWorker = vi.fn();
  for (const source of [new File(['x'], 'study.sav'), new File([], 'empty.csv'), new File([new Uint8Array(16 * 1024 * 1024 + 1)], 'big.csv')]) {
    await expect(runLocalCsvImport(source, { signal: new AbortController().signal, createWorker })).rejects.toThrow('CSV file');
  }
  expect(createWorker).not.toHaveBeenCalled();
});

it("rejects long-header amplification in the actual parser/controller before any study is delivered", async () => {
  const worker = new Transport(true), phases: string[] = [];
  await expect(runLocalCsvImport(file('H'.repeat(100_000) + '\n' + 'x\n'.repeat(6_000)), {
    signal: new AbortController().signal, createWorker: () => worker, onProgress: p => phases.push(p.phase),
  })).rejects.toThrow('Expanded study rows');
  expect(phases).toEqual(['reading', 'parsing']); expect(worker.terminated).toBe(true);
});

it("independently bounds total expanded delivery before returning any partial dataset", async () => {
  const source = file(), worker = new Transport(), progress: number[] = [];
  const task = runLocalCsvImport(source, { signal: new AbortController().signal, createWorker: () => worker, onProgress: p => { if (p.phase === 'receiving') progress.push(p.received); } });
  const assertion = expect(task).rejects.toThrow('Expanded CSV rows');
  const column = 'H'.repeat(100_000);
  const data = (await importDatasetBuffer(new TextEncoder().encode(`${column}\nx`).buffer, source.name, 'csv')).dataset!;
  const { rows: _rows, previewRows: _preview, ...metadata } = data;
  metadata.rowCount = 200;
  worker.emit({ type: 'phase', phase: 'reading' }); worker.emit({ type: 'phase', phase: 'parsing' });
  worker.emit({ type: 'header', json: JSON.stringify(metadata), previewIndexes: [0] });
  const oneRow = JSON.stringify([{ [column]: 'x' }]);
  // Reuse one bounded string; never allocate the theoretical expanded study.
  for (let i = 0; i < 200 && !worker.terminated; i++) worker.emit({ type: 'rows', sequence: i, start: i, json: oneRow });
  await assertion; expect(worker.terminated).toBe(true); expect(progress.at(-1)).toBeLessThan(200);
  expect(progress.at(-1)).toBeGreaterThan(0);
});

it("counts duplicated-header metadata before native serialization rather than checking after allocation", async () => {
  const text = Array.from({length:20},()=> 'H'.repeat(100_000)).join(',') + '\n' + Array.from({length:20},()=> 'x').join(',');
  const native = JSON.stringify;
  const serialize = vi.spyOn(JSON, 'stringify').mockImplementation((...args: Parameters<typeof JSON.stringify>) => {
    const value = args[0];
    if (value && typeof value === 'object' && Object.hasOwn(value, 'importMetadata')) throw Error('Unsafe metadata allocation attempted');
    return native(...args);
  });
  try {
    await expect(runLocalCsvImport(file(text), { signal:new AbortController().signal,createWorker:()=>new Transport(true) })).rejects.toThrow('Study metadata exceeds');
    expect(serialize).not.toHaveBeenCalled();
  } finally { serialize.mockRestore(); }
});
