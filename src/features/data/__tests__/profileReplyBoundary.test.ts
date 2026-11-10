import { afterEach, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { runNumericProfileJob, type NumericProfileWorker } from "../numericProfileJob";
import { runCategoricalProfileJob } from "../categoricalProfileJob";
import { runColumnProfileJob } from "../columnProfileJob";
import { buildNumericProfileFromValues } from "../importedNumericProfile";
import { buildCategoricalProfileFromValues } from "../importedCategoricalProfile";
afterEach(() => vi.useRealTimers());
async function fixture() { const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Value\n1\n3\n").buffer, "synthetic-profile-reply.csv"); if (!dataset) throw Error("fixture"); return { dataset, field: dataset.fields[0] }; }
function worker(): NumericProfileWorker { return { onmessage: null, onerror: null, onmessageerror: null, postMessage: vi.fn(), terminate: vi.fn() }; }
it("rejects a count-consistent numeric reply with a missing distribution before it can reach the renderer", async () => {
  const f = await fixture(), w = worker(), before = structuredClone(f.dataset); vi.useFakeTimers(); const pending = runNumericProfileJob(f.dataset, f.field, { signal: new AbortController().signal, createWorker: () => w }), outcome = pending.then(() => "accepted", error => error.message);
  await vi.advanceTimersByTimeAsync(100); const profile = buildNumericProfileFromValues(["1", "3"]) as Record<string, unknown>; delete profile.distribution; w.onmessage!({ data: { type: "complete", profile } } as MessageEvent);
  expect(await outcome).toMatch(/background.*failed/i); expect(w.terminate).toHaveBeenCalledOnce(); expect(f.dataset).toEqual(before);
});
it("rejects category labels that cannot be rendered as text", async () => {
  const f = await fixture(), w = worker(); f.field.type = "categorical"; vi.useFakeTimers(); const pending = runCategoricalProfileJob(f.dataset, f.field, { signal: new AbortController().signal, createWorker: () => w }), outcome = pending.then(() => "accepted", error => error.message); await vi.advanceTimersByTimeAsync(100);
  const profile = buildCategoricalProfileFromValues(["1", "3"], f.field); if (profile.status !== "ready") throw Error("profile"); Object.assign(profile.categories[0], { label: { wrong: true } }); w.onmessage!({ data: { type: "complete", profile } } as MessageEvent); expect(await outcome).toMatch(/background.*failed/i); expect(w.terminate).toHaveBeenCalledOnce();
});
it("rejects a category percentage inconsistent with its own count and base", async () => {
  const f = await fixture(), w = worker(); f.field.type = "categorical"; vi.useFakeTimers(); const pending = runCategoricalProfileJob(f.dataset, f.field, { signal: new AbortController().signal, createWorker: () => w }), outcome = pending.then(() => "accepted", error => error.message); await vi.advanceTimersByTimeAsync(100);
  const profile = buildCategoricalProfileFromValues(["1", "3"], f.field); if (profile.status !== "ready") throw Error("profile"); profile.categories[0].share = 999; w.onmessage!({ data: { type: "complete", profile } } as MessageEvent); expect(await outcome).toMatch(/background.*failed/i); expect(w.terminate).toHaveBeenCalledOnce();
});
it("settles and terminates when a reply validator throws instead of leaking an event-handler exception", async () => {
  const f = await fixture(), w = worker(), controller = new AbortController(); vi.useFakeTimers();
  const pending = runColumnProfileJob<unknown, { values: string[] }>(f.dataset, f.field, { signal: controller.signal, createWorker: () => w, title: "test summary", request: values => ({ values }), accept: (_value: unknown): _value is unknown => { throw Error("validator failed"); } }), outcome = pending.then(() => "accepted", error => error.message); await vi.advanceTimersByTimeAsync(100);
  let exception: unknown; try { w.onmessage!({ data: { type: "complete", profile: {} } } as MessageEvent); } catch (error) { exception = error; } controller.abort(); const message = await outcome;
  expect(exception).toBeUndefined(); expect(message).toMatch(/background.*failed/i); expect(w.terminate).toHaveBeenCalledOnce();
});
