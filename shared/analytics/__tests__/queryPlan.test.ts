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
          status: "unsupported",
          method: "wave_comparison",
          reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
          comparisonBasis: "wave"
        },
        significanceExecutionPlan: {
          status: "blocked",
          candidateMethod: "wave_comparison",
          queryShapeSupported: false,
          providerCanExecute: false,
          executionInputContract: null,
          reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
          unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"]
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
