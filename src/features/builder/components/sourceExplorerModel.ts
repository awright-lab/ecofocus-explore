import { comparisonDatasetOptions, defaultDataset } from "../builderConstants";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";
import type { BreakById, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";

export interface SourceExplorerGroup<T> {
  id: string;
  label: string;
  items: T[];
}

export interface SourceDetailItem {
  label: string;
  value: string;
}

export interface SourceDetailList {
  label: string;
  items: string[];
}

export interface SourceDetailView {
  kindLabel: string;
  title: string;
  subtitle: string;
  description: string;
  chips: string[];
  items: SourceDetailItem[];
  lists: SourceDetailList[];
}

function groupLabel(topic: string | undefined) {
  return topic?.trim() || "Uncategorized";
}

function normalizeGroupId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "uncategorized";
}

export function groupQuestionsByTopic(questions: QuestionMetadata[]): SourceExplorerGroup<QuestionMetadata>[] {
  const groups = new Map<string, SourceExplorerGroup<QuestionMetadata>>();
  questions.forEach((question) => {
    const label = groupLabel(question.topic);
    const id = normalizeGroupId(label);
    const group = groups.get(id) ?? { id, label, items: [] };
    group.items.push(question);
    groups.set(id, group);
  });
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function groupVariableSetsByTopic(variableSets: SavedVariableSet[]): SourceExplorerGroup<SavedVariableSet>[] {
  const groups = new Map<string, SourceExplorerGroup<SavedVariableSet>>();
  variableSets.forEach((variableSet) => {
    const label = groupLabel(variableSet.topic);
    const id = normalizeGroupId(label);
    const group = groups.get(id) ?? { id, label, items: [] };
    group.items.push(variableSet);
    groups.set(id, group);
  });
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function questionTypeLabel(type: QuestionMetadata["type"]) {
  if (type === "multi_binary_set") return "Multi-response";
  if (type === "single_select") return "Single select";
  return type;
}

export function questionMetadataChips(question: QuestionMetadata) {
  const chartLabels = question.allowedChartTypes.map((chartType) => getChartTypeLabel(chartType));
  return [
    questionTypeLabel(question.type),
    pluralize(question.options.length, "option"),
    pluralize(question.allowedBreakBys.length, "banner"),
    pluralize(question.allowedMetrics.length, "metric"),
    chartLabels.length > 2 ? `${chartLabels.slice(0, 2).join(", ")} +${chartLabels.length - 2}` : chartLabels.join(", "),
    comparisonDatasetOptions.length ? `Wave compare: ${comparisonDatasetOptions.map((dataset) => dataset.wave).join(", ")}` : "No wave compare"
  ].filter(Boolean);
}

export function variableSetMetadataChips(variableSet: SavedVariableSet) {
  const chartLabel = getChartTypeLabel(variableSet.chartType);
  const comparisonLabel =
    variableSet.comparisonMode === "wave" && variableSet.comparisonDatasets?.length
      ? `Wave compare: ${variableSet.comparisonDatasets.length}`
      : "No compare";

  return [
    pluralize(variableSet.questionIds.length, "question"),
    pluralize(variableSet.rows.length, "row"),
    variableSet.rowMode === "authored" ? "Authored rows" : "Question rows",
    chartLabel,
    comparisonLabel,
    variableSet.weight ? "Weighted" : "Unweighted",
    `Dataset: ${defaultDataset.wave}`
  ];
}

function labelsForIds<T extends string>(ids: T[], items: Array<{ id: T; label: string }>) {
  return ids.map((id) => items.find((item) => item.id === id)?.label ?? id);
}

function bannerLabel(id: BreakById) {
  return defaultDataset.dimensions.find((item) => item.id === id)?.label ?? id;
}

function metricLabel(id: Metric) {
  return defaultDataset.metrics.find((item) => item.id === id)?.label ?? id;
}

function weightLabel(id: WeightId | null) {
  if (!id) return "Unweighted";
  return defaultDataset.weights.find((item) => item.id === id)?.label ?? id;
}

function filterLabel(field: FilterFieldId | null, value: string) {
  if (!field || value === "all") return "No saved filter";
  const dimension = defaultDataset.dimensions.find((item) => item.id === field);
  const valueLabel = dimension?.values.find((item) => item.id === value)?.label ?? value;
  return `${dimension?.label ?? field}: ${valueLabel}`;
}

function comparisonLabel(variableSet: SavedVariableSet) {
  if (variableSet.comparisonMode !== "wave" || !variableSet.comparisonDatasets?.length) return "None";
  return variableSet.comparisonDatasets
    .map((datasetId) => comparisonDatasetOptions.find((dataset) => dataset.id === datasetId)?.wave ?? datasetId)
    .join(", ");
}

export function buildQuestionSourceDetail(question: QuestionMetadata): SourceDetailView {
  return {
    kindLabel: "Question",
    title: question.label,
    subtitle: `${question.topic} · ${defaultDataset.label} ${defaultDataset.wave}`,
    description: question.universe,
    chips: questionMetadataChips(question),
    items: [
      { label: "Question type", value: questionTypeLabel(question.type) },
      { label: "Options", value: pluralize(question.options.length, "option") },
      { label: "Default metric", value: metricLabel(question.defaultMetric) },
      { label: "Dataset", value: `${defaultDataset.label} ${defaultDataset.wave}` },
      { label: "Wave comparison", value: comparisonDatasetOptions.length ? comparisonDatasetOptions.map((dataset) => dataset.wave).join(", ") : "Unavailable" },
      { label: "Weights", value: defaultDataset.weights.length ? defaultDataset.weights.map((weight) => weight.label).join(", ") : "None configured" }
    ],
    lists: [
      { label: "Compatible charts", items: question.allowedChartTypes.map((chartType) => getChartTypeLabel(chartType)) },
      { label: "Available banners", items: question.allowedBreakBys.map((breakBy) => bannerLabel(breakBy)) },
      { label: "Available metrics", items: question.allowedMetrics.map((metric) => metricLabel(metric)) },
      { label: "Available filters", items: defaultDataset.dimensions.filter((dimension) => dimension.role === "filter").map((dimension) => dimension.label) },
      { label: "Response options", items: question.options.map((option) => option.label) }
    ]
  };
}

export function buildVariableSetSourceDetail(variableSet: SavedVariableSet, primaryQuestion?: QuestionMetadata): SourceDetailView {
  const visibleRows = variableSet.rows.filter((row) => row.visible).length;
  const resolvedPrimaryQuestion = defaultDataset.questions.find((question) => question.id === variableSet.primaryQuestionId) ?? primaryQuestion;
  return {
    kindLabel: "Variable set",
    title: variableSet.label,
    subtitle: `${variableSet.topic} · ${defaultDataset.label} ${defaultDataset.wave}`,
    description: variableSet.description,
    chips: variableSetMetadataChips(variableSet),
    items: [
      { label: "Primary question", value: resolvedPrimaryQuestion?.shortLabel ?? variableSet.primaryQuestionId },
      { label: "Questions", value: pluralize(variableSet.questionIds.length, "question") },
      { label: "Rows", value: `${visibleRows} visible of ${variableSet.rows.length}` },
      { label: "Row mode", value: variableSet.rowMode === "authored" ? "Authored rows" : "Question rows" },
      { label: "Default banner", value: bannerLabel(variableSet.breakBy) },
      { label: "Default metric", value: metricLabel(variableSet.metric) },
      { label: "Default chart", value: getChartTypeLabel(variableSet.chartType) },
      { label: "Wave comparison", value: comparisonLabel(variableSet) },
      { label: "Weight", value: weightLabel(variableSet.weight) },
      { label: "Filter", value: filterLabel(variableSet.filterField, variableSet.filterValue) }
    ],
    lists: [
      { label: "Source questions", items: labelsForIds(variableSet.questionIds, defaultDataset.questions).map((label) => label) },
      { label: "Rows", items: variableSet.rows.map((row) => `${row.label}${row.visible ? "" : " (hidden)"}`) }
    ]
  };
}
