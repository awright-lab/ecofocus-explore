import type { NumericModelCase } from "./linearModelMath";
import { computeLinearModel } from "./linearModelComputation";
self.onmessage = (event: MessageEvent<{ cases: NumericModelCase[]; seed: number }>) => {
  try { self.postMessage({ type: "complete", result: computeLinearModel(event.data.cases, event.data.seed) }); }
  catch (error) { self.postMessage({ type: "failed", message: error instanceof Error ? error.message : "Model fitting failed without changing the study." }); }
};
