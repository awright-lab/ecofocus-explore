import { comparisonDatasetOptions, defaultDataset } from "../builderConstants";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";
import type { BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, QuestionId, WeightId } from "../../../../shared/types/analytics";

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

export interface VariableSetRowDetail {
  id: string;
  label: string;
  kindLabel: string;
  order: number;
  visible: boolean;
  emphasis: "detail" | "summary";
  sourceSummary: string;
  composition: string[];
}

export interface VariableSetDraftState {
  label: string;
  description: string;
  questionIds: QuestionId[];
  primaryQuestionId: QuestionId;
  rows: SavedVariableSet["rows"];
  breakBy: BreakById;
  metric: Metric;
  chartType: ChartType;
  comparisonMode: ComparisonMode;
  comparisonDatasets: DatasetId[];
  weight: WeightId | null;
  filterField: FilterFieldId | null;
  filterValue: string;
}

export interface VariableSetDraftStatus {
  isPersisted: boolean;
  hasUnsavedChanges: boolean;
  label: string;
  description: string;
  primaryActionLabel: string;
}

export interface SourceInsertionView {
  chartType: ChartType;
  chartLabel: string;
  canCreateTable: boolean;
  tableActionLabel: string;
  chartActionLabel: string;
  helperText: string;
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

function rowKindLabel(kind: SavedVariableSet["rows"][number]["kind"]) {
  if (kind === "topbox") return "Top box";
  if (kind === "bottombox") return "Bottom box";
  if (kind === "net") return "Net";
  return "Option";
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

function normalizeIds<T extends string>(ids: T[]) {
  return ids.slice().sort();
}

function normalizeRows(rows: SavedVariableSet["rows"]) {
  return rows
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .map((row, index) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      sourceOptionIds: row.sourceOptionIds.slice(),
      rowOrder: index + 1,
      visible: row.visible,
      emphasis: row.emphasis
    }));
}

export function variableSetHasDraftChanges(savedVariableSet: SavedVariableSet | null, draft: VariableSetDraftState) {
  if (!savedVariableSet) return true;
  return JSON.stringify({
    label: savedVariableSet.label,
    description: savedVariableSet.description,
    questionIds: normalizeIds(savedVariableSet.questionIds),
    primaryQuestionId: savedVariableSet.primaryQuestionId,
    rows: normalizeRows(savedVariableSet.rows),
    breakBy: savedVariableSet.breakBy,
    metric: savedVariableSet.metric,
    chartType: savedVariableSet.chartType,
    comparisonMode: savedVariableSet.comparisonMode ?? "none",
    comparisonDatasets: normalizeIds(savedVariableSet.comparisonDatasets ?? []),
    weight: savedVariableSet.weight,
    filterField: savedVariableSet.filterField,
    filterValue: savedVariableSet.filterValue
  }) !== JSON.stringify({
    label: draft.label.trim(),
    description: draft.description.trim(),
    questionIds: normalizeIds(draft.questionIds),
    primaryQuestionId: draft.primaryQuestionId,
    rows: normalizeRows(draft.rows),
    breakBy: draft.breakBy,
    metric: draft.metric,
    chartType: draft.chartType,
    comparisonMode: draft.comparisonMode,
    comparisonDatasets: normalizeIds(draft.comparisonDatasets),
    weight: draft.weight,
    filterField: draft.filterField,
    filterValue: draft.filterValue
  });
}

export function buildVariableSetDraftStatus(savedVariableSet: SavedVariableSet | null, draft: VariableSetDraftState): VariableSetDraftStatus {
  const hasUnsavedChanges = variableSetHasDraftChanges(savedVariableSet, draft);
  if (!savedVariableSet) {
    return {
      isPersisted: false,
      hasUnsavedChanges,
      label: "Draft only",
      description: "This variable-set draft has not been saved to the library yet.",
      primaryActionLabel: "Save set"
    };
  }
  return {
    isPersisted: true,
    hasUnsavedChanges,
    label: hasUnsavedChanges ? "Unsaved draft changes" : "Saved set is current",
    description: hasUnsavedChanges
      ? "Detail-panel edits are draft-only until you update the saved set."
      : "The selected saved set matches the current draft.",
    primaryActionLabel: "Update saved set"
  };
}

export function buildSourceInsertionView(chartType: ChartType, selectedChartTypes: ChartType[], pageTitle: string): SourceInsertionView {
  const chartVisualization = chartType === "table"
    ? (selectedChartTypes.find((item) => item !== "table") ?? "vertical_bar")
    : chartType;
  return {
    chartType: chartVisualization,
    chartLabel: getChartTypeLabel(chartVisualization),
    canCreateTable: selectedChartTypes.includes("table"),
    tableActionLabel: "Create table",
    chartActionLabel: `Create ${getChartTypeLabel(chartVisualization)}`,
    helperText: `Objects are inserted on "${pageTitle}". Tables keep the source configuration table-first; charts use the same source query with a chart view.`
  };
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

export function buildVariableSetRowDetails(rows: SavedVariableSet["rows"], question: QuestionMetadata): VariableSetRowDetail[] {
  const optionLabels = new Map(question.options.map((option) => [option.id, option.label]));
  return rows
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder)
    .map((row, index) => {
      const composition = row.sourceOptionIds.map((optionId) => optionLabels.get(optionId) ?? optionId);
      return {
        id: row.id,
        label: row.label,
        kindLabel: rowKindLabel(row.kind),
        order: index + 1,
        visible: row.visible,
        emphasis: row.emphasis,
        sourceSummary: composition.length ? `${pluralize(composition.length, "source option")}` : "No source options",
        composition
      };
    });
}
