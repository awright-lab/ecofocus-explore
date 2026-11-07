import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("snowflake-sdk", () => ({ default: {} }));
import { buildSnowflakeSqlPlan, getSnowflakeQuerySupport, normalizeSnowflakeRows } from "../providers/snowflakeProvider";
import { requireSnowflakeConfig } from "../providers/snowflakeConfig";
import { resultInferenceLabel, withSafeInference } from "../inferenceSafety";
import { applyVariableSetRows } from "../variableSets";
import { validateAnalyticsQuery } from "../validation";
import { executeColumnComparisonSignificance } from "../significanceExecution";
import { buildExecutedColumnComparisonPresentation } from "../../../src/features/builder/components/analysisSignificancePresentationModel";
import { buildAnalysisStatisticsContext } from "../../../src/features/builder/components/analysisStatisticsContextModel";
import { DonutChartView, sampleSizeLabel, getCompatibleChartTypes, supportsDonutResult } from "../../../src/features/builder/components/CanvasRenderers";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../types/analytics";
import type { DashboardTile } from "../../types/dashboard";
import { initialDashboard } from "../../../src/features/document/documentSeeds";
import { buildDashboardExportSpec } from "../../../src/features/builder/builderExportPackage";

// Node 24's in-memory SQLite executes the actual generated predicates and sums.
// Only table naming, Snowflake cast helpers, and numeric division syntax differ.
// No network, files, real credentials or respondent data are used.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const config = requireSnowflakeConfig({ SNOWFLAKE_ACCOUNT: "synthetic", SNOWFLAKE_USERNAME: "synthetic", SNOWFLAKE_PASSWORD: "synthetic-not-a-credential",
  SNOWFLAKE_ROLE: "FIXTURE", SNOWFLAKE_WAREHOUSE: "FIXTURE", SNOWFLAKE_DATABASE: "FIXTURE", SNOWFLAKE_SCHEMA: "FIXTURE", SNOWFLAKE_ANALYTICS_TABLE: "FIXTURE" });
const query: AnalyticsQueryRequest = { dataset: "ecofocus_2025", question: "Q_PACKAGING_TRUST", breakBy: "GENERATION", filters: [], weight: null,
  metric: "column_percent", chartType: "table", confidenceLevel: 0.95 };
function sqlResult(request: AnalyticsQueryRequest, records: Array<Record<string, string | number>>) {
  const db = new DatabaseSync(":memory:");
  try {
    const columns = ["survey_wave", "generation", "q_packaging_trust", "Q15r1", "Q15r2", "Q15r7", "Q15r8", "Q15r9", "weightvar"];
    db.exec(`CREATE TABLE fixture (${columns.join(", ")})`);
    const insert = db.prepare(`INSERT INTO fixture VALUES (${columns.map(() => "?").join(", ")})`);
    for (const row of records) insert.run(...columns.map(column => row[column] ?? null));
    db.function("TO_VARCHAR", (value: unknown) => value == null ? null : String(value));
    const numeric = (value: unknown) => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
    db.function("TRY_TO_DOUBLE", numeric); db.function("TRY_TO_NUMBER", numeric);
    const sql = buildSnowflakeSqlPlan(request, config).sqlText.replaceAll('"FIXTURE"."FIXTURE"."FIXTURE"', "fixture").replaceAll("100 *", "100.0 *");
    return normalizeSnowflakeRows(request, db.prepare(sql).all());
  } finally { db.close(); }
}
function groups(n: number, successesA: number, successesB: number, scale = 1) {
  return ["gen_z", "millennial"].flatMap((generation, index) => Array.from({ length: n }, (_, row) => ({ survey_wave: "2025", generation,
    q_packaging_trust: row < (index === 0 ? successesA : successesB) ? "trust_a_lot" : "distrust", weightvar: scale })));
}
function outcome(result: AnalyticsQueryResponse) {
  return result.statistics.significanceExecutionReport?.result?.outcomes.find(item => "columnId" in item && item.rowId === "trust_a_lot" && item.columnId === "gen_z" && item.comparedColumnId === "millennial");
}
function tile(result: AnalyticsQueryResponse) { return { result, query: result.query, visualization: "donut", appearance: {} } as DashboardTile; }

describe("conservative statistical safety", () => {
  it.each([1, 10, 1000])("does not infer significance from weighted totals at scale %s", scale => {
    const result = sqlResult({ ...query, weight: "weightvar" }, groups(100, 50, 60, scale));
    expect(result.table[0].values.gen_z).toBe(50); expect(result.table[0].values.millennial).toBe(60);
    expect(result.statistics.significance.status).toBe("unsupported"); expect(result.statistics.significanceExecutionReport).toBeNull();
    expect(result.statistics.significance.reasonCodes).toContain("weighted_inference_unsupported");
    expect(result.annotations).toEqual([]); expect(buildExecutedColumnComparisonPresentation(result).cells).toEqual({});
    expect(sampleSizeLabel(result)).toContain("Weighted total="); expect(sampleSizeLabel(result)).not.toContain("Sample n");
    expect(resultInferenceLabel(result)).toBe("Significance unavailable");
    expect(buildAnalysisStatisticsContext(tile(result)).baseDiagnostics.label).toBe("Respondent sample size unavailable");
  });
  it("keeps independent unweighted reference estimates and pooled-z calculation", () => {
    const result = sqlResult(query, groups(100, 50, 60));
    // Independent Python math.erfc reference, not the app's CDF routine.
    expect(outcome(result)?.statistics.pValue).toBeCloseTo(0.155218489684684, 6);
    expect(outcome(result)?.statistics.direction).toBeNull(); expect(sampleSizeLabel(result)).toBe("Sample n=100");
    expect(result.notes.some(note => note.includes("assumes independent samples"))).toBe(true);
  });
  it("retains precision through SQL and avoids the 38/104 rounding false positive", () => {
    const result = sqlResult(query, groups(104, 38, 52));
    expect(result.table[0].values.gen_z).toBeCloseTo(100 * 38 / 104, 12);
    expect(outcome(result)?.statistics.pValue).toBeCloseTo(0.0500795085644665, 6);
    expect(outcome(result)?.statistics.direction).toBeNull(); expect(buildExecutedColumnComparisonPresentation(result).cells["trust_a_lot::gen_z"]).toBeUndefined();
  });
  it("skips sparse comparisons rather than contradict the exact 1/3 probability", () => {
    const result = sqlResult(query, groups(2, 0, 2));
    expect(outcome(result)?.status).toBe("not_tested"); expect(outcome(result)?.statistics.pValue).toBeNull();
    expect(outcome(result)?.statistics.direction).toBeNull(); expect(outcome(result)?.reasonCodes).toContain("insufficient_base");
    expect(buildExecutedColumnComparisonPresentation(result).cells).toEqual({});
    expect(resultInferenceLabel(result)).toBe("No significance test performed");
  });
  it("requires precision evidence even when the provider-neutral executor is called directly", () => {
    const result = sqlResult(query, groups(100, 50, 60));
    const input = result.statistics.significanceExecutionInput!;
    if (input.method !== "column_comparison") throw new Error("Fixture must be column comparison");
    expect(executeColumnComparisonSignificance({ ...input, inferenceBasis: undefined }).summary.testedComparisons).toBe(0);
  });
  it("suppresses cached claims without mutating original measurements or stored objects", () => {
    const current = sqlResult(query, groups(100, 20, 60)); const cached = structuredClone(current);
    delete cached.statistics.inferenceBasis;
    const original = structuredClone(cached); const safe = withSafeInference(cached);
    expect(safe.statistics.significanceExecutionReport).toBeNull(); expect(safe.statistics.significance.reasonCodes).toContain("inference_precision_unverified");
    expect(safe.table).toEqual(original.table); expect(safe.series).toEqual(original.series); expect(cached).toEqual(original);
    expect(buildExecutedColumnComparisonPresentation(cached).available).toBe(false);
    expect(buildAnalysisStatisticsContext(tile(cached)).label).toBe("Significance unavailable");
  });
  it("exports explicit unavailable inference without discarding measurements", () => {
    const result = sqlResult({ ...query, weight: "weightvar" }, groups(100, 50, 60, 10));
    const dashboard = structuredClone(initialDashboard); const page = dashboard.pages[0];
    page.tiles = [{ ...page.tiles[0], query: result.query, result }]; dashboard.pages = [page];
    const exported = buildDashboardExportSpec(dashboard, dashboard.pages).slides[0].tiles[0];
    expect(exported.exportHints.confidence).toBe("Significance unavailable");
    expect(exported.exportHints.sampleSize).toContain("Weighted total=");
    expect(exported.result.table).toEqual(result.table); expect(exported.result.annotations).toEqual([]);
  });
  it.each(["count", "percent_selected"] as const)("executes a multi-response respondent union for %s", metric => {
    const net: AnalyticsQueryRequest = { ...query, question: "Q15_TOP2_BRAND_PRIORITIES", breakBy: "SUMMARY", metric,
      authoredVariableSet: { id: "net", label: "Either", rowMode: "authored", rows: [{ id: "either", label: "Either", kind: "net", sourceOptionIds: ["Q15r1", "Q15r2"], rowOrder: 1, visible: true, emphasis: "summary" }] } };
    const flags = [[1, 1], [1, 1], [1, 1], [1, 0], [0, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
    const records = flags.map(([a, b]) => ({ survey_wave: "2025", Q15r1: a, Q15r2: b }));
    const original = structuredClone(records); const result = sqlResult(net, records);
    const union = flags.filter(([a, b]) => a === 1 || b === 1).length;
    expect(union).toBe(5); expect(result.table[0].values.summary).toBe(metric === "count" ? 5 : 50); expect(records).toEqual(original);
    const marginals = sqlResult({ ...net, authoredVariableSet: undefined }, records);
    expect(() => applyVariableSetRows(marginals, net.authoredVariableSet!)).toThrow("respondent-level union");
  });
  it("counts each weighted union respondent once", () => {
    const net: AnalyticsQueryRequest = { ...query, question: "Q15_TOP2_BRAND_PRIORITIES", breakBy: "SUMMARY", metric: "count", weight: "weightvar",
      authoredVariableSet: { id: "net", label: "Either", rowMode: "authored", rows: [{ id: "either", label: "Either", kind: "net", sourceOptionIds: ["Q15r1", "Q15r2"], rowOrder: 1, visible: true, emphasis: "summary" }] } };
    const result = sqlResult(net, [{ survey_wave: "2025", Q15r1: 1, Q15r2: 1, weightvar: 3 }, { survey_wave: "2025", Q15r1: 1, Q15r2: 0, weightvar: 2 }, { survey_wave: "2025", Q15r1: 0, Q15r2: 0, weightvar: 5 }]);
    expect(result.table[0].values.summary).toBe(5); expect(result.statistics.significanceExecutionReport).toBeNull();
  });
  it("blocks new and cached multi-response donuts, including count metrics", () => {
    const donut: AnalyticsQueryRequest = { ...query, question: "Q15_TOP2_BRAND_PRIORITIES", breakBy: "SUMMARY", chartType: "donut", metric: "percent_selected" };
    expect(validateAnalyticsQuery(donut).some(message => message.includes("mutually exclusive"))).toBe(true);
    expect(getSnowflakeQuerySupport(donut).supported).toBe(false);
    const result = sqlResult({ ...donut, chartType: "table" }, [{ survey_wave: "2025", Q15r1: 1, Q15r2: 1 }]);
    expect(getCompatibleChartTypes(result)).not.toContain("donut");
    expect(renderToStaticMarkup(<DonutChartView tile={tile(result)} />)).toContain("Donut unavailable");
    expect(renderToStaticMarkup(<DonutChartView tile={tile({ ...result, metric: { id: "count", label: "Count", valueFormat: "number" } })} />)).toContain("Donut unavailable");
  });
  it("blocks incomplete percentage wholes while allowing exclusive rounding error", () => {
    const full = sqlResult({ ...query, breakBy: "SUMMARY" }, groups(100, 50, 60));
    expect(supportsDonutResult(full)).toBe(true);
    const incomplete = { ...full, table: full.table.filter(row => row.optionId === "trust_a_lot") };
    expect(supportsDonutResult(incomplete)).toBe(false);
    expect(renderToStaticMarkup(<DonutChartView tile={tile(incomplete)} />)).toContain("Donut unavailable");
    const rounded = { ...full, table: full.table.slice(0, 3).map(row => ({ ...row, values: { summary: 33.3 } })) };
    expect(supportsDonutResult(rounded)).toBe(true);
  });
});
