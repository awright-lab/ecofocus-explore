import { defaultDataset } from "../builderConstants";
import type { BreakById, FilterFieldId, QuestionId, WeightId } from "../../../../shared/types/analytics";

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
  dimension: "banner" | "filter" | "weight";
  label: string;
  message: string;
  helper: string;
  chips: string[];
}

export type AnalysisWeightMismatchView = AnalysisContextMismatchView;

export interface AnalysisContextDiagnosticsSummaryView {
  status: "matched" | "differs";
  label: string;
  message: string;
  helper: string;
  chips: string[];
}

const mismatchDimensionLabels: Record<AnalysisContextMismatchView["dimension"], string> = {
  banner: "Banner",
  filter: "Filter",
  weight: "Weight"
};

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

function normalizeBanner(breakBy: BreakById | null | undefined) {
  return breakBy ?? defaultDataset.defaultBreakBy;
}

export function bannerLabel(breakBy: BreakById | null | undefined) {
  const normalizedBreakBy = normalizeBanner(breakBy);
  const dimension = defaultDataset.dimensions.find((item) => item.id === normalizedBreakBy);
  return dimension?.label ?? normalizedBreakBy;
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
    dimension: "weight",
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
    dimension: "filter",
    label: "Saved source filter differs",
    message: `${sourceLabel} defaults to ${savedLabel}; ${currentContextLabel} uses ${currentLabel}.`,
    helper: "Review this before saving, refreshing, or reusing the source so filtering stays intentional.",
    chips: [`Saved source: ${savedLabel}`, `Current: ${currentLabel}`]
  };
}

export function buildSavedVariableSetBannerMismatch({
  savedBreakBy,
  currentBreakBy,
  sourceLabel,
  currentContextLabel
}: {
  savedBreakBy: BreakById;
  currentBreakBy: BreakById;
  sourceLabel: string;
  currentContextLabel: string;
}): AnalysisContextMismatchView | null {
  const savedBanner = normalizeBanner(savedBreakBy);
  const currentBanner = normalizeBanner(currentBreakBy);
  if (savedBanner === currentBanner) return null;

  const savedLabel = bannerLabel(savedBanner);
  const currentLabel = bannerLabel(currentBanner);

  return {
    dimension: "banner",
    label: "Saved source banner differs",
    message: `${sourceLabel} defaults to ${savedLabel}; ${currentContextLabel} uses ${currentLabel}.`,
    helper: "Review this before saving, refreshing, or reusing the source so banner breakouts stay intentional.",
    chips: [`Saved source: ${savedLabel}`, `Current: ${currentLabel}`]
  };
}

export function buildAnalysisContextDiagnosticsSummary({
  mismatches,
  sourceLabel,
  currentContextLabel
}: {
  mismatches: Array<AnalysisContextMismatchView | null | undefined>;
  sourceLabel: string;
  currentContextLabel: string;
}): AnalysisContextDiagnosticsSummaryView {
  const visibleMismatches = mismatches.filter((mismatch): mismatch is AnalysisContextMismatchView => Boolean(mismatch));
  const differingDimensions = new Set(visibleMismatches.map((mismatch) => mismatch.dimension));
  const dimensionChips = (Object.keys(mismatchDimensionLabels) as AnalysisContextMismatchView["dimension"][]).map((dimension) =>
    differingDimensions.has(dimension) ? `${mismatchDimensionLabels[dimension]} differs` : `${mismatchDimensionLabels[dimension]} matches`
  );

  if (visibleMismatches.length === 0) {
    return {
      status: "matched",
      label: "Saved source defaults match current context",
      message: `${sourceLabel} defaults align with the ${currentContextLabel}.`,
      helper: "Banner, filter, and weight settings are consistent with this saved source.",
      chips: dimensionChips
    };
  }

  const differingLabels = visibleMismatches.map((mismatch) => mismatchDimensionLabels[mismatch.dimension].toLowerCase());

  return {
    status: "differs",
    label: "Saved source defaults differ from current context",
    message: `${sourceLabel} has different ${differingLabels.join(", ")} defaults than the ${currentContextLabel}.`,
    helper: "Review the details below before saving, refreshing, or reusing this analytical source.",
    chips: dimensionChips
  };
}
