import { evaluateLinearModel, fitLinearModel, splitModelCases, type NumericModelCase } from "./linearModelMath";
export interface LinearModelComputation { fit: ReturnType<typeof fitLinearModel>; training: ReturnType<typeof evaluateLinearModel>; holdout: ReturnType<typeof evaluateLinearModel> }
export function computeLinearModel(cases: NumericModelCase[], seed: number): LinearModelComputation {
  if (new Set(cases.map(row => row.outcome)).size < 3) throw Error("Choose a quantitative outcome with at least three different complete values; binary-outcome models are outside this workflow.");
  const split = splitModelCases(cases, seed), fit = fitLinearModel(split.training);
  return { fit, training: evaluateLinearModel(fit, split.training, true), holdout: evaluateLinearModel(fit, split.holdout) };
}
