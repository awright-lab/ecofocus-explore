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
      significanceMethod: "mock_placeholder"
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
      significanceMethod: "none"
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
