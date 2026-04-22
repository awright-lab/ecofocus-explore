import type { Handler } from "@netlify/functions";
import { runMockAnalyticsQuery } from "../../shared/mock/analytics";
import {
  getChartTypeMetadata,
  getDatasetMetadata,
  getDimensionMetadata,
  getMetricMetadata,
  getQuestionMetadata
} from "../../shared/metadata/ecofocus2025";
import type { AnalyticsErrorResponse, AnalyticsQueryRequest, DimensionId } from "../../shared/types/analytics";

const jsonHeaders = {
  "Content-Type": "application/json"
};

function errorResponse(statusCode: number, error: string, details?: string[]) {
  const body: AnalyticsErrorResponse = { error, details };

  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(body)
  };
}

function validateQuery(input: Partial<AnalyticsQueryRequest>): string[] {
  const errors: string[] = [];
  const dataset = input.dataset ? getDatasetMetadata(input.dataset) : undefined;
  const question = input.dataset && input.question ? getQuestionMetadata(input.dataset, input.question) : undefined;
  const dimension = input.dataset && input.breakBy ? getDimensionMetadata(input.dataset, input.breakBy) : undefined;
  const metric = input.dataset && input.metric ? getMetricMetadata(input.dataset, input.metric) : undefined;
  const chartType = input.dataset && input.chartType ? getChartTypeMetadata(input.dataset, input.chartType) : undefined;

  if (!dataset) errors.push("Unknown dataset.");
  if (!question) errors.push("Unknown or unsupported question.");
  if (!dimension || dimension.role !== "banner") errors.push("Unknown or unsupported breakBy dimension.");
  if (question && input.breakBy && !question.allowedBreakBys.includes(input.breakBy)) errors.push("Question does not support this breakBy dimension.");
  if (!metric || !input.metric || !question?.allowedMetrics.includes(input.metric)) errors.push("Unsupported metric.");
  if (!chartType || !input.chartType || !question?.allowedChartTypes.includes(input.chartType)) errors.push("Unsupported chartType.");
  if (chartType && input.metric && !chartType.supportedMetrics.includes(input.metric)) errors.push("Chart type does not support this metric.");
  if (!Array.isArray(input.filters)) errors.push("filters must be an array.");

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

  return errors;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  if (!event.body) {
    return errorResponse(400, "Missing request body.");
  }

  try {
    const query = JSON.parse(event.body) as Partial<AnalyticsQueryRequest>;
    const validationErrors = validateQuery(query);

    if (validationErrors.length > 0) {
      return errorResponse(400, "Invalid analytics query.", validationErrors);
    }

    const response = runMockAnalyticsQuery(query as AnalyticsQueryRequest);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return errorResponse(500, "Analytics query failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
