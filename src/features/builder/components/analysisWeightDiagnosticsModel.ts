import { defaultDataset } from "../builderConstants";
import type { FilterFieldId, QuestionId, WeightId } from "../../../../shared/types/analytics";

export interface AnalysisWeightDiagnosticsView {
  status: "weighted" | "unweighted";
  label: string;
  value: string;
  defaultLabel: string;
  differsFromDefault: boolean;
  helper: string;
  chips: string[];
}

export interface AnalysisContextMismatchView {
  label: string;
  message: string;
  helper: string;
  chips: string[];
}

export type AnalysisWeightMismatchView = AnalysisContextMismatchView;

export function weightLabel(weight: WeightId | null) {
  if (!weight) return "Unweighted";
  return defaultDataset.weights.find((item) => item.id === weight)?.label ?? weight;
}

type AnalysisFilterField = FilterFieldId | QuestionId;

function normalizeFilter(field: AnalysisFilterField | null, value: string) {
  if (!field || value === "all") {
    return { field: null, value: "all" };
  }
  return { field, value };
}

export function filterLabel(field: AnalysisFilterField | null, value: string) {
  const filter = normalizeFilter(field, value);
  if (!filter.field) return "No filter";

  const dimension = defaultDataset.dimensions.find((item) => item.id === filter.field);
  const valueLabel = dimension?.values.find((item) => item.id === filter.value)?.label ?? filter.value;
  return dimension ? `${dimension.label}: ${valueLabel}` : valueLabel;
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

export function buildSavedVariableSetWeightMismatch({
  savedWeight,
  currentWeight,
  sourceLabel,
  currentContextLabel
}: {
  savedWeight: WeightId | null;
  currentWeight: WeightId | null;
  sourceLabel: string;
  currentContextLabel: string;
}): AnalysisContextMismatchView | null {
  if (savedWeight === currentWeight) return null;

  const savedLabel = weightLabel(savedWeight);
  const currentLabel = weightLabel(currentWeight);

  return {
    label: "Saved source weight differs",
    message: `${sourceLabel} defaults to ${savedLabel}; ${currentContextLabel} uses ${currentLabel}.`,
    helper: "Review this before saving, refreshing, or reusing the source so weighting stays intentional.",
    chips: [`Saved source: ${savedLabel}`, `Current: ${currentLabel}`]
  };
}

export function buildSavedVariableSetFilterMismatch({
  savedFilterField,
  savedFilterValue,
  currentFilterField,
  currentFilterValue,
  sourceLabel,
  currentContextLabel
}: {
  savedFilterField: FilterFieldId | null;
  savedFilterValue: string;
  currentFilterField: AnalysisFilterField | null;
  currentFilterValue: string;
  sourceLabel: string;
  currentContextLabel: string;
}): AnalysisContextMismatchView | null {
  const savedFilter = normalizeFilter(savedFilterField, savedFilterValue);
  const currentFilter = normalizeFilter(currentFilterField, currentFilterValue);
  if (savedFilter.field === currentFilter.field && savedFilter.value === currentFilter.value) return null;

  const savedLabel = filterLabel(savedFilter.field, savedFilter.value);
  const currentLabel = filterLabel(currentFilter.field, currentFilter.value);

  return {
    label: "Saved source filter differs",
    message: `${sourceLabel} defaults to ${savedLabel}; ${currentContextLabel} uses ${currentLabel}.`,
    helper: "Review this before saving, refreshing, or reusing the source so filtering stays intentional.",
    chips: [`Saved source: ${savedLabel}`, `Current: ${currentLabel}`]
  };
}
