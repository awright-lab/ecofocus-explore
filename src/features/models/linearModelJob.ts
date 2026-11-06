import { splitModelCases, type NumericModelCase, type LinearModelMetrics } from "./linearModelMath";
import { collectModelRow, initialModelCoverage, modelSourceMatches, projectModelRow, resolveLinearModelContext, type ModelCoverage, type ModelInputProjection, type ModelSourceContext, type ResolvedLinearModel } from "./linearModelContext";
import type { LinearModelComputation } from "./linearModelComputation";

export interface LinearModelWorker {
  postMessage: (value: { cases: NumericModelCase[]; seed: number }) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}
export interface LinearModelRun extends LinearModelComputation {
  context: ResolvedLinearModel;
  coverage: ModelCoverage;
  seed: number;
  sourceStillCurrent: () => boolean;
}
export interface ModelProgress { phase: "preparing" | "fitting"; prepared: number; total: number }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function validMetrics(value: LinearModelMetrics, cases: NumericModelCase[], training: boolean): boolean {
  if (!value || value.rows !== cases.length || ![value.rmse, value.mae, value.baselineRmse].every(item => finite(item) && item >= 0) || !finite(value.residualMean) || value.rSquared !== null && (!finite(value.rSquared) || value.rSquared > 1 + 1e-9) || value.adjustedRSquared !== null && (!finite(value.adjustedRSquared) || !training) || !Array.isArray(value.diagnostics) || value.diagnostics.length !== cases.length) return false;
  const expected = new Map(cases.map(row => [row.row, row.outcome])), seen = new Set<number>();
  for (const item of value.diagnostics) {
    if (!item || seen.has(item.row) || !expected.has(item.row) || item.actual !== expected.get(item.row) || !finite(item.predicted) || !finite(item.residual) || typeof item.outsideTrainingRange !== "boolean" || Math.abs(item.actual - item.predicted - item.residual) > 1e-8 * Math.max(1, Math.abs(item.actual), Math.abs(item.predicted)) || (training ? !finite(item.leverage) || item.leverage < 0 || item.leverage > 1 : item.leverage !== null)) return false;
    seen.add(item.row);
  }
  return true;
}
function validComputation(result: LinearModelComputation, cases: NumericModelCase[], seed: number, predictors: number): boolean {
  if (!result?.fit) return false;
  const split = splitModelCases(cases, seed), fit = result.fit;
  if (fit.trainingRows !== split.training.length || ![fit.intercept, fit.centeredIntercept, fit.outcomeMean].every(finite) || !finite(fit.outcomeScale) || fit.outcomeScale <= 0) return false;
  if (![fit.coefficients, fit.standardizedCoefficients, fit.predictorMeans, fit.predictorScales, fit.vif].every(values => Array.isArray(values) && values.length === predictors && values.every(finite)) || fit.predictorScales.some(value => value <= 0) || fit.vif.some(value => value < 1) || !Array.isArray(fit.predictorRanges) || fit.predictorRanges.length !== predictors || fit.predictorRanges.some(range => !range || !finite(range.min) || !finite(range.max) || range.min > range.max)) return false;
  if (!Array.isArray(fit.inverseR) || fit.inverseR.length !== predictors + 1 || fit.inverseR.some(row => !Array.isArray(row) || row.length !== predictors + 1 || !row.every(finite))) return false;
  return validMetrics(result.training, split.training, true) && validMetrics(result.holdout, split.holdout, false);
}
export function runLinearModelJob(input: ModelSourceContext, options: {
  signal: AbortSignal;
  onProgress?: (progress: ModelProgress) => void;
  getCurrentContext?: () => ModelSourceContext;
  createWorker?: () => LinearModelWorker;
}): Promise<LinearModelRun> {
  return new Promise((resolve, reject) => {
    let finished = false, worker: LinearModelWorker | undefined, timer: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
    let context: ResolvedLinearModel;
    try { context = resolveLinearModelContext(input); } catch (error) { reject(error); return; }
    const coverage = initialModelCoverage(context), projection: ModelInputProjection[] = [], cases: NumericModelCase[] = [], seed = input.plan.seed;
    const current = options.getCurrentContext ?? (() => input);
    const sourceStillCurrent = () => { try { return modelSourceMatches(current(), context.binding, projection); } catch { return false; } };
    function finish(error?: unknown, result?: LinearModelRun) {
      if (finished) return; finished = true;
      if (timer !== undefined) clearTimeout(timer);
      if (deadline !== undefined) clearTimeout(deadline);
      options.signal.removeEventListener("abort", abort); worker?.terminate();
      if (error) reject(error); else resolve(result!);
    }
    function abort() { finish(new DOMException("Model fitting canceled; no study or report was changed.", "AbortError")); }
    if (options.signal.aborted) { abort(); return; }
    options.signal.addEventListener("abort", abort, { once: true });
    function prepare() {
      if (finished) return;
      try {
        const end = Math.min(coverage.total, projection.length + 500);
        for (let index = projection.length; index < end; index++) { const value = projectModelRow(context, index); projection.push(value); const row = collectModelRow(value, index, coverage); if (row) cases.push(row); }
        options.onProgress?.({ phase: "preparing", prepared: projection.length, total: coverage.total });
        if (finished) return;
        if (projection.length < coverage.total) { timer = setTimeout(prepare, 0); return; }
        if (cases.length < 50) throw Error(`Only ${cases.length} complete audience rows remain. This exploratory workflow requires at least 50; that guard does not establish statistical reliability.`);
        if (!sourceStillCurrent()) throw Error("The source or settings changed during preparation. Review and fit again.");
        try { worker = options.createWorker ? options.createWorker() : new Worker(new URL("./linearModel.worker.ts", import.meta.url), { type: "module" }); }
        catch { throw Error("Background modelling could not start in this browser. Your study and report are preserved."); }
        worker.onmessage = event => {
          if (finished) return;
          try {
            if (event.data?.type === "failed") throw Error(typeof event.data.message === "string" ? event.data.message : "The model could not be fitted.");
            if (!sourceStillCurrent()) throw Error("The source or settings changed before model completion. Review and fit again.");
            const result = event.data?.result as LinearModelComputation;
            if (event.data?.type !== "complete" || !validComputation(result, cases, seed, context.predictors.length)) throw Error("The background model returned an invalid result. No report or study was changed.");
            finish(undefined, { ...result, context, coverage, seed, sourceStillCurrent });
          } catch (error) { finish(error); }
        };
        worker.onerror = worker.onmessageerror = () => finish(Error("The background model is unavailable. Retry or close this exploration; your data is preserved."));
        deadline = setTimeout(() => finish(Error("The model exceeded its 30-second calculation limit. Try fewer predictors; no data was changed.")), 30000);
        options.onProgress?.({ phase: "fitting", prepared: projection.length, total: coverage.total });
        if (!finished) worker.postMessage({ cases, seed });
      } catch (error) { finish(error instanceof Error ? error : Error("The background model could not start; your data is preserved.")); }
    }
    timer = setTimeout(prepare, 0);
  });
}
