import { describe, expect, it } from "vitest";
import { runMockAnalyticsQuery } from "../../../../../shared/mock/analytics";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../../shared/types/dashboard";
import { buildAnalysisStatisticsContext } from "../analysisStatisticsContextModel";

const breakoutQuery: AnalyticsQueryRequest = {
  dataset: "ecofocus_2025",
  question: "Q_PACKAGING_TRUST",
  breakBy: "GENERATION",
  filters: [],
  weight: "weightvar",
  metric: "column_percent",
  chartType: "grouped_bar",
  confidenceLevel: 0.95
};

const summaryQuery: AnalyticsQueryRequest = {
  ...breakoutQuery,
  breakBy: "SUMMARY",
  chartType: "vertical_bar"
};

function tileFromResult(result: AnalyticsQueryResponse): DashboardTile {
  return {
    id: "tile_test",
    name: "Test tile",
    title: "Test tile",
    locked: false,
    hidden: false,
    layout: {
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      zIndex: 1
    },
    query: result.query,
    visualization: result.query.chartType,
    result,
    appearance: {}
  } as DashboardTile;
}

describe("buildAnalysisStatisticsContext", () => {
  it("explains executed column-comparison significance", () => {
    const result = runMockAnalyticsQuery(breakoutQuery);
    const view = buildAnalysisStatisticsContext(tileFromResult(result));

    expect(view.executionDiagnostics).toMatchObject({
      status: "executed",
      label: "Significance executed",
      chips: ["column_comparison", "Executed", expect.stringContaining("significant")]
    });
    expect(view.executionDiagnostics.message).toContain("Column-comparison significance ran");
    expect(view.eligibility.status).toBe("candidate");
    expect(view.chips).toEqual(expect.arrayContaining(["Executed"]));
  });

  it("distinguishes malformed execution input from provider-deferred execution", () => {
    const result = runMockAnalyticsQuery(breakoutQuery);
    const invalidResult: AnalyticsQueryResponse = {
      ...result,
      statistics: {
        ...result.statistics,
        significanceExecutionPlan: {
          ...result.statistics.significanceExecutionPlan,
          reasonCodes: ["mock_provider_not_available", "future_method", "invalid_execution_input"],
          unmetPrerequisites: ["provider_method", "statistical_engine", "execution_input"]
        },
        significanceExecutionReport: {
          method: "column_comparison",
          status: "deferred",
          inputAccepted: false,
          reasonCodes: ["mock_provider_not_available", "future_method", "invalid_execution_input"],
          unmetPrerequisites: ["provider_method", "statistical_engine", "execution_input"],
          result: null
        }
      }
    };
    const view = buildAnalysisStatisticsContext(tileFromResult(invalidResult));

    expect(view.executionDiagnostics).toMatchObject({
      status: "invalid",
      label: "Execution input needs review",
      chips: ["Invalid input", "column_comparison", "No test performed"]
    });
    expect(view.executionDiagnostics.details).toEqual(expect.arrayContaining(["Invalid execution input", "Execution input"]));
    expect(view.executionDiagnostics.message).toContain("malformed or incomplete");
  });

  it("explains deferred wave comparison execution separately", () => {
    const result = runMockAnalyticsQuery({
      ...summaryQuery,
      chartType: "line_chart",
      comparisonMode: "wave",
      comparisonDatasets: ["ecofocus_2024"]
    });
    const view = buildAnalysisStatisticsContext(tileFromResult(result));

    expect(view.executionDiagnostics).toMatchObject({
      status: "deferred",
      label: "Execution deferred",
      chips: ["wave_comparison", "Input accepted", "Provider deferred"]
    });
    expect(view.executionDiagnostics.message).toContain("Wave-comparison input was accepted");
    expect(view.executionDiagnostics.helper).toContain("typed for future trend significance");
    expect(view.executionDiagnostics.details).toEqual(expect.arrayContaining(["Wave comparison significance unsupported", "Wave support"]));
    expect(view.eligibility.status).toBe("candidate");
  });

  it("explains ready structure that is still not executed", () => {
    const result = runMockAnalyticsQuery(breakoutQuery);
    const readyResult: AnalyticsQueryResponse = {
      ...result,
      statistics: {
        ...result.statistics,
        significanceExecutionPlan: {
          ...result.statistics.significanceExecutionPlan,
          status: "ready",
          providerCanExecute: true,
          reasonCodes: ["future_method"],
          unmetPrerequisites: []
        },
        significanceExecutionReport: {
          ...result.statistics.significanceExecutionReport!,
          status: "not_executed",
          reasonCodes: ["future_method"],
          unmetPrerequisites: []
        }
      }
    };
    const view = buildAnalysisStatisticsContext(tileFromResult(readyResult));

    expect(view.executionDiagnostics).toMatchObject({
      status: "ready",
      label: "Execution handoff ready",
      chips: ["column_comparison", "Ready structure", "Not executed"]
    });
    expect(view.executionDiagnostics.message).toContain("still does not run statistical tests");
  });

  it("preserves placeholder significance interpretation", () => {
    const result = runMockAnalyticsQuery({
      ...summaryQuery,
      question: "Q15_TOP2_BRAND_PRIORITIES",
      metric: "percent_selected"
    });
    const view = buildAnalysisStatisticsContext(tileFromResult(result));

    expect(view.status).toBe("placeholder");
    expect(view.message).toContain("placeholder significance");
    expect(view.executionDiagnostics).toMatchObject({
      status: "unsupported",
      label: "No execution basis"
    });
  });

  it("preserves no-test summary-only interpretation", () => {
    const result = runMockAnalyticsQuery(summaryQuery);
    const view = buildAnalysisStatisticsContext(tileFromResult(result));

    expect(view.status).toBe("none");
    expect(view.message).toContain("no significance method is active");
    expect(view.eligibility.status).toBe("limited");
    expect(view.executionDiagnostics).toMatchObject({
      status: "unsupported",
      label: "No execution basis",
      chips: ["No method", "Not applicable", "No test performed"]
    });
  });
});
