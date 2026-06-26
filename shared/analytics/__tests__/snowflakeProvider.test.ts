import { describe, expect, it } from "vitest";
import {
  SnowflakeProviderError,
  assertSnowflakeSqlIsReadOnly,
  buildSnowflakeSqlPlan,
  createSnowflakeAnalyticsProvider,
  getSnowflakeQuerySupport,
  normalizeSnowflakeRows,
  type SnowflakeQueryExecutor
} from "../providers/snowflakeProvider";
import { requireSnowflakeConfig } from "../providers/snowflakeConfig";
import type { AnalyticsQueryRequest } from "../../types/analytics";

const env = {
  SNOWFLAKE_ACCOUNT: "ecofocus-account",
  SNOWFLAKE_USERNAME: "readonly_user",
  SNOWFLAKE_PASSWORD: "secret",
  SNOWFLAKE_WAREHOUSE: "ANALYTICS_WH",
  SNOWFLAKE_DATABASE: "ECOFOCUS",
  SNOWFLAKE_SCHEMA: "EXPLORE",
  SNOWFLAKE_ROLE: "EXPLORE_READONLY",
  SNOWFLAKE_ANALYTICS_TABLE: "ANALYTICS_RESPONSES",
  SNOWFLAKE_QUERY_TIMEOUT_MS: "50"
};

const breakoutQuery: AnalyticsQueryRequest = {
  dataset: "ecofocus_2025",
  question: "Q_PACKAGING_TRUST",
  breakBy: "GENERATION",
  filters: [{ field: "SHOPPER_SEGMENT", values: ["eco_engaged"] }],
  weight: "weightvar",
  metric: "column_percent",
  chartType: "grouped_bar",
  confidenceLevel: 0.95
};

const questionFilteredQuery: AnalyticsQueryRequest = {
  ...breakoutQuery,
  filters: [{ field: "Q_PACKAGING_TRUST", values: ["trust_a_lot"] }]
};

describe("snowflakeProvider", () => {
  it("reports live readiness when Snowflake configuration exists", () => {
    expect(createSnowflakeAnalyticsProvider({ execute: async () => [] }, env).getReadiness?.()).toEqual({
      configured: true,
      summary: "Snowflake provider is configured for live execution against ECOFOCUS.EXPLORE.ANALYTICS_RESPONSES."
    });
  });

  it("builds a Snowflake SQL plan for supported table-first breakout queries", () => {
    const plan = buildSnowflakeSqlPlan(breakoutQuery, requireSnowflakeConfig(env));

    expect(plan.summary).toBe("Snowflake SQL plan for ecofocus_2025/Q_PACKAGING_TRUST by GENERATION.");
    expect(plan.sqlText).toContain('"ECOFOCUS"."EXPLORE"."ANALYTICS_RESPONSES"');
    expect(plan.sqlText).toContain("LOWER(TO_VARCHAR(survey_wave)) = '2025'");
    expect(plan.sqlText).toContain("LOWER(TO_VARCHAR(shopper_segment)) IN ('eco_engaged')");
    expect(plan.sqlText).toContain("LOWER(TO_VARCHAR(q_packaging_trust)) = 'trust_a_lot'");
  });

  it("builds a Snowflake SQL plan for supported single-select question filters", () => {
    const plan = buildSnowflakeSqlPlan(questionFilteredQuery, requireSnowflakeConfig(env));

    expect(getSnowflakeQuerySupport(questionFilteredQuery)).toMatchObject({
      supported: true,
      reasons: []
    });
    expect(plan.sqlText).toContain("LOWER(TO_VARCHAR(q_packaging_trust)) IN ('trust_a_lot')");
    expect(plan.sqlText).toContain("LOWER(TO_VARCHAR(q_packaging_trust)) = 'trust_somewhat'");
  });

  it("builds a Snowflake SQL plan for one supported multi-binary question filter", () => {
    const plan = buildSnowflakeSqlPlan(
      {
        ...breakoutQuery,
        filters: [{ field: "Q15_TOP2_BRAND_PRIORITIES", values: ["Q15r1", "Q15r8"] }]
      },
      requireSnowflakeConfig(env)
    );

    expect(plan.sqlText).toContain("(TRY_TO_NUMBER(Q15r1) = 1 OR LOWER(TO_VARCHAR(Q15r1)) IN ('true', 'yes', 'selected'))");
    expect(plan.sqlText).toContain("(TRY_TO_NUMBER(Q15r8) = 1 OR LOWER(TO_VARCHAR(Q15r8)) IN ('true', 'yes', 'selected'))");
  });

  it("guards generated execution against non-read-only SQL", () => {
    expect(() => assertSnowflakeSqlIsReadOnly("SELECT * FROM ANALYTICS_RESPONSES")).not.toThrow();
    expect(() => assertSnowflakeSqlIsReadOnly("DELETE FROM ANALYTICS_RESPONSES")).toThrow(SnowflakeProviderError);
    expect(() => assertSnowflakeSqlIsReadOnly("SELECT * FROM ANALYTICS_RESPONSES; DROP TABLE USERS")).toThrow(
      "Snowflake provider refused to execute SQL containing statement separators."
    );
  });

  it("rejects unsafe configured Snowflake object names before SQL execution", () => {
    expect(() =>
      buildSnowflakeSqlPlan(breakoutQuery, {
        ...requireSnowflakeConfig(env),
        analyticsTable: "RESPONSES; DROP TABLE USERS"
      })
    ).toThrow("Unsafe Snowflake analytics table: RESPONSES; DROP TABLE USERS.");
  });

  it("normalizes Snowflake rows into the same table-first response contract", () => {
    const result = normalizeSnowflakeRows(breakoutQuery, [
      {
        OPTION_ID: "trust_a_lot",
        OPTION_LABEL: "Trust a lot",
        COLUMN_ID: "gen_z",
        COLUMN_LABEL: "Gen Z",
        VALUE: 18,
        BASE: 312
      },
      {
        OPTION_ID: "trust_a_lot",
        OPTION_LABEL: "Trust a lot",
        COLUMN_ID: "millennial",
        COLUMN_LABEL: "Millennial",
        VALUE: 24,
        BASE: 428
      }
    ]);

    expect(result.columns).toEqual([
      { id: "gen_z", label: "Gen Z" },
      { id: "millennial", label: "Millennial" },
      { id: "gen_x", label: "Gen X" },
      { id: "boomer_plus", label: "Boomer+" }
    ]);
    expect(result.table[0]).toMatchObject({
      optionId: "trust_a_lot",
      values: {
        gen_z: 18,
        millennial: 24,
        gen_x: 0,
        boomer_plus: 0
      },
      bases: {
        gen_z: 312,
        millennial: 428,
        gen_x: 0,
        boomer_plus: 0
      }
    });
    expect(result.statistics.significanceExecutionPlan).toMatchObject({
      status: "ready",
      candidateMethod: "column_comparison",
      providerCanExecute: true,
      executionInputContract: "column_comparison"
    });
    expect(result.statistics.significanceExecutionReport).toMatchObject({
      method: "column_comparison",
      status: "executed",
      inputAccepted: true
    });
    expect(result.notes).toEqual(expect.arrayContaining(["Live Snowflake analytics output.", "Filters were applied by the Snowflake provider."]));
  });

  it("keeps empty and ambiguous Snowflake results visible as warnings while preserving the normalized contract", () => {
    const emptyResult = normalizeSnowflakeRows(breakoutQuery, []);
    expect(emptyResult.warnings).toEqual(expect.arrayContaining([
      "Snowflake returned no rows for this query; the normalized result contains zero-filled expected rows and columns."
    ]));
    expect(emptyResult.table[0].values).toMatchObject({
      gen_z: 0,
      millennial: 0
    });

    const ambiguousResult = normalizeSnowflakeRows(breakoutQuery, [
      { OPTION_ID: "trust_a_lot", COLUMN_ID: "gen_z", VALUE: 18, BASE: 312 },
      { OPTION_ID: "trust_a_lot", COLUMN_ID: "gen_z", VALUE: 19, BASE: 313 },
      { OPTION_ID: "unknown_option", COLUMN_ID: "missing_column", VALUE: 1, BASE: 10 }
    ]);
    expect(ambiguousResult.warnings).toEqual(expect.arrayContaining([
      "Snowflake returned unrecognized option ids: unknown_option.",
      "Snowflake returned unrecognized column ids: missing_column.",
      "Snowflake returned duplicate option/column cells: trust_a_lot/gen_z. The first matching cell was used."
    ]));
    expect(ambiguousResult.table[0].values.gen_z).toBe(18);
  });

  it("executes a supported live query through the injected provider executor", async () => {
    let executedSql = "";
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        executedSql = sqlText;
        return [
          { OPTION_ID: "trust_a_lot", COLUMN_ID: "gen_z", VALUE: 18, BASE: 312 },
          { OPTION_ID: "trust_a_lot", COLUMN_ID: "millennial", VALUE: 24, BASE: 428 }
        ];
      }
    };

    const provider = createSnowflakeAnalyticsProvider(executor, env);
    const result = await provider.runQuery(breakoutQuery);

    expect(executedSql).toContain('"ECOFOCUS"."EXPLORE"."ANALYTICS_RESPONSES"');
    expect(result.query).toMatchObject({
      dataset: "ecofocus_2025",
      question: "Q_PACKAGING_TRUST",
      breakBy: "GENERATION",
      comparisonMode: "none"
    });
    expect(result.metadataRefs).toMatchObject({
      dataset: "ecofocus_2025",
      question: "Q_PACKAGING_TRUST",
      breakBy: "GENERATION"
    });
  });

  it("executes a supported question-filtered live query through the injected provider executor", async () => {
    let executedSql = "";
    const executor: SnowflakeQueryExecutor = {
      async execute(sqlText) {
        executedSql = sqlText;
        return [
          { OPTION_ID: "trust_somewhat", COLUMN_ID: "gen_z", VALUE: 71, BASE: 120 },
          { OPTION_ID: "trust_somewhat", COLUMN_ID: "millennial", VALUE: 69, BASE: 146 }
        ];
      }
    };

    const result = await createSnowflakeAnalyticsProvider(executor, env).runQuery(questionFilteredQuery);

    expect(executedSql).toContain("LOWER(TO_VARCHAR(q_packaging_trust)) IN ('trust_a_lot')");
    expect(result.query.filters).toEqual([{ field: "Q_PACKAGING_TRUST", values: ["trust_a_lot"] }]);
    expect(result.table.find((row) => row.optionId === "trust_somewhat")).toMatchObject({
      values: {
        gen_z: 71,
        millennial: 69
      },
      bases: {
        gen_z: 120,
        millennial: 146
      }
    });
    expect(result.notes).toEqual(expect.arrayContaining(["Filters were applied by the Snowflake provider."]));
  });

  it("wraps executor failures with structured Snowflake provider diagnostics", async () => {
    const provider = createSnowflakeAnalyticsProvider(
      {
        async execute() {
          throw new Error("warehouse is suspended");
        }
      },
      env
    );

    await expect(provider.runQuery(breakoutQuery)).rejects.toMatchObject({
      name: "SnowflakeProviderError",
      code: "snowflake_execution_failed",
      reasons: ["execution_failed"],
      message: "Snowflake query execution failed: warehouse is suspended"
    });
  });

  it("times out slow executor calls with structured Snowflake provider diagnostics", async () => {
    const provider = createSnowflakeAnalyticsProvider(
      {
        async execute() {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return [];
        }
      },
      env
    );

    await expect(provider.runQuery(breakoutQuery)).rejects.toMatchObject({
      name: "SnowflakeProviderError",
      code: "snowflake_execution_timeout",
      reasons: ["execution_timeout"]
    });
  });

  it("keeps unsupported live query shapes explicit", async () => {
    const waveQuery: AnalyticsQueryRequest = {
      ...breakoutQuery,
      breakBy: "SUMMARY",
      chartType: "line_chart",
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024"]
    };

    expect(getSnowflakeQuerySupport(waveQuery)).toMatchObject({
      supported: false,
      reasons: ["wave_comparison_not_live"]
    });
    await expect(createSnowflakeAnalyticsProvider({ execute: async () => [] }, env).runQuery(waveQuery)).rejects.toMatchObject({
      name: "SnowflakeProviderError",
      code: "snowflake_unsupported_query",
      reasons: ["wave_comparison_not_live"],
      message: "Snowflake live execution does not yet support this query shape: wave_comparison_not_live."
    });
  });

  it("does not claim live support for multiple question filters yet", () => {
    const support = getSnowflakeQuerySupport({
      ...breakoutQuery,
      filters: [
        { field: "Q_PACKAGING_TRUST", values: ["trust_a_lot"] },
        { field: "Q_SUSTAINABILITY_IMPORTANCE", values: ["very_important"] }
      ]
    });

    expect(support).toEqual({
      supported: false,
      summary: "Snowflake live execution does not yet support this query shape: multiple_question_filters_not_live.",
      reasons: ["multiple_question_filters_not_live"]
    });
  });
});
