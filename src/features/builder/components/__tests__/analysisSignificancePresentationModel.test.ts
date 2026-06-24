import { describe, expect, it } from "vitest";
import { runMockAnalyticsQuery } from "../../../../../shared/mock/analytics";
import type { AnalyticsQueryRequest } from "../../../../../shared/types/analytics";
import {
  buildExecutedColumnComparisonPresentation,
  buildExecutedSignificanceExplanationView,
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

  it("builds a compact explanation for executed table markers", () => {
    const result = runMockAnalyticsQuery(breakoutQuery);
    const explanation = buildExecutedSignificanceExplanationView(result);

    expect(explanation).toMatchObject({
      available: true,
      label: "Tested table markers",
      message: expect.stringContaining("Sig markers"),
      chips: [
        "24 tested comparisons",
        expect.stringContaining("significant comparisons"),
        "95% confidence"
      ],
      comparedColumns: ["Gen Z", "Millennial", "Gen X", "Boomer+"],
      markerMeanings: [
        "Sig ↑ means this cell tested higher than the listed comparison column.",
        "Sig ↓ means this cell tested lower than the listed comparison column.",
        "A number on the marker means the cell differs from multiple columns."
      ]
    });
    expect(explanation.exampleCells.length).toBeGreaterThan(0);
    expect(explanation.exampleCells[0]).toMatchObject({
      label: expect.stringContaining("Sig")
    });
  });
});
