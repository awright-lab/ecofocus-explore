import { collectMultiResponseRow, initialMultiResponseCoverage, multiResponseSourceMatches, projectMultiResponseRow, resolveMultiResponseContext, summarizeMultiResponsePatterns, type MultiResponseContext, type MultiResponseCoverage, type MultiResponseProjection, type MultiResponseResult, type ResolvedMultiResponse } from "./multiResponseModel";

export interface MultiResponseRun { context: ResolvedMultiResponse; coverage: MultiResponseCoverage; result: MultiResponseResult; sourceStillCurrent: () => boolean }
export function runMultiResponseJob(input: MultiResponseContext, options: { signal: AbortSignal; getCurrentContext?: () => MultiResponseContext; onProgress?: (done: number, total: number) => void }): Promise<MultiResponseRun> {
  return new Promise((resolve, reject) => {
    let context: ResolvedMultiResponse;
    try { context = resolveMultiResponseContext(input); } catch (problem) { reject(problem); return; }
    const coverage = initialMultiResponseCoverage(context), projection: MultiResponseProjection[] = [], ids = new Set<string>(), frequencies = new Uint32Array(2 ** context.options.length);
    let timer: ReturnType<typeof setTimeout> | undefined, finished = false;
    const sourceStillCurrent = () => multiResponseSourceMatches(options.getCurrentContext?.() ?? input, context.binding, projection);
    function finish(problem?: unknown, result?: MultiResponseRun) {
      if (finished) return; finished = true;
      if (timer !== undefined) clearTimeout(timer); options.signal.removeEventListener("abort", abort);
      if (problem) reject(problem); else resolve(result!);
    }
    function abort() { finish(new DOMException("Multiple-response analysis canceled. No study or report was changed.", "AbortError")); }
    if (options.signal.aborted) { abort(); return; }
    options.signal.addEventListener("abort", abort, { once: true });
    function batch() {
      if (finished) return;
      try {
        const end = Math.min(context.dataset.rows.length, projection.length + 500);
        for (let index = projection.length; index < end; index++) {
          const row = projectMultiResponseRow(context, index); projection.push(row);
          const mask = collectMultiResponseRow(context, row, index, ids, coverage); if (mask !== null) frequencies[mask]++;
        }
        options.onProgress?.(projection.length, coverage.total); if (finished) return;
        if (projection.length < coverage.total) { timer = setTimeout(batch, 0); return; }
        const result = summarizeMultiResponsePatterns(frequencies, context.options.length);
        if (!sourceStillCurrent()) throw Error("The source, audience or mappings changed during analysis. Review the current inputs and run again.");
        finish(undefined, { context, coverage, result, sourceStillCurrent });
      } catch (problem) { finish(problem instanceof Error ? problem : Error("Multiple-response analysis failed; your data is preserved.")); }
    }
    timer = setTimeout(batch, 0);
  });
}
