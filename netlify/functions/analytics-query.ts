import type { Handler } from "@netlify/functions";
import { runMockAnalyticsQuery } from "../../shared/mock/analytics";
import { datasets } from "../../shared/metadata/ecofocus2025";
import type { AnalyticsErrorResponse, AnalyticsQueryRequest } from "../../shared/types/analytics";

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
  const dataset = datasets.find((item) => item.id === input.dataset);
  const question = dataset?.questions.find((item) => item.id === input.question);
  const dimension = dataset?.dimensions.find((item) => item.id === input.breakBy);

  if (!dataset) errors.push("Unknown dataset.");
  if (!question) errors.push("Unknown or unsupported question.");
  if (!dimension) errors.push("Unknown or unsupported breakBy dimension.");
  if (!input.metric || !question?.allowedMetrics.includes(input.metric)) errors.push("Unsupported metric.");
  if (!input.chartType || !question?.allowedChartTypes.includes(input.chartType)) errors.push("Unsupported chartType.");
  if (!Array.isArray(input.filters)) errors.push("filters must be an array.");

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
