import { beforeEach, afterEach, expect, it, vi } from "vitest";
import reference from "./linear-model-numpy-reference.json";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { computeLinearModel } from "../linearModelComputation";
import { resolveLinearModelContext, initialModelCoverage, collectModelRow, modelSourceMatches, projectModelRow, type ModelSourceContext } from "../linearModelContext";
import { runLinearModelJob, type LinearModelWorker } from "../linearModelJob";
import type { NumericModelCase } from "../linearModelMath";
class FakeWorker implements LinearModelWorker {
  onmessage: LinearModelWorker["onmessage"] = null; onerror: LinearModelWorker["onerror"] = null; onmessageerror: LinearModelWorker["onmessageerror"] = null;
  terminate = vi.fn(); posted?: { cases: NumericModelCase[]; seed: number }; auto = true;
  postMessage(value: { cases: NumericModelCase[]; seed: number }) { this.posted = structuredClone(value); if (this.auto) this.complete(); }
  complete() { const result = computeLinearModel(this.posted!.cases, this.posted!.seed); this.onmessage?.({ data: { type: "complete", result } } as MessageEvent); }
}
async function fixture() {
  const csv = ["Outcome,PredictorA,PredictorB,Group", ...reference.cases.map((row, index) => `${row.outcome},${row.predictors[0]},${row.predictors[1]},${index % 2 ? "B" : "A"}`)].join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic-model.csv");
  const draft = structuredClone(initialDashboard); draft.importedDatasets = [];
  const context: ModelSourceContext = { draft, studies: [dataset!], plan: { reportId: draft.id, datasetId: dataset!.id, importedAt: dataset!.importedAt, outcomeId: dataset!.fields[0].id, predictorIds: dataset!.fields.slice(1, 3).map(field => field.id), audienceId: "", seed: reference.seed } };
  return context;
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("No services in model tests"))); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("fits through the worker, transfers only chosen numbers and preserves the full source/report", async () => {
  const context = await fixture(), original = structuredClone(context), worker = new FakeWorker(), progress = vi.fn();
  const promise = runLinearModelJob(context, { signal: new AbortController().signal, createWorker: () => worker, onProgress: progress });
  await vi.runAllTimersAsync(); const result = await promise;
  expect(result.coverage).toMatchObject({ total: 180, included: 180, complete: 180, incomplete: 0 });
  expect(result.fit.intercept).toBeCloseTo(reference.intercept, 10); expect(result.holdout.rmse).toBeCloseTo(reference.holdout.rmse, 10);
  expect(Object.keys(worker.posted!)).toEqual(["cases", "seed"]); expect(worker.posted!.cases[0].predictors).toHaveLength(2); expect(JSON.stringify(worker.posted)).not.toContain('"Group"');
  expect(worker.terminate).toHaveBeenCalledOnce(); expect(result.sourceStillCurrent()).toBe(true); expect(context).toEqual(original); expect(fetch).not.toHaveBeenCalled();
});
it("keeps audience exclusions/unknowns and complete-case missingness separate", async () => {
  const context = await fixture(), data = context.studies[0], group = data.fields[3];
  context.draft.savedAudiences = [{ version: 1, id: "audience-a", label: "A", datasetId: data.id, importedAt: data.importedAt, expression: { kind: "category", fieldId: group.id, sourceColumn: group.sourceColumn, values: ["A"], exclude: false } }]; context.plan.audienceId = "audience-a";
  data.rows[0].Outcome = ""; data.rows[1].PredictorA = "bad"; data.rows[2].Group = "";
  const promise = runLinearModelJob(context, { signal: new AbortController().signal, createWorker: () => new FakeWorker() }); await vi.runAllTimersAsync(); const result = await promise;
  expect(result.coverage).toMatchObject({ total: 180, included: 89, excluded: 90, unknownAudience: 1, complete: 88, incomplete: 1 });
  expect(result.coverage.fields[0]).toMatchObject({ blank: 1, invalid: 0 }); expect(result.coverage.fields[1].invalid).toBe(0);
});
it("parses supported numeric formats without imputing blanks or invalid cells", async () => {
  const context = resolveLinearModelContext(await fixture()), coverage = initialModelCoverage(context);
  expect(collectModelRow({ membership: true, values: ["$1,000", "20%", "2e1"] }, 0, coverage)).toMatchObject({ outcome: 1000, predictors: [20, 20] });
  expect(collectModelRow({ membership: true, values: ["", "bad", "10"] }, 1, coverage)).toBeNull();
  expect(coverage).toMatchObject({ included: 2, complete: 1, incomplete: 1 }); expect(coverage.fields[0].blank).toBe(1); expect(coverage.fields[1].invalid).toBe(1);
  expect(() => collectModelRow({ membership: true, values: ["1e13", "1", "2"] }, 2, coverage)).toThrow("not silently discarded");
});
it.each(["partial", "remote", "import", "outcome as predictor", "unknown field", "duplicate mapping", "wrong report", "missing audience"])("refuses %s context before creating a worker", async kind => {
  const context = await fixture(), data = context.studies[0], createWorker = vi.fn(() => new FakeWorker());
  if (kind === "partial") data.rows.pop();
  if (kind === "remote") data.sourceType = "netlify";
  if (kind === "import") context.plan.importedAt = "2000-01-01T00:00:00Z";
  if (kind === "outcome as predictor") context.plan.predictorIds[0] = context.plan.outcomeId;
  if (kind === "unknown field") context.plan.outcomeId = "missing";
  if (kind === "duplicate mapping") data.fields[1].sourceColumn = data.fields[0].sourceColumn;
  if (kind === "wrong report") context.plan.reportId = "another-report";
  if (kind === "missing audience") context.plan.audienceId = "missing";
  await expect(runLinearModelJob(context, { signal: new AbortController().signal, createWorker })).rejects.toThrow(); expect(createWorker).not.toHaveBeenCalled();
});
it.each(["raw cells", "mapping", "audience", "settings"])("rejects %s drift while a worker is pending", async kind => {
  const context = await fixture(), worker = new FakeWorker(); worker.auto = false;
  const promise = runLinearModelJob(context, { signal: new AbortController().signal, createWorker: () => worker }); const checked = expect(promise).rejects.toThrow("changed");
  await vi.advanceTimersByTimeAsync(1);
  if (kind === "raw cells") context.studies[0].rows[0].Outcome = "999";
  if (kind === "mapping") context.studies[0].fields[0].sourceColumn = "DifferentOutcome";
  if (kind === "audience") context.plan.audienceId = "unknown";
  if (kind === "settings") context.plan.seed++;
  worker.complete(); await checked; expect(worker.terminate).toHaveBeenCalledOnce();
});
it("detects source changes after delivery, including in-place changes without a new object reference", async () => {
  const context = await fixture(), worker = new FakeWorker(); const promise = runLinearModelJob(context, { signal: new AbortController().signal, createWorker: () => worker }); await vi.runAllTimersAsync(); const run = await promise;
  context.studies[0].rows[0].Outcome = "different"; expect(run.sourceStillCurrent()).toBe(false);
});
it("cancels before preparation or during fitting and ignores a late callback", async () => {
  const context = await fixture(), first = new AbortController(), factory = vi.fn(() => new FakeWorker()); first.abort();
  await expect(runLinearModelJob(context, { signal: first.signal, createWorker: factory })).rejects.toMatchObject({ name: "AbortError" }); expect(factory).not.toHaveBeenCalled();
  const controller = new AbortController(), worker = new FakeWorker(); worker.auto = false;
  const promise = runLinearModelJob(context, { signal: controller.signal, createWorker: () => worker }); const checked = expect(promise).rejects.toMatchObject({ name: "AbortError" }); await vi.advanceTimersByTimeAsync(1); controller.abort(); worker.complete(); await checked; expect(worker.terminate).toHaveBeenCalledOnce();
});
it.each(["startup", "error", "malformed", "timeout"])("preserves data on worker %s and allows a fresh retry", async kind => {
  const context = await fixture(), original = structuredClone(context), worker = new FakeWorker(); worker.auto = false;
  const createWorker = () => { if (kind === "startup") throw Error("Unavailable"); return worker; };
  const promise = runLinearModelJob(context, { signal: new AbortController().signal, createWorker }); const checked = expect(promise).rejects.toThrow(); await vi.advanceTimersByTimeAsync(1);
  if (kind === "error") worker.onerror?.({} as ErrorEvent);
  if (kind === "malformed") worker.onmessage?.({ data: { type: "complete", result: { fit: {} } } } as MessageEvent);
  if (kind === "timeout") await vi.advanceTimersByTimeAsync(30000);
  await checked; expect(context).toEqual(original);
  const retry = runLinearModelJob(context, { signal: new AbortController().signal, createWorker: () => new FakeWorker() }); await vi.runAllTimersAsync(); expect((await retry).training.rows).toBe(144);
});
it("compares exact selected raw values/membership rather than relying on IDs or a hash", async () => {
  const input = await fixture(), context = resolveLinearModelContext(input), snapshot = context.dataset.rows.map((_, index) => projectModelRow(context, index));
  expect(modelSourceMatches(input, context.binding, snapshot)).toBe(true); input.studies[0].rows[0].PredictorA = "100"; expect(modelSourceMatches(input, context.binding, snapshot)).toBe(false);
});
