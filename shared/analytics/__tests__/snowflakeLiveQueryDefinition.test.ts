import { describe, expect, it } from "vitest";
import {
  buildSnowflakeLiveCategoricalDefinitionSql,
  normalizeSnowflakeLiveDefinitionRows,
  runSnowflakeLiveQueryDefinition,
  validateSnowflakeLiveQueryDefinitionSupport
} from "../providers/snowflakeLiveQueryDefinition";
import type { SnowflakeConfig } from "../providers/snowflakeConfig";
import type { SnowflakeQueryExecutor } from "../providers/snowflakeProvider";
import type {
  LiveDatasetFieldDescriptor,
  LiveDatasetQueryDefinition,
  LiveDatasetQueryExecutionRequest,
  LiveDatasetSourceDescriptor
} from "../../types/dataSource";

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

function field(overrides: Partial<LiveDatasetFieldDescriptor> = {}): LiveDatasetFieldDescriptor {
  return {
    id: "gender",
    label: "Gender",
    rawName: "GENDER",
    type: "text",
    modelingRole: "dimension",
    ...overrides
  };
}

function source(overrides: Partial<LiveDatasetSourceDescriptor> = {}): LiveDatasetSourceDescriptor {
  return {
    sourceRef: {
      id: "live:snowflake:connection_snowflake:default",
      kind: "live_connection",
      provider: "snowflake",
      label: "Snowflake responses",
      datasetId: "live_snowflake",
      connectionId: "connection_snowflake",
      objectPath: "SURVEY.PUBLIC.RESPONSES"
    },
    connectionId: "connection_snowflake",
    objectType: "table",
    objectPath: "SURVEY.PUBLIC.RESPONSES",
    label: "Snowflake responses",
    syncMode: "live_query",
    status: "available",
    statusLabel: "Available",
    inspection: {
      status: "inspected",
      statusLabel: "Fields inspected",
      inspectedAt: "2026-08-12T00:00:00.000Z",
      fields: [field()],
      diagnostics: [],
      nextStep: "Model fields."
    },
    ...overrides
  };
}

function definition(overrides: Partial<LiveDatasetQueryDefinition> = {}): LiveDatasetQueryDefinition {
  return {
    id: "definition_gender",
    label: "Responses by Gender",
    sourceRefId: "live:snowflake:connection_snowflake:default",
    kind: "categorical",
    primaryFieldId: "gender",
    primaryFieldLabel: "Gender",
    metric: "count",
    outputMode: "table",
    status: "execution_pending",
    statusLabel: "Execution pending",
    notes: [],
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    ...overrides
  };
}

function request(overrides: Partial<LiveDatasetQueryExecutionRequest> = {}): LiveDatasetQueryExecutionRequest {
  return {
    provider: "snowflake",
    connectionId: "connection_snowflake",
    source: source(),
    definition: definition(),
    ...overrides
  };
}

describe("snowflake live query definition runner", () => {
  it("supports inspected categorical count definitions against dimension fields", () => {
    expect(validateSnowflakeLiveQueryDefinitionSupport(source(), definition())).toMatchObject({
      supported: true,
      primaryField: { rawName: "GENDER" }
    });
  });

  it("rejects uninspected sources and measure definitions honestly", () => {
    expect(validateSnowflakeLiveQueryDefinitionSupport(source({ inspection: undefined }), definition())).toMatchObject({
      supported: false,
      reason: "The source needs inspected field metadata before execution."
    });
    expect(validateSnowflakeLiveQueryDefinitionSupport(source(), definition({ kind: "measure", measureFieldId: "age", measureFieldLabel: "Age", metric: "average" }))).toMatchObject({
      supported: false,
      reason: "Measure definitions are still saved metadata only."
    });
  });

  it("rejects missing or non-dimension primary fields", () => {
    expect(validateSnowflakeLiveQueryDefinitionSupport(source(), definition({ primaryFieldId: "missing" }))).toMatchObject({
      supported: false,
      reason: "Gender is no longer present in inspected metadata."
    });
    expect(validateSnowflakeLiveQueryDefinitionSupport(source({ inspection: { ...source().inspection!, fields: [field({ modelingRole: "measure" })] } }), definition())).toMatchObject({
      supported: false,
      reason: "Gender must be modeled as a Group field."
    });
  });

  it("rejects unsafe source paths and field names before execution", () => {
    expect(() => buildSnowflakeLiveCategoricalDefinitionSql(source({ objectPath: "PUBLIC.RESPONSES;DROP" }), definition(), config)).toThrow("Unsafe Snowflake source path segment");
    expect(validateSnowflakeLiveQueryDefinitionSupport(source({ inspection: { ...source().inspection!, fields: [field({ rawName: "bad field" })] } }), definition())).toMatchObject({
      supported: false,
      reason: "Unsafe Snowflake field name: bad field."
    });
  });

  it("builds bounded read-only SQL for categorical counts", () => {
    const plan = buildSnowflakeLiveCategoricalDefinitionSql(source(), definition(), config, 999);

    expect(plan.sqlText).toContain('SELECT "GENDER" AS option_value, COUNT(*) AS value');
    expect(plan.sqlText).toContain('FROM "SURVEY"."PUBLIC"."RESPONSES"');
    expect(plan.sqlText).toContain('WHERE "GENDER" IS NOT NULL');
    expect(plan.sqlText).toContain("LIMIT 500");
    expect(plan.sqlText).not.toContain(";");
  });

  it("normalizes fake Snowflake rows into a table-first live result", () => {
    const result = normalizeSnowflakeLiveDefinitionRows(request(), [
      { OPTION_VALUE: "Female", VALUE: 120 },
      { OPTION_VALUE: "Male", VALUE: 100 }
    ]);

    expect(result).toMatchObject({
      columns: [{ id: "summary", label: "Total" }],
      metric: { id: "count", label: "Number of rows", valueFormat: "number" },
      rowCount: 2,
      totalBase: 220,
      rows: [
        { label: "Female", values: { summary: 120 }, bases: { summary: 220 } },
        { label: "Male", values: { summary: 100 }, bases: { summary: 220 } }
      ]
    });
  });

  it("executes through an injected executor and reports diagnostics", async () => {
    const executedSql: string[] = [];
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        executedSql.push(sqlText);
        return [
          { OPTION_VALUE: "Female", VALUE: 120 },
          { OPTION_VALUE: "Male", VALUE: 100 }
        ];
      }
    };

    const report = await runSnowflakeLiveQueryDefinition(request(), executor, env);

    expect(report).toMatchObject({
      status: "executed",
      statusLabel: "Live query executed",
      result: {
        rowCount: 2,
        totalBase: 220
      }
    });
    expect(executedSql[0]).toContain('GROUP BY "GENDER"');
  });

  it("preserves the report contract for empty results and missing config", async () => {
    const empty = await runSnowflakeLiveQueryDefinition(request(), { execute: async () => [] }, env);
    const missingConfig = await runSnowflakeLiveQueryDefinition(request(), { execute: async () => [] }, {});

    expect(empty).toMatchObject({
      status: "executed",
      statusLabel: "Live query returned no rows",
      result: { rowCount: 0, totalBase: 0 }
    });
    expect(empty.diagnostics[1]).toContain("no non-empty grouped values");
    expect(missingConfig).toMatchObject({
      status: "failed",
      statusLabel: "Missing server environment"
    });
  });
});
