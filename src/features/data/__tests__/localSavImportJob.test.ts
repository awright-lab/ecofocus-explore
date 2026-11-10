import { afterEach, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { runLocalCsvImport, runLocalSavImport, type LocalCsvWorker } from "../localCsvImportJob";
import { createLocalCsvImportController, type CsvImportMessage, type CsvImportRequest } from "../localCsvImportProtocol";
import { savNumbers } from "./fixtures/savNumberFixture";
import { sav } from "./fixtures/savCaseFixture";
class Transport implements LocalCsvWorker {
  onmessage: LocalCsvWorker["onmessage"] = null; onerror: LocalCsvWorker["onerror"] = null; onmessageerror: LocalCsvWorker["onmessageerror"] = null;
  stopped = false; sent: CsvImportRequest[] = [];
  receive = createLocalCsvImportController(message => queueMicrotask(() => { if (!this.stopped) this.emit(message); }), "sav");
  constructor(public real = false) {}
  emit(message: unknown) { this.onmessage?.({ data: structuredClone(message) } as MessageEvent<CsvImportMessage>); }
  postMessage(message: CsvImportRequest) { this.sent.push(message); if (this.real) this.receive(message); }
  terminate() { this.stopped = true; }
}
const file = (compression = 0, values = [1, 2, 1, 0], name = "synthetic-local.sav") => new File([savNumbers(values, { compression, labels: [[0, "Zero"], [1, "One"], [2, "Two"]] })], name);
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it.each([0, 1])("delivers every SAV row and all parser metadata/previews for compression%s without modifying file bytes", async compression => {
  const source = file(compression, Array.from({ length: 1250 }, (_, i) => i % 3)), bytes = new Uint8Array(await source.arrayBuffer()), original = (await importDatasetBuffer(await source.arrayBuffer(), source.name, "sav")).dataset!, worker = new Transport(true), progress: unknown[] = [];
  const parsed = await runLocalSavImport(source, { signal: new AbortController().signal, createWorker: () => worker, onProgress: p => progress.push(p) });
  expect(parsed.fileType).toBe("sav"); expect(parsed.rows).toEqual(original.rows); expect(parsed.fields).toEqual(original.fields); expect(parsed.previewRows).toEqual(original.previewRows); expect(parsed.importMetadata).toEqual(original.importMetadata); expect(parsed.notes).toEqual(original.notes); expect(new Uint8Array(await source.arrayBuffer())).toEqual(bytes); expect(worker.sent.filter(m => m.type === "ack")).toHaveLength(3); expect(progress).toContainEqual({ phase: "receiving", received: 1250, total: 1250 }); expect(worker.stopped).toBe(true);
});
it("retains supported finite endpoints and declared missing values through transport", async () => {
  const values = [Number.MIN_VALUE, Number.MAX_VALUE, -1e200, 0, 5], source = new File([savNumbers(values, { compression: 1, missing: -1e200 })], "range.sav"), worker = new Transport(true); const parsed = await runLocalSavImport(source, { signal: new AbortController().signal, createWorker: () => worker }); expect(parsed.rows.map(r => r.AMOUNT)).toEqual([String(Number.MIN_VALUE), String(Number.MAX_VALUE), "", "0", "5"]);
});
it("waits for matching acknowledgements instead of queuing complete SAV rows on the main thread", async () => {
  const messages: CsvImportMessage[] = [], control = createLocalCsvImportController(m => messages.push(m), "sav"); control({ type: "start", file: file(0, Array.from({ length: 501 }, (_, i) => i % 3)), name: "synthetic-local.sav" }); await vi.waitFor(() => expect(messages.some(m => m.type === "rows")).toBe(true)); control({ type: "ack", sequence: 42 }); await Promise.resolve(); expect(messages.filter(m => m.type === "rows")).toHaveLength(1); control({ type: "ack", sequence: 0 }); await vi.waitFor(() => expect(messages.filter(m => m.type === "rows")).toHaveLength(2)); expect(messages.some(m => m.type === "complete")).toBe(false); control({ type: "ack", sequence: 1 }); await vi.waitFor(() => expect(messages.some(m => m.type === "complete")).toBe(true));
});
it.each(["truncated", "too-many-cases", "wrong-signature", "unsupported-compression"] as const)("refuses%s without a partial dataset or alternate parser", async kind => {
  let buffer = sav(0); if (kind === "truncated") buffer = buffer.slice(0, -1); if (kind === "too-many-cases") new DataView(buffer).setInt32(80, 4, true); if (kind === "wrong-signature") new Uint8Array(buffer)[0] = 0; if (kind === "unsupported-compression") new DataView(buffer).setInt32(72, 2, true);
  const source = new File([buffer], "invalid.sav"), before = new Uint8Array(await source.arrayBuffer()), worker = new Transport(true); await expect(runLocalSavImport(source, { signal: new AbortController().signal, createWorker: () => worker })).rejects.toThrow(); expect(worker.stopped).toBe(true); expect(new Uint8Array(await source.arrayBuffer())).toEqual(before);
});
it.each(["reading", "parsing", "receiving"] as const)("cancels SAV during%s and rejects detached late completion", async phase => {
  const worker = new Transport(true), abort = new AbortController(); await expect(runLocalSavImport(file(), { signal: abort.signal, createWorker: () => worker, onProgress: p => { if (p.phase === phase) abort.abort(); } })).rejects.toMatchObject({ name: "AbortError" }); expect(worker.stopped).toBe(true); expect(worker.onmessage).toBeNull(); worker.emit({ type: "complete" });
});
it("rejects CSV/SAV format substitution at input and response boundaries while default CSV remains unchanged", async () => {
  const createWorker = vi.fn(); await expect(runLocalCsvImport(file(), { signal: new AbortController().signal, createWorker })).rejects.toThrow("CSV"); await expect(runLocalSavImport(new File(["A\n1"], "a.csv"), { signal: new AbortController().signal, createWorker })).rejects.toThrow("SAV"); expect(createWorker).not.toHaveBeenCalled();
  const worker = new Transport(), task = runLocalSavImport(file(), { signal: new AbortController().signal, createWorker: () => worker }), assertion = expect(task).rejects.toThrow(); const original = (await importDatasetBuffer(await file().arrayBuffer(), file().name, "sav")).dataset!, { rows: _rows, previewRows: _preview, ...header } = original; worker.emit({ type: "phase", phase: "reading" }); worker.emit({ type: "phase", phase: "parsing" }); worker.emit({ type: "header", json: JSON.stringify({ ...header, fileType: "csv" }), previewIndexes: [] }); await assertion; expect(worker.stopped).toBe(true);
});
it.each(["onerror", "onmessageerror", "timeout", "startup", "aborted"] as const)("retains SAV input and rejects%s lifecycle failure", async kind => {
  const worker = new Transport(), abort = new AbortController(); if (kind === "aborted") abort.abort(); if (kind === "timeout") vi.useFakeTimers(); const createWorker = vi.fn(() => { if (kind === "startup") throw Error("worker denied"); return worker; }); const task = runLocalSavImport(file(), { signal: abort.signal, createWorker }); const assertion = expect(task).rejects.toThrow(); if (kind === "onerror" || kind === "onmessageerror") worker[kind]?.({} as ErrorEvent & MessageEvent); if (kind === "timeout") await vi.advanceTimersByTimeAsync(60000); await assertion; if (kind === "aborted") expect(createWorker).not.toHaveBeenCalled();
});
it("settles cancellation even when a worker termination call throws, with late acceptance revoked", async () => {
  const worker = new Transport(), abort = new AbortController(); vi.spyOn(worker, "terminate").mockImplementation(() => { throw Error("synthetic termination refusal"); }); const task = runLocalSavImport(file(), { signal: abort.signal, createWorker: () => worker }); const late = worker.onmessage; abort.abort(); await expect(task).rejects.toMatchObject({ name: "AbortError" }); expect(worker.onmessage).toBeNull(); late?.({ data: { type: "complete" } } as MessageEvent<CsvImportMessage>);
});

it.each(["remote", "extra-header", "wrong-name", "bad-preview", "out-of-order", "missing-cell", "numeric-cell", "early-end"] as const)("rejects SAV %s packets before returning a dataset", async kind => {
 const source = file(), worker = new Transport(), task = runLocalSavImport(source, { signal: new AbortController().signal, createWorker: () => worker }), assertion = expect(task).rejects.toThrow(); const direct = (await importDatasetBuffer(await source.arrayBuffer(), source.name, "sav")).dataset!, { rows: _rows, previewRows: _preview, ...header } = direct;
 worker.emit({ type: "phase", phase: "reading" }); worker.emit({ type: "phase", phase: "parsing" });
 worker.emit({ type: "header", json: JSON.stringify({ ...header, ...(kind === "remote" ? { sourceType: "netlify" } : kind === "extra-header" ? { remote: { provider: "netlify" } } : kind === "wrong-name" ? { fileName: "another.sav" } : {}) }), previewIndexes: kind === "bad-preview" ? [-1] : [] });
 if (["out-of-order", "missing-cell", "numeric-cell"].includes(kind)) worker.emit({ type: "rows", sequence: kind === "out-of-order" ? 1 : 0, start: 0, json: JSON.stringify([kind === "missing-cell" ? { ID: "1" } : { ID: "1", AMOUNT: kind === "numeric-cell" ? 1 : "1" }]) });
 if (kind === "early-end") worker.emit({ type: "complete" }); await assertion; expect(worker.stopped).toBe(true); expect(worker.onmessage).toBeNull();
});
