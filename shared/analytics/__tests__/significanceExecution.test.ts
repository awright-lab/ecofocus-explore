import { describe, expect, it } from "vitest";
import {
  executeColumnComparisonSignificance,
  runColumnComparisonSignificanceAdapter,
  runWaveComparisonSignificanceAdapter,
  shapeDeferredColumnComparisonResult,
  shapeDeferredWaveComparisonResult,
  validateColumnComparisonExecutionInput,
  validateWaveComparisonExecutionInput
} from "../significanceExecution";
import type {
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsColumnComparisonExecutionResult,
  AnalyticsSignificanceExecutionPlan,
  AnalyticsWaveComparisonExecutionInput
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

const waveComparisonInput: AnalyticsWaveComparisonExecutionInput = {
  method: "wave_comparison",
  confidenceLevel: 0.95,
  metric: {
    id: "column_percent",
    valueFormat: "percent"
  },
  comparisonScope: {
    basis: "wave",
    rowIds: ["trust_a_lot"],
    waveIds: ["ecofocus_2025", "ecofocus_2024"],
    primaryDatasetId: "ecofocus_2025",
    comparisonDatasetIds: ["ecofocus_2024"]
  },
  waves: [
    { id: "ecofocus_2025", label: "2025" },
    { id: "ecofocus_2024", label: "2024" }
  ],
  rows: [
    {
      id: "trust_a_lot",
      label: "Trust a lot",
      cells: [
        { waveId: "ecofocus_2025", value: 20, base: 1495 },
        { waveId: "ecofocus_2024", value: 17, base: 1410 }
      ]
    }
  ]
};

const deferredWaveComparisonPlan: AnalyticsSignificanceExecutionPlan = {
  status: "deferred",
  candidateMethod: "wave_comparison",
  queryShapeSupported: true,
  providerCanExecute: false,
  executionInputContract: "wave_comparison",
  reasonCodes: ["wave_comparison_unsupported", "future_method"],
  unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"]
};

describe("runColumnComparisonSignificanceAdapter", () => {
  it("validates structurally usable column-comparison input", () => {
    expect(validateColumnComparisonExecutionInput(columnComparisonInput)).toEqual({
      valid: true,
      reasonCodes: [],
      unmetPrerequisites: []
    });
  });

  it("returns a deferred report for valid column-comparison input when execution prerequisites are missing", () => {
    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, deferredColumnComparisonPlan)).toEqual({
      method: "column_comparison",
      status: "deferred",
      inputAccepted: true,
      reasonCodes: ["mock_provider_not_available", "future_method"],
      unmetPrerequisites: ["provider_method", "statistical_engine"],
      result: {
        method: "column_comparison",
        comparisonScope: {
          basis: "breakout",
          rowIds: ["trust_a_lot"],
          columnIds: ["gen_z", "millennial"]
        },
        outcomes: [
          {
            rowId: "trust_a_lot",
            columnId: "gen_z",
            comparedColumnId: "millennial",
            status: "deferred",
            reasonCodes: ["mock_provider_not_available", "future_method"],
            statistics: {
              pValue: null,
              confidence: null,
              direction: null
            }
          }
        ],
        summary: {
          testedComparisons: 0,
          deferredComparisons: 1,
          significantComparisons: 0
        }
      }
    });
  });

  it("executes valid percent column-comparison input when the provider can run the method", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredColumnComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };

    const report = runColumnComparisonSignificanceAdapter(columnComparisonInput, readyPlan);

    expect(report).toMatchObject({
      method: "column_comparison",
      status: "executed",
      inputAccepted: true,
      reasonCodes: [],
      unmetPrerequisites: [],
      result: {
        method: "column_comparison",
        comparisonScope: {
          basis: "breakout",
          rowIds: ["trust_a_lot"],
          columnIds: ["gen_z", "millennial"]
        },
        outcomes: [
          {
            rowId: "trust_a_lot",
            columnId: "gen_z",
            comparedColumnId: "millennial",
            status: "tested",
            reasonCodes: [],
            statistics: {
              confidence: 0.95,
              direction: "down"
            }
          }
        ],
        summary: {
          testedComparisons: 1,
          deferredComparisons: 0,
          significantComparisons: 1
        }
      }
    });
    expect(report?.result?.outcomes[0].statistics.pValue).toBeGreaterThan(0);
    expect(report?.result?.outcomes[0].statistics.pValue).toBeLessThan(1);
  });

  it("returns a not-executed report for executable plans outside the percent column-comparison path", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredColumnComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: ["future_method"],
      unmetPrerequisites: []
    };
    const countInput: AnalyticsColumnComparisonExecutionInput = {
      ...columnComparisonInput,
      metric: {
        id: "count",
        valueFormat: "number"
      }
    };

    expect(runColumnComparisonSignificanceAdapter(countInput, readyPlan)).toEqual({
      method: "column_comparison",
      status: "not_executed",
      inputAccepted: true,
      reasonCodes: ["future_method"],
      unmetPrerequisites: [],
      result: shapeDeferredColumnComparisonResult(countInput, ["future_method"])
    });
  });

  it("does not fabricate a report when no column-comparison input is available", () => {
    expect(runColumnComparisonSignificanceAdapter(null, deferredColumnComparisonPlan)).toBeNull();
  });

  it("returns a structured deferred report when accepted input is malformed", () => {
    const malformedInput: AnalyticsColumnComparisonExecutionInput = {
      ...columnComparisonInput,
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [{ columnId: "gen_z", value: 18, base: 312 }]
        }
      ]
    };

    expect(validateColumnComparisonExecutionInput(malformedInput)).toEqual({
      valid: false,
      reasonCodes: ["invalid_execution_input"],
      unmetPrerequisites: ["execution_input"]
    });
    expect(runColumnComparisonSignificanceAdapter(malformedInput, deferredColumnComparisonPlan)).toEqual({
      method: "column_comparison",
      status: "deferred",
      inputAccepted: false,
      reasonCodes: ["mock_provider_not_available", "future_method", "invalid_execution_input"],
      unmetPrerequisites: ["provider_method", "statistical_engine", "execution_input"],
      result: null
    });
  });

  it("rejects invalid comparison scope metadata", () => {
    const malformedInput: AnalyticsColumnComparisonExecutionInput = {
      ...columnComparisonInput,
      comparisonScope: {
        ...columnComparisonInput.comparisonScope,
        columnIds: ["gen_z", "missing_column"]
      }
    };

    expect(validateColumnComparisonExecutionInput(malformedInput)).toEqual({
      valid: false,
      reasonCodes: ["invalid_execution_input"],
      unmetPrerequisites: ["execution_input"]
    });
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

  it("reserves a typed result payload shape for future execution output", () => {
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
        deferredComparisons: 0,
        significantComparisons: 0
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
        deferredComparisons: 0,
        significantComparisons: 0
      }
    });
    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, deferredColumnComparisonPlan)?.result).toBeTruthy();
  });

  it("shapes deferred row and column comparison outcomes from accepted input", () => {
    expect(shapeDeferredColumnComparisonResult(columnComparisonInput, ["future_method"])).toEqual({
      method: "column_comparison",
      comparisonScope: {
        basis: "breakout",
        rowIds: ["trust_a_lot"],
        columnIds: ["gen_z", "millennial"]
      },
      outcomes: [
        {
          rowId: "trust_a_lot",
          columnId: "gen_z",
          comparedColumnId: "millennial",
          status: "deferred",
          reasonCodes: ["future_method"],
          statistics: {
            pValue: null,
            confidence: null,
            direction: null
          }
        }
      ],
      summary: {
        testedComparisons: 0,
        deferredComparisons: 1,
        significantComparisons: 0
      }
    });
  });

  it("shapes real tested column-comparison outcomes without fabricating annotations", () => {
    const executed = executeColumnComparisonSignificance({
      ...columnComparisonInput,
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [
            { columnId: "gen_z", value: 18, base: 312 },
            { columnId: "millennial", value: 30, base: 428 }
          ]
        }
      ]
    });

    expect(executed.summary).toEqual({
      testedComparisons: 1,
      deferredComparisons: 0,
      significantComparisons: 1
    });
    expect(executed.outcomes[0]).toMatchObject({
      rowId: "trust_a_lot",
      columnId: "gen_z",
      comparedColumnId: "millennial",
      status: "tested",
      reasonCodes: [],
      statistics: {
        confidence: 0.95,
        direction: "down"
      }
    });
    expect(executed.outcomes[0].statistics.pValue).toBeLessThan(0.05);
  });

  it("validates structurally usable wave-comparison input", () => {
    expect(validateWaveComparisonExecutionInput(waveComparisonInput)).toEqual({
      valid: true,
      reasonCodes: [],
      unmetPrerequisites: []
    });
  });

  it("returns a deferred report for valid wave-comparison input", () => {
    expect(runWaveComparisonSignificanceAdapter(waveComparisonInput, deferredWaveComparisonPlan)).toEqual({
      method: "wave_comparison",
      status: "deferred",
      inputAccepted: true,
      reasonCodes: ["wave_comparison_unsupported", "future_method"],
      unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"],
      result: {
        method: "wave_comparison",
        comparisonScope: {
          basis: "wave",
          rowIds: ["trust_a_lot"],
          waveIds: ["ecofocus_2025", "ecofocus_2024"],
          primaryDatasetId: "ecofocus_2025",
          comparisonDatasetIds: ["ecofocus_2024"]
        },
        outcomes: [
          {
            rowId: "trust_a_lot",
            waveId: "ecofocus_2025",
            comparedWaveId: "ecofocus_2024",
            status: "deferred",
            reasonCodes: ["wave_comparison_unsupported", "future_method"],
            statistics: {
              pValue: null,
              confidence: null,
              direction: null
            }
          }
        ],
        summary: {
          testedComparisons: 0,
          deferredComparisons: 1,
          significantComparisons: 0
        }
      }
    });
  });

  it("shapes deferred wave comparison outcomes from accepted input", () => {
    expect(shapeDeferredWaveComparisonResult(waveComparisonInput, ["future_method"])).toEqual({
      method: "wave_comparison",
      comparisonScope: waveComparisonInput.comparisonScope,
      outcomes: [
        {
          rowId: "trust_a_lot",
          waveId: "ecofocus_2025",
          comparedWaveId: "ecofocus_2024",
          status: "deferred",
          reasonCodes: ["future_method"],
          statistics: {
            pValue: null,
            confidence: null,
            direction: null
          }
        }
      ],
      summary: {
        testedComparisons: 0,
        deferredComparisons: 1,
        significantComparisons: 0
      }
    });
  });

  it("returns a structured deferred report when wave input is malformed", () => {
    const malformedInput: AnalyticsWaveComparisonExecutionInput = {
      ...waveComparisonInput,
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [{ waveId: "ecofocus_2025", value: 20, base: 1495 }]
        }
      ]
    };

    expect(validateWaveComparisonExecutionInput(malformedInput)).toEqual({
      valid: false,
      reasonCodes: ["invalid_execution_input"],
      unmetPrerequisites: ["execution_input"]
    });
    expect(runWaveComparisonSignificanceAdapter(malformedInput, deferredWaveComparisonPlan)).toEqual({
      method: "wave_comparison",
      status: "deferred",
      inputAccepted: false,
      reasonCodes: ["wave_comparison_unsupported", "future_method", "invalid_execution_input"],
      unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine", "execution_input"],
      result: null
    });
  });

  it("keeps wave-comparison input outside the column-comparison adapter", () => {
    expect(runColumnComparisonSignificanceAdapter(columnComparisonInput, deferredWaveComparisonPlan)).toBeNull();
  });
});
