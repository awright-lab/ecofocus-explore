import { describe, expect, it } from "vitest";
import { getSnowflakeReadiness, requireSnowflakeConfig } from "../providers/snowflakeConfig";

describe("snowflakeConfig", () => {
  it("reports missing Snowflake configuration", () => {
    const readiness = getSnowflakeReadiness({});

    expect(readiness.configured).toBe(false);
    expect(readiness.missingEnvVars).toEqual([
      "SNOWFLAKE_ACCOUNT",
      "SNOWFLAKE_USERNAME",
      "SNOWFLAKE_PASSWORD",
      "SNOWFLAKE_WAREHOUSE",
      "SNOWFLAKE_DATABASE",
      "SNOWFLAKE_SCHEMA",
      "SNOWFLAKE_ROLE"
    ]);
  });

  it("returns normalized Snowflake config when all required env vars exist", () => {
    const env = {
      SNOWFLAKE_ACCOUNT: "ecofocus-account",
      SNOWFLAKE_USERNAME: "readonly_user",
      SNOWFLAKE_PASSWORD: "secret",
      SNOWFLAKE_WAREHOUSE: "ANALYTICS_WH",
      SNOWFLAKE_DATABASE: "ECOFOCUS",
      SNOWFLAKE_SCHEMA: "EXPLORE",
      SNOWFLAKE_ROLE: "EXPLORE_READONLY",
      SNOWFLAKE_AUTHENTICATOR: "externalbrowser"
    };

    expect(requireSnowflakeConfig(env)).toEqual({
      account: "ecofocus-account",
      username: "readonly_user",
      password: "secret",
      warehouse: "ANALYTICS_WH",
      database: "ECOFOCUS",
      schema: "EXPLORE",
      role: "EXPLORE_READONLY",
      authenticator: "externalbrowser"
    });
  });
});
