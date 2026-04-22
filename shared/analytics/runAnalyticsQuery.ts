import { getAnalyticsProvider } from "./providers";
import { createAnalyticsQueryPlan } from "./queryPlan";
import { validateAnalyticsQuery } from "./validation";
import type { AnalyticsQueryRequest } from "../types/analytics";

export async function runAnalyticsQueryWithProvider(query: AnalyticsQueryRequest) {
  const validationErrors = validateAnalyticsQuery(query);

  if (validationErrors.length > 0) {
    throw new Error(`Invalid analytics query: ${validationErrors.join(" ")}`);
  }

  // The plan is the provider-neutral shape Snowflake SQL generation will use next.
  createAnalyticsQueryPlan(query);

  const provider = getAnalyticsProvider();
  return provider.runQuery(query);
}
