import { describe, expect, it } from "vitest";
import { verifySnowflakeIntegration } from "../providers/snowflakeVerification";
import type { SnowflakeQueryExecutor, SnowflakeResultRow } from "../providers/snowflakeProvider";

const env = {
  SNOWFLAKE_ACCOUNT: "ecofocus-account",
  SNOWFLAKE_USERNAME: "readonly_user",
  SNOWFLAKE_PASSWORD: "secret",
  SNOWFLAKE_WAREHOUSE: "ANALYTICS_WH",
  SNOWFLAKE_DATABASE: "ECOFOCUS",
  SNOWFLAKE_SCHEMA: "EXPLORE",
  SNOWFLAKE_ROLE: "EXPLORE_READONLY",
  SNOWFLAKE_ANALYTICS_TABLE: "ANALYTICS_RESPONSES",
  SNOWFLAKE_QUERY_TIMEOUT_MS: "500"
};

function fakeRowsFor(sqlText: string): SnowflakeResultRow[] {
  if (sqlText.includes("CURRENT_ROLE()")) {
    return [
      {
        ROLE_NAME: "EXPLORE_READONLY",
        WAREHOUSE_NAME: "ANALYTICS_WH",
        DATABASE_NAME: "ECOFOCUS",
        SCHEMA_NAME: "EXPLORE"
      }
    ];
  }

  if (sqlText.includes("table_accessible")) {
    return [{ TABLE_ACCESSIBLE: 1 }];
  }

  if (sqlText.includes("OPTION_ID")) {
    return [
      { OPTION_ID: "trust_a_lot", COLUMN_ID: "summary", VALUE: 20, BASE: 1495 },
      { OPTION_ID: "trust_somewhat", COLUMN_ID: "summary", VALUE: 42, BASE: 1495 }
    ];
  }

  return [];
}

describe("verifySnowflakeIntegration", () => {
  it("returns a passed non-production verification report with a fake executor", async () => {
    const executedSql: string[] = [];
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        executedSql.push(sqlText);
        return fakeRowsFor(sqlText);
      }
    };

    const report = await verifySnowflakeIntegration(executor, env);

    expect(report).toMatchObject({
      provider: "snowflake",
      status: "passed",
      nonProductionOnly: true,
      target: {
        warehouse: "ANALYTICS_WH",
        database: "ECOFOCUS",
        schema: "EXPLORE",
        role: "EXPLORE_READONLY",
        analyticsTable: "ANALYTICS_RESPONSES"
      }
    });
    expect(report.steps.map((step) => [step.id, step.status])).toEqual([
      ["configuration", "passed"],
      ["read_only_guard", "passed"],
      ["connection_context", "passed"],
      ["table_access", "passed"],
      ["table_shape", "passed"],
      ["supported_query_plan", "passed"],
      ["provider_smoke_query", "passed"]
    ]);
    expect(report.supportedLiveShapes).toEqual(expect.arrayContaining(["summary-level wave comparisons across metadata-aligned datasets"]));
    expect(report.limitations).toEqual(expect.arrayContaining(["verification is read-only and non-production oriented"]));
    expect(executedSql.every((sqlText) => sqlText.trim().toLowerCase().startsWith("select"))).toBe(true);
    expect(executedSql.every((sqlText) => !sqlText.includes(";"))).toBe(true);
  });

  it("reports missing configuration and skips live checks", async () => {
    const report = await verifySnowflakeIntegration({ execute: async () => [] }, {});

    expect(report.status).toBe("failed");
    expect(report.steps[0]).toMatchObject({
      id: "configuration",
      status: "failed",
      reasons: [
        "SNOWFLAKE_ACCOUNT",
        "SNOWFLAKE_USERNAME",
        "SNOWFLAKE_PASSWORD",
        "SNOWFLAKE_WAREHOUSE",
        "SNOWFLAKE_DATABASE",
        "SNOWFLAKE_SCHEMA",
        "SNOWFLAKE_ROLE"
      ]
    });
    expect(report.steps.slice(1).every((step) => step.status === "skipped")).toBe(true);
  });

  it("distinguishes table-shape failures from other successful checks", async () => {
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        if (sqlText.includes("shopper_segment")) {
          throw new Error("invalid identifier SHOPPER_SEGMENT");
        }
        return fakeRowsFor(sqlText);
      }
    };

    const report = await verifySnowflakeIntegration(executor, env);
    const tableShapeStep = report.steps.find((step) => step.id === "table_shape");

    expect(report.status).toBe("failed");
    expect(tableShapeStep).toMatchObject({
      status: "failed",
      summary: "invalid identifier SHOPPER_SEGMENT",
      reasons: ["verification_failed"]
    });
    expect(report.steps.find((step) => step.id === "provider_smoke_query")?.status).toBe("passed");
  });

  it("reports provider smoke-query execution failures with Snowflake diagnostics", async () => {
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        if (sqlText.includes(" AS option_id")) {
          throw new Error("warehouse unavailable");
        }
        return fakeRowsFor(sqlText);
      }
    };

    const report = await verifySnowflakeIntegration(executor, env);
    const smokeStep = report.steps.find((step) => step.id === "provider_smoke_query");

    expect(report.status).toBe("failed");
    expect(smokeStep).toMatchObject({
      status: "failed",
      summary: "Snowflake query execution failed: warehouse unavailable",
      reasons: ["execution_failed"],
      details: {
        code: "snowflake_execution_failed"
      }
    });
  });
});
