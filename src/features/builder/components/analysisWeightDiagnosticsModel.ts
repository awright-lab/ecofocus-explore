import { defaultDataset } from "../builderConstants";
import type { WeightId } from "../../../../shared/types/analytics";

export interface AnalysisWeightDiagnosticsView {
  status: "weighted" | "unweighted";
  label: string;
  value: string;
  defaultLabel: string;
  differsFromDefault: boolean;
  helper: string;
  chips: string[];
}

function weightLabel(weight: WeightId | null) {
  if (!weight) return "Unweighted";
  return defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight;
}

export function buildAnalysisWeightDiagnostics(weight: WeightId | null): AnalysisWeightDiagnosticsView {
  const defaultWeight = defaultDataset.defaultWeight;
  const isWeighted = Boolean(weight);
  const differsFromDefault = weight !== defaultWeight;
  const value = weightLabel(weight);
  const defaultLabel = weightLabel(defaultWeight);

  return {
    status: isWeighted ? "weighted" : "unweighted",
    label: isWeighted ? "Weighted analysis" : "Unweighted analysis",
    value,
    defaultLabel,
    differsFromDefault,
    helper: differsFromDefault
      ? `This analysis uses ${value.toLowerCase()}, which differs from the dataset default of ${defaultLabel}.`
      : `This analysis uses the dataset default weighting: ${defaultLabel}.`,
    chips: [
      isWeighted ? "Weighted" : "Unweighted",
      differsFromDefault ? "Differs from dataset default" : "Dataset default",
      `Default: ${defaultLabel}`
    ]
  };
}
