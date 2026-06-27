import { describe, expect, it } from "vitest";
import { createAnalyticsQueryPlan } from "../queryPlan";
import type { AnalyticsQueryRequest } from "../../types/analytics";

describe("createAnalyticsQueryPlan", () => {
  it("maps a saved variable set query to provider-neutral source columns", () => {
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

    expect(createAnalyticsQueryPlan(query)).toMatchObject({
      rows: {
        id: "Q15_TOP2_BRAND_PRIORITIES",
        type: "multi_binary_set",
        sourceColumn: "Q15_TOP2",
        sourceVariables: ["Q15r1", "Q15r2", "Q15r7", "Q15r8", "Q15r9"]
      },
      columns: {
        id: "SUMMARY",
        sourceColumn: "__summary"
      },
      metric: {
        id: "percent_selected",
        valueFormat: "percent"
      },
      weight: {
        id: "weightvar",
        sourceColumn: "weightvar"
      },
      statistics: {
        significanceReadiness: {
          status: "not_applicable",
          method: "none",
          reasonCodes: ["summary_only", "no_comparison_basis"],
          comparisonBasis: "summary"
        },
        significanceExecutionPlan: {
          status: "not_applicable",
          candidateMethod: "none",
          queryShapeSupported: false,
          providerCanExecute: false,
          executionInputContract: null,
          reasonCodes: ["summary_only", "no_comparison_basis"],
          unmetPrerequisites: ["comparison_basis"]
        }
      }
    });
  });

  it("includes authored variable-set row intent in the provider-neutral query plan", () => {
    const query: AnalyticsQueryRequest = {
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
            id: "top_trust",
            label: "Trust",
            kind: "net",
            sourceOptionIds: ["trust_a_lot", "trust_somewhat"],
            rowOrder: 1,
            visible: true,
            emphasis: "summary"
          },
          {
            id: "neutral_hidden",
            label: "Neutral",
            kind: "option",
            sourceOptionIds: ["neutral"],
            rowOrder: 2,
            visible: false,
            emphasis: "detail"
          }
        ]
      }
    };

    expect(createAnalyticsQueryPlan(query)).toMatchObject({
      rows: {
        id: "Q_PACKAGING_TRUST",
        authoredVariableSet: {
          id: "packaging_trust_recode",
          label: "Packaging trust recode",
          rowCount: 2,
          visibleRowCount: 1
        }
      }
    });
  });

  it("includes comparison metadata for wave queries", () => {
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

    expect(createAnalyticsQueryPlan(query)).toMatchObject({
      comparison: {
        mode: "wave",
        datasets: ["ecofocus_2024"]
      },
      statistics: {
        significanceReadiness: {
          status: "candidate",
          method: "wave_comparison",
          reasonCodes: ["future_method"],
          comparisonBasis: "wave"
        },
        significanceExecutionPlan: {
          status: "deferred",
          candidateMethod: "wave_comparison",
          queryShapeSupported: true,
          providerCanExecute: false,
          executionInputContract: "wave_comparison",
          reasonCodes: ["wave_comparison_unsupported", "future_method"],
          unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"]
        }
      }
    });
  });

  it("marks wave comparison without selected comparison datasets as missing a comparison basis", () => {
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
      comparisonDatasets: []
    };

    expect(createAnalyticsQueryPlan(query)).toMatchObject({
      statistics: {
        significanceReadiness: {
          status: "not_applicable",
          method: "wave_comparison",
          reasonCodes: ["no_comparison_basis"],
          comparisonBasis: "wave"
        },
        significanceExecutionPlan: {
          status: "not_applicable",
          candidateMethod: "none",
          queryShapeSupported: false,
          providerCanExecute: false,
          executionInputContract: null,
          reasonCodes: ["no_comparison_basis"],
          unmetPrerequisites: ["comparison_basis"]
        }
      }
    });
  });

  it("marks breakout queries as candidate column comparison readiness", () => {
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

    expect(createAnalyticsQueryPlan(query)).toMatchObject({
      statistics: {
        confidenceLevel: 0.95,
        significanceReadiness: {
          status: "candidate",
          method: "column_comparison",
          reasonCodes: ["future_method"],
          comparisonBasis: "breakout"
        },
        significanceExecutionPlan: {
          status: "deferred",
          candidateMethod: "column_comparison",
          queryShapeSupported: true,
          providerCanExecute: false,
          executionInputContract: "column_comparison",
          reasonCodes: ["mock_provider_not_available", "future_method"],
          unmetPrerequisites: ["provider_method", "statistical_engine"]
        }
      }
    });
  });
});
