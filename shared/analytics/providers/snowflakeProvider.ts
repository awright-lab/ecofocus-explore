import type { AnalyticsProvider } from "./types";
import { createAnalyticsQueryPlan } from "../queryPlan";
import { getSnowflakeReadiness, requireSnowflakeConfig } from "./snowflakeConfig";

export const snowflakeAnalyticsProvider: AnalyticsProvider = {
  id: "snowflake",
  label: "Snowflake provider",
  getReadiness() {
    const readiness = getSnowflakeReadiness();
    return readiness.configured
      ? {
          configured: true,
          summary: "Snowflake provider is configured, but query execution is still stubbed."
        }
      : {
          configured: false,
          summary: "Snowflake provider is not configured.",
          missingEnvVars: readiness.missingEnvVars
        };
  },
  async runQuery(query) {
    const config = requireSnowflakeConfig();
    const plan = createAnalyticsQueryPlan(query);

    throw new Error(
      [
        "Snowflake analytics provider boundary is ready, but query execution is not implemented yet.",
        `Configured database target: ${config.database}.${config.schema}.`,
        `Prepared query plan for dataset ${plan.dataset.id}, question ${plan.rows.id}, breakout ${plan.columns.id}.`
      ].join(" ")
    );
  }
};
