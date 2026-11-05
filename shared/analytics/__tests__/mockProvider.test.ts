import { describe, expect, it } from "vitest";
import { mockAnalyticsProvider } from "../providers/mockProvider";
import type { AnalyticsQueryRequest } from "../../types/analytics";

describe("mockAnalyticsProvider", () => {
  it("returns normalized table-first output for Q15 Top 2", async () => {
    const query: AnalyticsQueryRequest = {
      dataset: "ecofocus_2025",
      question: "Q15_TOP2_BRAND_PRIORITIES",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "percent_selected",
      chartType: "vertical_bar",
      confidenceLevel: 0.95
    };

    const result = await mockAnalyticsProvider.runQuery(query);

    expect(result.columns).toEqual([{ id: "summary", label: "Summary" }]);
    expect(result.table).toHaveLength(5);
    expect(result.table[0]).toMatchObject({
      optionId: "Q15r1",
      values: { summary: 53 },
      bases: { summary: 3125 }
    });
    expect(result.weighting).toEqual({
      applied: true,
      id: "weightvar",
      label: "EcoFocus respondent weight"
    });
    expect(result.annotations).toEqual([]);
    expect(result.statistics).toMatchObject({
      significanceMethod: "none",
      significanceExecutionPlan: { status: "blocked", providerCanExecute: false, reasonCodes: ["weighted_inference_unsupported"] },
      significanceExecutionInput: null, significanceExecutionReport: null,
      significance: { status: "unsupported", hasPlaceholders: false, details: [] }
    });
  });

  it("applies authored variable-set rows when the query carries authored row definitions", async () => {
    const result = await mockAnalyticsProvider.runQuery({
      dataset: "ecofocus_2025",
      question: "Q_SUSTAINABILITY_IMPORTANCE",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "column_percent",
      chartType: "grouped_bar",
      confidenceLevel: 0.95,
      authoredVariableSet: {
        id: "sustainability_importance_recode",
        label: "Sustainability importance recode",
        rowMode: "authored",
        rows: [
          {
            id: "high_importance",
            label: "High importance",
            kind: "topbox",
            sourceOptionIds: ["very_important"],
            rowOrder: 1,
            visible: true,
            emphasis: "summary"
          },
          {
            id: "middle_importance",
            label: "Middle importance",
            kind: "net",
            sourceOptionIds: ["somewhat_important", "not_very_important"],
            rowOrder: 2,
            visible: true,
            emphasis: "detail"
          }
        ]
      }
    });

    expect(result.table.map((row) => row.optionId)).toEqual(["high_importance", "middle_importance"]);
    expect(result.table[0]).toMatchObject({
      label: "High importance",
      values: { summary: 31 },
      presentation: {
        rowKind: "topbox",
        emphasis: "summary"
      }
    });
    expect(result.table[1]).toMatchObject({
      label: "Middle importance",
      values: { summary: 60 },
      presentation: {
        rowKind: "net",
        emphasis: "detail"
      }
    });
    expect(result.metadataRefs.authoredVariableSet).toEqual({
      id: "sustainability_importance_recode",
      label: "Sustainability importance recode",
      applied: true
    });
  });

  it("returns wave comparison output across datasets", async () => {
    const query: AnalyticsQueryRequest = {
      dataset: "ecofocus_2025",
      question: "Q_PACKAGING_TRUST",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "column_percent",
      chartType: "line_chart",
      confidenceLevel: 0.95,
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024"]
    };

    const result = await mockAnalyticsProvider.runQuery(query);

    expect(result.columns).toEqual([
      { id: "ecofocus_2025", label: "2025" },
      { id: "ecofocus_2024", label: "2024" }
    ]);
    expect(result.table[0]).toMatchObject({
      optionId: "trust_a_lot",
      values: { ecofocus_2025: 20, ecofocus_2024: 17 },
      bases: { ecofocus_2025: 1495, ecofocus_2024: 1410 }
    });
    expect(result.metadataRefs).toMatchObject({
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024"]
    });
    expect(result.statistics).toMatchObject({
      significanceMethod: "none",
      significanceExecutionPlan: { status: "blocked", providerCanExecute: false, reasonCodes: ["weighted_inference_unsupported"] },
      significanceExecutionInput: null, significanceExecutionReport: null,
      significance: { status: "unsupported", hasPlaceholders: false, details: [] }
    });
    expect(result.statistics.significanceExecutionReport).toBeNull();
  });

  it("suppresses statistical claims for weighted mock breakout results", async () => {
    const query: AnalyticsQueryRequest = {
      dataset: "ecofocus_2025",
      question: "Q_PACKAGING_TRUST",
      breakBy: "GENERATION",
      filters: [],
      weight: "weightvar",
      metric: "column_percent",
      chartType: "grouped_bar",
      confidenceLevel: 0.95
    };

    const result = await mockAnalyticsProvider.runQuery(query);

    expect(result.columns.map((column) => column.id)).toEqual(["gen_z", "millennial", "gen_x", "boomer_plus"]);
    expect(result.annotations).toEqual([]);
    expect(result.statistics).toMatchObject({
      significanceMethod: "none",
      significanceExecutionPlan: { status: "blocked", providerCanExecute: false, reasonCodes: ["weighted_inference_unsupported"] },
      significanceExecutionInput: null, significanceExecutionReport: null,
      significance: { status: "unsupported", hasPlaceholders: false, details: [] }
    });
    expect(result.statistics.significanceExecutionReport).toBeNull();
    expect(result.warnings.some(warning => warning.includes("survey design"))).toBe(true);
  });

  it("returns multi-wave trend output when multiple comparison datasets are selected", async () => {
    const query: AnalyticsQueryRequest = {
      dataset: "ecofocus_2025",
      question: "Q_SUSTAINABILITY_IMPORTANCE",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "column_percent",
      chartType: "line_chart",
      confidenceLevel: 0.95,
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024", "ecofocus_2023"]
    };

    const result = await mockAnalyticsProvider.runQuery(query);

    expect(result.columns).toEqual([
      { id: "ecofocus_2025", label: "2025" },
      { id: "ecofocus_2024", label: "2024" },
      { id: "ecofocus_2023", label: "2023" }
    ]);
    expect(result.table[0]).toMatchObject({
      optionId: "very_important",
      values: { ecofocus_2025: 31, ecofocus_2024: 27, ecofocus_2023: 24 }
    });
  });
});
