import { describe, expect, it } from "vitest";
import {
  buildSnowflakeSourceInspectionSql,
  inspectSnowflakeSource,
  validateSnowflakeObjectPath
} from "../providers/snowflakeSourceInspection";
import type { SnowflakeQueryExecutor } from "../providers/snowflakeProvider";
import type { SnowflakeConfig } from "../providers/snowflakeConfig";
import type { LiveDatasetSourceInspectionRequest } from "../../types/dataSource";

const config: SnowflakeConfig = {
  account: "ecofocus-account",
  username: "readonly_user",
  password: "secret",
  warehouse: "ANALYTICS_WH",
  database: "ECOFOCUS",
  schema: "EXPLORE",
  role: "EXPLORE_READONLY",
  analyticsTable: "SURVEY_RESPONSES",
  queryTimeoutMs: 500
};

const env = {
  SNOWFLAKE_ACCOUNT: config.account,
  SNOWFLAKE_USERNAME: config.username,
  SNOWFLAKE_PASSWORD: config.password,
  SNOWFLAKE_WAREHOUSE: config.warehouse,
  SNOWFLAKE_DATABASE: config.database,
  SNOWFLAKE_SCHEMA: config.schema,
  SNOWFLAKE_ROLE: config.role,
  SNOWFLAKE_ANALYTICS_TABLE: config.analyticsTable,
  SNOWFLAKE_QUERY_TIMEOUT_MS: "500"
};

function request(overrides: Partial<LiveDatasetSourceInspectionRequest> = {}): LiveDatasetSourceInspectionRequest {
  return {
    provider: "snowflake",
    connectionId: "connection_snowflake",
    sourceRefId: "live:snowflake:connection_snowflake:default",
    objectPath: "SURVEY.PUBLIC.RESPONSES",
    objectType: "table",
    ...overrides
  };
}

describe("snowflake source inspection", () => {
  it("resolves one, two, and three-part safe object paths", () => {
    expect(validateSnowflakeObjectPath("RESPONSES", config)).toEqual({
      database: "ECOFOCUS",
      schema: "EXPLORE",
      objectName: "RESPONSES"
    });
    expect(validateSnowflakeObjectPath("PUBLIC.RESPONSES", config)).toEqual({
      database: "ECOFOCUS",
      schema: "PUBLIC",
      objectName: "RESPONSES"
    });
    expect(validateSnowflakeObjectPath("SURVEY.PUBLIC.RESPONSES", config)).toEqual({
      database: "SURVEY",
      schema: "PUBLIC",
      objectName: "RESPONSES"
    });
  });

  it("rejects unsafe object paths before SQL is built", () => {
    expect(() => validateSnowflakeObjectPath("RESPONSES;DROP_TABLE_USERS", config)).toThrow("Unsafe Snowflake source path segment");
    expect(() => validateSnowflakeObjectPath('"PUBLIC"."RESPONSES"', config)).toThrow("Unsafe Snowflake source path segment");
    expect(() => validateSnowflakeObjectPath("A.B.C.D", config)).toThrow("supports table, schema.table, or database.schema.table");
  });

  it("builds bounded read-only information schema SQL", () => {
    const plan = buildSnowflakeSourceInspectionSql(request({ limit: 999 }), config);

    expect(plan.sqlText).toContain('FROM "SURVEY".information_schema.columns');
    expect(plan.sqlText).toContain("WHERE table_schema = 'PUBLIC'");
    expect(plan.sqlText).toContain("AND table_name = 'RESPONSES'");
    expect(plan.sqlText).toContain("LIMIT 500");
    expect(plan.sqlText.trim().toLowerCase().startsWith("select")).toBe(true);
    expect(plan.sqlText).not.toContain(";");
  });

  it("normalizes inspected Snowflake columns into live field descriptors", async () => {
    const executedSql: string[] = [];
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        executedSql.push(sqlText);
        return [
          { COLUMN_NAME: "GENDER", DATA_TYPE: "VARCHAR", IS_NULLABLE: "YES", ORDINAL_POSITION: 1 },
          { COLUMN_NAME: "AGE", DATA_TYPE: "NUMBER", IS_NULLABLE: "NO", ORDINAL_POSITION: 2 },
          { COLUMN_NAME: "COMPLETED_AT", DATA_TYPE: "TIMESTAMP_NTZ", IS_NULLABLE: "YES", ORDINAL_POSITION: 3 },
          { COLUMN_NAME: "IS_COMPLETE", DATA_TYPE: "BOOLEAN", IS_NULLABLE: "YES", ORDINAL_POSITION: 4 }
        ];
      }
    };

    const report = await inspectSnowflakeSource(request(), executor, env);

    expect(report).toMatchObject({
      status: "inspected",
      statusLabel: "Fields inspected",
      fields: [
        { id: "gender", label: "Gender", rawName: "GENDER", type: "text", nullable: true, sourceType: "VARCHAR" },
        { id: "age", label: "Age", rawName: "AGE", type: "number", nullable: false, sourceType: "NUMBER" },
        { id: "completed_at", label: "Completed At", rawName: "COMPLETED_AT", type: "date" },
        { id: "is_complete", label: "Is Complete", rawName: "IS_COMPLETE", type: "boolean" }
      ],
      nextStep: "Map analytical roles for these fields before enabling live query creation."
    });
    expect(executedSql[0]).toContain("information_schema.columns");
  });

  it("reports missing Snowflake config as a structured failed inspection", async () => {
    const report = await inspectSnowflakeSource(request(), { execute: async () => [] }, {});

    expect(report).toMatchObject({
      status: "failed",
      statusLabel: "Missing server environment"
    });
    expect(report.diagnostics[0]).toContain("Missing Snowflake environment variables");
  });

  it("keeps query source inspection unsupported", async () => {
    const report = await inspectSnowflakeSource(request({ objectType: "query" }), { execute: async () => [] }, env);

    expect(report).toMatchObject({
      status: "unsupported",
      statusLabel: "Query inspection pending",
      fields: []
    });
  });
});
