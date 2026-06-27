import {
  getChartTypeMetadata,
  getDatasetMetadata,
  getDimensionMetadata,
  getMetricMetadata,
  getQuestionMetadata,
  getWeightMetadata
} from "../metadata/ecofocus2025";
import type { AnalyticsQueryRequest, DimensionId } from "../types/analytics";

export function validateAnalyticsQuery(input: Partial<AnalyticsQueryRequest>): string[] {
  const errors: string[] = [];
  const dataset = input.dataset ? getDatasetMetadata(input.dataset) : undefined;
  const question = input.dataset && input.question ? getQuestionMetadata(input.dataset, input.question) : undefined;
  const dimension = input.dataset && input.breakBy ? getDimensionMetadata(input.dataset, input.breakBy) : undefined;
  const metric = input.dataset && input.metric ? getMetricMetadata(input.dataset, input.metric) : undefined;
  const chartType = input.dataset && input.chartType ? getChartTypeMetadata(input.dataset, input.chartType) : undefined;
  const weight = input.dataset && input.weight ? getWeightMetadata(input.dataset, input.weight) : undefined;
  const comparisonDatasets = input.comparisonDatasets ?? [];
  const authoredVariableSet = input.authoredVariableSet;

  if (!dataset) errors.push("Unknown dataset.");
  if (!question) errors.push("Unknown or unsupported question.");
  if (!dimension || dimension.role !== "banner") errors.push("Unknown or unsupported breakBy dimension.");
  if (question && input.breakBy && !question.allowedBreakBys.includes(input.breakBy)) errors.push("Question does not support this breakBy dimension.");
  if (!metric || !input.metric || !question?.allowedMetrics.includes(input.metric)) errors.push("Unsupported metric.");
  if (!chartType || !input.chartType || !question?.allowedChartTypes.includes(input.chartType)) errors.push("Unsupported chartType.");
  if (chartType && input.metric && !chartType.supportedMetrics.includes(input.metric)) errors.push("Chart type does not support this metric.");
  if (input.weight !== null && input.weight !== undefined && !weight) errors.push("Unsupported weight.");
  if (!Array.isArray(input.filters)) errors.push("filters must be an array.");
  if (input.confidenceLevel !== undefined && ![0.9, 0.95, 0.99].includes(input.confidenceLevel)) errors.push("Unsupported confidence level.");
  if (input.comparisonMode !== undefined && !["none", "wave"].includes(input.comparisonMode)) errors.push("Unsupported comparison mode.");
  if (input.comparisonMode === "wave" && comparisonDatasets.length === 0) errors.push("Wave comparison needs at least one comparison dataset.");

  if (dataset && comparisonDatasets.length > 0) {
    for (const comparisonDataset of comparisonDatasets) {
      const comparisonMetadata = getDatasetMetadata(comparisonDataset);
      if (!comparisonMetadata) {
        errors.push(`Unsupported comparison dataset: ${comparisonDataset}.`);
        continue;
      }
      if (!getQuestionMetadata(comparisonDataset, input.question ?? question?.id ?? dataset.defaultQuestion)) {
        errors.push(`Comparison dataset ${comparisonDataset} does not support the selected question.`);
      }
    }
  }

  if (dataset && Array.isArray(input.filters)) {
    for (const filter of input.filters) {
      const filterDimension = getDimensionMetadata(dataset.id, filter.field as DimensionId);
      const filterQuestion = getQuestionMetadata(dataset.id, filter.field as AnalyticsQueryRequest["question"]);
      const allowedValues = filterDimension?.values ?? filterQuestion?.options;

      if (!allowedValues) {
        errors.push(`Unsupported filter field: ${filter.field}.`);
        continue;
      }

      if (!Array.isArray(filter.values) || filter.values.length === 0) {
        errors.push(`Filter ${filter.field} must include at least one value.`);
        continue;
      }

      const allowedValueIds = new Set(allowedValues.map((value) => value.id));
      const unknownValues = filter.values.filter((value) => !allowedValueIds.has(value));

      if (unknownValues.length > 0) {
        errors.push(`Filter ${filter.field} contains unsupported values: ${unknownValues.join(", ")}.`);
      }
    }
  }

  if (authoredVariableSet) {
    if (authoredVariableSet.rowMode !== "authored") errors.push("Unsupported authored variable-set row mode.");
    if (!Array.isArray(authoredVariableSet.rows)) {
      errors.push("Authored variable set rows must be an array.");
    } else if (question) {
      const allowedOptionIds = new Set(question.options.map((option) => option.id));
      const visibleUsage = new Map<string, string[]>();

      authoredVariableSet.rows.forEach((row) => {
        if (!["option", "net", "topbox", "bottombox"].includes(row.kind)) {
          errors.push(`Unsupported authored row kind: ${row.kind}.`);
        }

        if (!row.id || !row.label) {
          errors.push("Authored rows must include an id and label.");
        }

        if (!Array.isArray(row.sourceOptionIds) || row.sourceOptionIds.length === 0) {
          errors.push(`Authored row ${row.label || row.id} must include at least one source option.`);
          return;
        }

        const unknownOptions = row.sourceOptionIds.filter((optionId) => !allowedOptionIds.has(optionId));
        if (unknownOptions.length > 0) {
          errors.push(`Authored row ${row.label || row.id} contains unsupported source options: ${unknownOptions.join(", ")}.`);
        }

        if (row.visible) {
          row.sourceOptionIds.forEach((optionId) => {
            visibleUsage.set(optionId, [...(visibleUsage.get(optionId) ?? []), row.label || row.id]);
          });
        }
      });

      const overlappingRows = Array.from(visibleUsage.entries()).filter(([, rowLabels]) => rowLabels.length > 1);
      if (overlappingRows.length > 0) {
        errors.push(
          `Authored variable-set rows contain overlapping source options: ${overlappingRows
            .map(([optionId, rowLabels]) => `${optionId} (${rowLabels.join(", ")})`)
            .join("; ")}.`
        );
      }
    }
  }

  return errors;
}
