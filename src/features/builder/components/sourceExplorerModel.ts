import { comparisonDatasetOptions, defaultDataset } from "../builderConstants";
import { getChartTypeLabel } from "../../analytics/analyticsDisplay";
import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedVariableSet } from "../../../../shared/types/dashboard";

export interface SourceExplorerGroup<T> {
  id: string;
  label: string;
  items: T[];
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
