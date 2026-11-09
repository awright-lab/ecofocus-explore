import { afterEach, expect, it, vi } from "vitest";
import { HeldProfileWorker, profileStudy, startProfile } from "./fixtures/profileDeadlineFixture";
import { buildImportedNumericProfile } from "../importedNumericProfile";
import { buildImportedCategoricalProfile } from "../importedCategoricalProfile";
afterEach(() => vi.useRealTimers());
const kinds = ["numeric", "categorical"] as const;
it.each(kinds)("rejects %s mixed values changed after a preparation chunk", async kind => {
 const dataset = await profileStudy(6000), worker = new HeldProfileWorker(), controller = new AbortController(); vi.useFakeTimers(); let changed = false;
 const task = startProfile(kind, dataset, worker, controller.signal, () => { if (!changed) { changed = true; dataset.rows[0][kind === "numeric" ? "Amount" : "Category"] = kind === "numeric" ? "99" : "Changed"; } });
 const rejected = expect(task).rejects.toThrow(/source.*changed/i); await vi.advanceTimersByTimeAsync(100); const before = structuredClone(dataset); worker.complete(); await rejected; expect(worker.terminate).toHaveBeenCalledOnce(); expect(dataset).toEqual(before);
});
it.each(kinds.flatMap(kind => ["values", "mapping", "labels", "import", "row array", "coverage", "storage mode", "source ref", "registered field"].map(change => ({ kind, change }))))("rejects stale %j context before accepting a profile", async ({ kind, change }) => {
 const dataset = await profileStudy(), worker = new HeldProfileWorker(), controller = new AbortController(), field = dataset.fields[kind === "numeric" ? 1 : 0]; vi.useFakeTimers();
 const task = startProfile(kind, dataset, worker, controller.signal), rejected = expect(task).rejects.toThrow(/source.*changed/i); await vi.advanceTimersByTimeAsync(100);
 if (change === "values") dataset.rows[1][field.sourceColumn] = "Changed";
 if (change === "mapping") field.sourceColumn = "Tag";
 if (change === "labels") field.valueLabels = { A: "New label" };
 if (change === "import") dataset.importedAt = "2026-11-08T23:00:00.000Z";
 if (change === "row array") dataset.rows = dataset.rows.slice();
 if (change === "coverage") dataset.rowCount++;
 if (change === "storage mode") { dataset.previewRows = dataset.rows; dataset.rows = []; }
 if (change === "source ref") dataset.sourceRef = { kind: "live_connection", provider: "snowflake", datasetId: dataset.id } as never;
 if (change === "registered field") dataset.fields = dataset.fields.map(f => f.id === field.id ? { ...f, sourceColumn: "Tag" } : f);
 const before = structuredClone(dataset); worker.complete(); await rejected; expect(worker.terminate).toHaveBeenCalledOnce(); expect(dataset).toEqual(before); expect(vi.getTimerCount()).toBe(0);
});
it.each(kinds)("retains %s parity and ignores unrelated column edits", async kind => {
 const dataset = await profileStudy(6000), worker = new HeldProfileWorker(); vi.useFakeTimers(); const task = startProfile(kind, dataset, worker, new AbortController().signal); await vi.advanceTimersByTimeAsync(100);
 dataset.rows[0].Tag = "Edited unrelated value"; const before = structuredClone(dataset); worker.complete(); await vi.advanceTimersByTimeAsync(100);
 expect(await task).toEqual(kind === "numeric" ? buildImportedNumericProfile(dataset, dataset.fields[1]) : buildImportedCategoricalProfile(dataset, dataset.fields[0])); expect(dataset).toEqual(before); expect(worker.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it.each(kinds)("checks later %s verification chunks and remains cancelable", async kind => {
 const dataset = await profileStudy(6000), worker = new HeldProfileWorker(), controller = new AbortController(); vi.useFakeTimers(); const task = startProfile(kind, dataset, worker, controller.signal), rejected = expect(task).rejects.toMatchObject({ name: "AbortError" });
 await vi.advanceTimersByTimeAsync(100); worker.complete(); controller.abort(); await vi.advanceTimersByTimeAsync(100); await rejected; expect(worker.terminate).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it.each(kinds)("rejects %s changes in a later verification chunk and ignores duplicate completion", async kind => {
 const dataset = await profileStudy(6000), worker = new HeldProfileWorker(); vi.useFakeTimers(); const task = startProfile(kind, dataset, worker, new AbortController().signal), rejected = expect(task).rejects.toThrow(/source.*changed/i);
 await vi.advanceTimersByTimeAsync(100); worker.complete(); dataset.rows[5999][kind === "numeric" ? "Amount" : "Category"] = "Changed"; worker.complete(); const before = structuredClone(dataset); await vi.advanceTimersByTimeAsync(100); await rejected; expect(worker.terminate).toHaveBeenCalledOnce(); expect(dataset).toEqual(before); expect(vi.getTimerCount()).toBe(0);
});

it.each(kinds)("rejects %s changes to an already verified chunk before final acceptance", async kind => {
 const dataset = await profileStudy(6000), worker = new HeldProfileWorker(); vi.useFakeTimers(); const task = startProfile(kind, dataset, worker, new AbortController().signal), rejected = expect(task).rejects.toThrow(/source.*changed/i);
 await vi.advanceTimersByTimeAsync(100); worker.complete(); dataset.rows[0][kind === "numeric" ? "Amount" : "Category"] = "Changed"; const before = structuredClone(dataset); await vi.advanceTimersByTimeAsync(100); await rejected; expect(worker.terminate).toHaveBeenCalledOnce(); expect(dataset).toEqual(before);
});
