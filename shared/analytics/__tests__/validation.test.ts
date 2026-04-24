import { describe, expect, it } from "vitest";
import { validateAnalyticsQuery } from "../validation";
import type { AnalyticsQueryRequest } from "../../types/analytics";

const q15Query: AnalyticsQueryRequest = {
  dataset: "ecofocus_2025",
  question: "Q15_TOP2_BRAND_PRIORITIES",
  breakBy: "SUMMARY",
  filters: [],
  weight: "weightvar",
  metric: "percent_selected",
  chartType: "vertical_bar",
  confidenceLevel: 0.95
};

describe("validateAnalyticsQuery", () => {
  it("accepts the Q15 saved variable set summary query", () => {
    expect(validateAnalyticsQuery(q15Query)).toEqual([]);
  });

  it("rejects unsupported breakouts for the Q15 saved variable set", () => {
    expect(validateAnalyticsQuery({ ...q15Query, breakBy: "GENERATION" })).toContain("Question does not support this breakBy dimension.");
  });

  it("rejects unsupported chart types for a question", () => {
    expect(validateAnalyticsQuery({ ...q15Query, chartType: "grouped_bar" })).toContain("Unsupported chartType.");
  });

  it("rejects unsupported weights", () => {
    expect(validateAnalyticsQuery({ ...q15Query, weight: "bad_weight" as AnalyticsQueryRequest["weight"] })).toContain("Unsupported weight.");
  });

  it("rejects unsupported confidence levels", () => {
    expect(validateAnalyticsQuery({ ...q15Query, confidenceLevel: 0.8 as AnalyticsQueryRequest["confidenceLevel"] })).toContain("Unsupported confidence level.");
  });

  it("rejects unsupported filter values", () => {
    const errors = validateAnalyticsQuery({
      ...q15Query,
      filters: [{ field: "SHOPPER_SEGMENT", values: ["not_a_segment"] }]
    });

    expect(errors).toContain("Filter SHOPPER_SEGMENT contains unsupported values: not_a_segment.");
  });

  it("accepts a valid wave comparison query", () => {
    expect(
      validateAnalyticsQuery({
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
      })
    ).toEqual([]);
  });

  it("rejects wave comparison without a comparison dataset", () => {
    expect(
      validateAnalyticsQuery({
        dataset: "ecofocus_2025",
        question: "Q_PACKAGING_TRUST",
        breakBy: "SUMMARY",
        filters: [],
        weight: "weightvar",
        metric: "column_percent",
        chartType: "line_chart",
        confidenceLevel: 0.95,
        comparisonMode: "wave",
        comparisonDatasets: []
      })
    ).toContain("Wave comparison needs at least one comparison dataset.");
  });

  it("rejects wave comparison on non-summary breakouts", () => {
    expect(
      validateAnalyticsQuery({
        dataset: "ecofocus_2025",
        question: "Q_PACKAGING_TRUST",
        breakBy: "GENERATION",
        filters: [],
        weight: "weightvar",
        metric: "column_percent",
        chartType: "line_chart",
        confidenceLevel: 0.95,
        comparisonMode: "wave",
        comparisonDatasets: ["ecofocus_2024"]
      })
    ).toContain("Wave comparison currently supports Summary only.");
  });
});
