import { describe, expect, it } from "vitest";
import { runColumnComparisonSignificanceAdapter } from "../significanceExecution";
import type {
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsColumnComparisonExecutionResult,
  AnalyticsSignificanceExecutionPlan
} from "../../types/analytics";

const columnComparisonInput: AnalyticsColumnComparisonExecutionInput = {
  method: "column_comparison",
  confidenceLevel: 0.95,
  metric: {
    id: "column_percent",
    valueFormat: "percent"
  },
  comparisonScope: {
    basis: "breakout",
    rowIds: ["trust_a_lot"],
    columnIds: ["gen_z", "millennial"]
  },
  columns: [
    { id: "gen_z", label: "Gen Z" },
    { id: "millennial", label: "Millennial" }
  ],
  rows: [
    {
      id: "trust_a_lot",
      label: "Trust a lot",
      cells: [
        { columnId: "gen_z", value: 18, base: 312 },
        { columnId: "millennial", value: 24, base: 428 }
      ]
    }
  ]
};

const deferredColumnComparisonPlan: AnalyticsSignificanceExecutionPlan = {
  status: "deferred",
  candidateMethod: "column_comparison",
  queryShapeSupported: true,
  providerCanExecute: false,
  executionInputContract: "column_comparison",
  reasonCodes: ["mock_provider_not_available", "future_method"],
  unmetPrerequisites: ["provider_method", "statistical_engine"]
};

describe("runColumnComparisonSignificanceAdapter", () => {
  it("returns a deferred report for valid column-comparison input when execution prerequisites are missing", () => {
    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, deferredColumnComparisonPlan)).toEqual({
      method: "column_comparison",
      status: "deferred",
      inputAccepted: true,
      reasonCodes: ["mock_provider_not_available", "future_method"],
      unmetPrerequisites: ["provider_method", "statistical_engine"],
      result: null
    });
  });

  it("returns a not-executed report when the provider is marked executable but no real engine is wired yet", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredColumnComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: ["future_method"],
      unmetPrerequisites: []
    };

    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, readyPlan)).toEqual({
      method: "column_comparison",
      status: "not_executed",
      inputAccepted: true,
      reasonCodes: ["future_method"],
      unmetPrerequisites: [],
      result: null
    });
  });

  it("does not fabricate a report when no column-comparison input is available", () => {
    expect(runColumnComparisonSignificanceAdapter(null, deferredColumnComparisonPlan)).toBeNull();
  });

  it("keeps unsupported or non-column paths outside the column-comparison adapter", () => {
    const unsupportedPlan: AnalyticsSignificanceExecutionPlan = {
      status: "blocked",
      candidateMethod: "wave_comparison",
      queryShapeSupported: false,
      providerCanExecute: false,
      executionInputContract: null,
      reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
      unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"]
    };

    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, unsupportedPlan)).toBeNull();
  });

  it("reserves a typed result payload shape without requiring current execution output", () => {
    const futureEmptyResult: AnalyticsColumnComparisonExecutionResult = {
      method: "column_comparison",
      comparisonScope: {
        basis: "breakout",
        rowIds: ["trust_a_lot"],
        columnIds: ["gen_z", "millennial"]
      },
      outcomes: [],
      summary: {
        testedComparisons: 0,
        deferredComparisons: 0
      }
    };

    expect(futureEmptyResult).toEqual({
      method: "column_comparison",
      comparisonScope: {
        basis: "breakout",
        rowIds: ["trust_a_lot"],
        columnIds: ["gen_z", "millennial"]
      },
      outcomes: [],
      summary: {
        testedComparisons: 0,
        deferredComparisons: 0
      }
    });
    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, deferredColumnComparisonPlan)?.result).toBeNull();
  });
});
