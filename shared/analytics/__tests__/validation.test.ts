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

  it("accepts multiple supported question filters", () => {
    expect(
      validateAnalyticsQuery({
        dataset: "ecofocus_2025",
        question: "Q_PACKAGING_TRUST",
        breakBy: "GENERATION",
        filters: [
          { field: "Q_PACKAGING_TRUST", values: ["trust_a_lot"] },
          { field: "Q_SUSTAINABILITY_IMPORTANCE", values: ["very_important", "somewhat_important"] },
          { field: "Q15_TOP2_BRAND_PRIORITIES", values: ["Q15r1", "Q15r8"] }
        ],
        weight: "weightvar",
        metric: "column_percent",
        chartType: "grouped_bar",
        confidenceLevel: 0.95
      })
    ).toEqual([]);
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

  it("accepts non-overlapping authored variable-set rows", () => {
    expect(
      validateAnalyticsQuery({
        dataset: "ecofocus_2025",
        question: "Q_PACKAGING_TRUST",
        breakBy: "SUMMARY",
        filters: [],
        weight: "weightvar",
        metric: "column_percent",
        chartType: "grouped_bar",
        confidenceLevel: 0.95,
        authoredVariableSet: {
          id: "packaging_trust_recode",
          label: "Packaging trust recode",
          rowMode: "authored",
          rows: [
            {
              id: "trust_net",
              label: "Trust",
              kind: "net",
              sourceOptionIds: ["trust_a_lot", "trust_somewhat"],
              rowOrder: 1,
              visible: true,
              emphasis: "summary"
            },
            {
              id: "distrust",
              label: "Distrust",
              kind: "bottombox",
              sourceOptionIds: ["distrust"],
              rowOrder: 2,
              visible: true,
              emphasis: "summary"
            }
          ]
        }
      })
    ).toEqual([]);
  });

  it("rejects unsupported authored variable-set source options and overlap", () => {
    const errors = validateAnalyticsQuery({
      dataset: "ecofocus_2025",
      question: "Q_PACKAGING_TRUST",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "column_percent",
      chartType: "grouped_bar",
      confidenceLevel: 0.95,
      authoredVariableSet: {
        id: "bad_recode",
        label: "Bad recode",
        rowMode: "authored",
        rows: [
          {
            id: "trust_net",
            label: "Trust",
            kind: "net",
            sourceOptionIds: ["trust_a_lot", "missing_option"],
            rowOrder: 1,
            visible: true,
            emphasis: "summary"
          },
          {
            id: "topbox",
            label: "Top box",
            kind: "topbox",
            sourceOptionIds: ["trust_a_lot"],
            rowOrder: 2,
            visible: true,
            emphasis: "summary"
          }
        ]
      }
    });

    expect(errors).toEqual(expect.arrayContaining([
      "Authored row Trust contains unsupported source options: missing_option.",
      "Authored variable-set rows contain overlapping source options: trust_a_lot (Trust, Top box)."
    ]));
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

  it("accepts wave comparison on supported metadata-backed breakouts", () => {
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
    ).toEqual([]);
  });
});
