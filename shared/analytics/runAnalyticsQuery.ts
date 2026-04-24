import { getAnalyticsProvider, getAnalyticsProviderReadiness } from "./providers";
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
  const readiness = getAnalyticsProviderReadiness(provider.id);

  if (!readiness.configured) {
    const missingDetails = readiness.missingEnvVars?.length ? ` Missing: ${readiness.missingEnvVars.join(", ")}.` : "";
    throw new Error(`${readiness.summary}.${missingDetails}`.trim());
  }

  return provider.runQuery(query);
}
