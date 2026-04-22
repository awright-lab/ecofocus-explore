import type { Handler } from "@netlify/functions";
import { runAnalyticsQueryWithProvider } from "../../shared/analytics/runAnalyticsQuery";
import { validateAnalyticsQuery } from "../../shared/analytics/validation";
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

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  if (!event.body) {
    return errorResponse(400, "Missing request body.");
  }

  try {
    const query = JSON.parse(event.body) as Partial<AnalyticsQueryRequest>;
    const validationErrors = validateAnalyticsQuery(query);

    if (validationErrors.length > 0) {
      return errorResponse(400, "Invalid analytics query.", validationErrors);
    }

    const response = await runAnalyticsQueryWithProvider(query as AnalyticsQueryRequest);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    return errorResponse(500, "Analytics query failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
