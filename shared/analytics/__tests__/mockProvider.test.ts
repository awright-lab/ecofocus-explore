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
    expect(result.annotations).toEqual(
      expect.arrayContaining([
        { rowId: "Q15r8", columnId: "summary", direction: "down", confidence: 0.95 },
        { rowId: "Q15r9", columnId: "summary", direction: "up", confidence: 0.95 }
      ])
    );
    expect(result.statistics).toEqual({
      confidenceLevel: 0.95,
      significanceMethod: "mock_placeholder",
      significanceExecutionPlan: {
        status: "not_applicable",
        candidateMethod: "none",
        queryShapeSupported: false,
        providerCanExecute: false,
        executionInputContract: null,
        reasonCodes: ["summary_only", "no_comparison_basis"],
        unmetPrerequisites: ["comparison_basis"]
      },
      significanceExecutionInput: null,
      significanceExecutionReport: null,
      significance: {
        status: "placeholder",
        method: "mock_placeholder",
        readiness: {
          status: "not_applicable",
          method: "none",
          reasonCodes: ["summary_only", "no_comparison_basis"],
          comparisonBasis: "summary"
        },
        reasonCodes: ["mock_provider_placeholder"],
        comparisonBasis: "summary",
        hasPlaceholders: true,
        details: [
          { rowId: "Q15r8", columnId: "summary", direction: "down", confidence: 0.95, status: "placeholder", reasonCodes: ["mock_provider_placeholder"] },
          { rowId: "Q15r9", columnId: "summary", direction: "up", confidence: 0.95, status: "placeholder", reasonCodes: ["mock_provider_placeholder"] }
        ]
      }
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
    expect(result.statistics).toEqual({
      confidenceLevel: 0.95,
      significanceMethod: "none",
      significanceExecutionPlan: {
        status: "blocked",
        candidateMethod: "wave_comparison",
        queryShapeSupported: false,
        providerCanExecute: false,
        executionInputContract: null,
        reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
        unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"]
      },
      significanceExecutionInput: null,
      significanceExecutionReport: null,
      significance: {
        status: "unsupported",
        method: "none",
        readiness: {
          status: "unsupported",
          method: "wave_comparison",
          reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
          comparisonBasis: "wave"
        },
        reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
        comparisonBasis: "wave",
        hasPlaceholders: false,
        details: []
      }
    });
  });

  it("marks breakout results as eligible but not tested when no placeholder annotations exist", async () => {
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
    expect(result.statistics).toEqual({
      confidenceLevel: 0.95,
      significanceMethod: "column_comparison",
      significanceExecutionPlan: {
        status: "deferred",
        candidateMethod: "column_comparison",
        queryShapeSupported: true,
        providerCanExecute: false,
        executionInputContract: "column_comparison",
        reasonCodes: ["mock_provider_not_available", "future_method"],
        unmetPrerequisites: ["provider_method", "statistical_engine"]
      },
      significanceExecutionInput: {
        method: "column_comparison",
        confidenceLevel: 0.95,
        metric: {
          id: "column_percent",
          valueFormat: "percent"
        },
        comparisonScope: {
          basis: "breakout",
          rowIds: ["trust_a_lot", "trust_somewhat", "neutral", "distrust"],
          columnIds: ["gen_z", "millennial", "gen_x", "boomer_plus"]
        },
        columns: [
          { id: "gen_z", label: "Gen Z" },
          { id: "millennial", label: "Millennial" },
          { id: "gen_x", label: "Gen X" },
          { id: "boomer_plus", label: "Boomer+" }
        ],
        rows: expect.arrayContaining([
          {
            id: "trust_a_lot",
            label: "Trust a lot",
            cells: [
              { columnId: "gen_z", value: 18, base: 312 },
              { columnId: "millennial", value: 24, base: 428 },
              { columnId: "gen_x", value: 19, base: 390 },
              { columnId: "boomer_plus", value: 14, base: 365 }
            ]
          }
        ])
      },
      significanceExecutionReport: {
        method: "column_comparison",
        status: "deferred",
        inputAccepted: true,
        reasonCodes: ["mock_provider_not_available", "future_method"],
        unmetPrerequisites: ["provider_method", "statistical_engine"],
        result: null
      },
      significance: {
        status: "eligible",
        method: "column_comparison",
        readiness: {
          status: "candidate",
          method: "column_comparison",
          reasonCodes: ["future_method"],
          comparisonBasis: "breakout"
        },
        reasonCodes: ["future_method"],
        comparisonBasis: "breakout",
        hasPlaceholders: false,
        details: []
      }
    });
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
