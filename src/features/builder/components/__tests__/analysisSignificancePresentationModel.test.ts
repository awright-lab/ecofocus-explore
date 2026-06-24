import { describe, expect, it } from "vitest";
import { runMockAnalyticsQuery } from "../../../../../shared/mock/analytics";
import type { AnalyticsQueryRequest } from "../../../../../shared/types/analytics";
import {
  buildExecutedColumnComparisonPresentation,
  getExecutedSignificanceCell
} from "../analysisSignificancePresentationModel";

const breakoutQuery: AnalyticsQueryRequest = {
  dataset: "ecofocus_2025",
  question: "Q_PACKAGING_TRUST",
  breakBy: "GENERATION",
  filters: [],
  weight: "weightvar",
  metric: "column_percent",
  chartType: "table",
  confidenceLevel: 0.95
};

describe("buildExecutedColumnComparisonPresentation", () => {
  it("maps executed column-comparison outcomes onto result table cells", () => {
    const result = runMockAnalyticsQuery(breakoutQuery);
    const presentation = buildExecutedColumnComparisonPresentation(result);
    const genZCell = getExecutedSignificanceCell(presentation, "trust_a_lot", "gen_z");
    const millennialCell = getExecutedSignificanceCell(presentation, "trust_a_lot", "millennial");

    expect(presentation).toMatchObject({
      available: true,
      testedComparisons: 24,
      significantComparisons: expect.any(Number)
    });
    expect(presentation.summaryLabel).toContain("tested column comparisons");
    expect(genZCell).toMatchObject({
      rowId: "trust_a_lot",
      columnId: "gen_z",
      direction: "down",
      label: "Sig ↓",
      comparedLabels: ["Millennial"]
    });
    expect(genZCell?.title).toContain("Lower than Millennial");
    expect(millennialCell).toMatchObject({
      rowId: "trust_a_lot",
      columnId: "millennial",
      direction: "up",
      comparisonCount: 2,
      comparedLabels: ["Gen Z", "Boomer+"],
      label: "Sig ↑ 2"
    });
  });

  it("stays unavailable for summary-only and unsupported contexts", () => {
    const summaryResult = runMockAnalyticsQuery({
      ...breakoutQuery,
      breakBy: "SUMMARY",
      chartType: "vertical_bar"
    });
    const waveResult = runMockAnalyticsQuery({
      ...breakoutQuery,
      breakBy: "SUMMARY",
      chartType: "line_chart",
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024"]
    });

    expect(buildExecutedColumnComparisonPresentation(summaryResult)).toMatchObject({
      available: false,
      cells: {}
    });
    expect(buildExecutedColumnComparisonPresentation(waveResult)).toMatchObject({
      available: false,
      cells: {}
    });
  });
});
