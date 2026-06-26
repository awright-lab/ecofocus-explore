import { describe, expect, it } from "vitest";
import {
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
  SNOWFLAKE_ANALYTICS_TABLE: "ANALYTICS_RESPONSES"
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
    await expect(createSnowflakeAnalyticsProvider({ execute: async () => [] }, env).runQuery(waveQuery)).rejects.toThrow(
      "Snowflake live execution does not yet support this query shape: wave_comparison_not_live."
    );
  });

  it("does not claim live support for question-filtered queries yet", () => {
    const support = getSnowflakeQuerySupport({
      ...breakoutQuery,
      filters: [{ field: "Q_PACKAGING_TRUST", values: ["trust_a_lot"] }]
    });

    expect(support).toEqual({
      supported: false,
      summary: "Snowflake live execution does not yet support this query shape: question_filter_not_live.",
      reasons: ["question_filter_not_live"]
    });
  });
});
