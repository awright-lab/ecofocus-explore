import type { AnalyticsProvider } from "./types";

const requiredSnowflakeEnvVars = [
  "SNOWFLAKE_ACCOUNT",
  "SNOWFLAKE_USERNAME",
  "SNOWFLAKE_PASSWORD",
  "SNOWFLAKE_WAREHOUSE",
  "SNOWFLAKE_DATABASE",
  "SNOWFLAKE_SCHEMA",
  "SNOWFLAKE_ROLE"
];

export const snowflakeAnalyticsProvider: AnalyticsProvider = {
  id: "snowflake",
  async runQuery() {
    const missingEnvVars = requiredSnowflakeEnvVars.filter((name) => !process.env[name]);

    if (missingEnvVars.length > 0) {
      throw new Error(`Snowflake provider is not configured. Missing: ${missingEnvVars.join(", ")}.`);
    }

    throw new Error("Snowflake analytics provider boundary is ready, but query execution is not implemented yet.");
  }
};
