import { describe, expect, it } from "vitest";
import {
  executeColumnComparisonSignificance,
  executeWaveComparisonSignificance,
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

const breakoutWaveComparisonInput: AnalyticsWaveComparisonExecutionInput = {
  ...waveComparisonInput,
  comparisonScope: {
    basis: "wave",
    rowIds: ["trust_a_lot"],
    waveIds: ["ecofocus_2025", "ecofocus_2024"],
    primaryDatasetId: "ecofocus_2025",
    comparisonDatasetIds: ["ecofocus_2024"],
    breakoutColumnIds: ["gen_z", "millennial"]
  },
  breakoutColumns: [
    { id: "gen_z", label: "Gen Z" },
    { id: "millennial", label: "Millennial" }
  ],
  rows: [
    {
      id: "trust_a_lot",
      label: "Trust a lot",
      cells: [
        { waveId: "ecofocus_2025", breakoutColumnId: "gen_z", value: 30, base: 312 },
        { waveId: "ecofocus_2024", breakoutColumnId: "gen_z", value: 18, base: 305 },
        { waveId: "ecofocus_2025", breakoutColumnId: "millennial", value: 24, base: 428 },
        { waveId: "ecofocus_2024", breakoutColumnId: "millennial", value: 22, base: 411 }
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
          notTestedComparisons: 0,
          pendingComparisons: 1,
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
          notTestedComparisons: 0,
          pendingComparisons: 0,
          significantComparisons: 1
        }
      }
    });
    expect(report?.result?.outcomes[0].statistics.pValue).toBeGreaterThan(0);
    expect(report?.result?.outcomes[0].statistics.pValue).toBeLessThan(1);
  });

  it("marks individual executable column comparisons as not tested when bases are unusable", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredColumnComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const mixedBaseInput: AnalyticsColumnComparisonExecutionInput = {
      ...columnComparisonInput,
      comparisonScope: {
        basis: "breakout",
        rowIds: ["trust_a_lot", "neutral"],
        columnIds: ["gen_z", "millennial"]
      },
      rows: [
        columnComparisonInput.rows[0],
        {
          id: "neutral",
          label: "Neutral",
          cells: [
            { columnId: "gen_z", value: 0, base: 0 },
            { columnId: "millennial", value: 18, base: 428 }
          ]
        }
      ]
    };

    const report = runColumnComparisonSignificanceAdapter(mixedBaseInput, readyPlan);

    expect(report).toMatchObject({
      status: "executed",
      inputAccepted: true,
      reasonCodes: [],
      result: {
        summary: {
          testedComparisons: 1,
          deferredComparisons: 1,
          notTestedComparisons: 1,
          pendingComparisons: 0,
          significantComparisons: 1
        },
        outcomes: [
          expect.objectContaining({
            rowId: "trust_a_lot",
            status: "tested",
            reasonCodes: []
          }),
          expect.objectContaining({
            rowId: "neutral",
            status: "not_tested",
            reasonCodes: ["insufficient_base"],
            statistics: {
              pValue: null,
              confidence: null,
              direction: null
            }
          })
        ]
      }
    });
  });

  it("returns a not-executed report when all executable column comparisons lack usable bases", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredColumnComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const zeroBaseInput: AnalyticsColumnComparisonExecutionInput = {
      ...columnComparisonInput,
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [
            { columnId: "gen_z", value: 0, base: 0 },
            { columnId: "millennial", value: 24, base: 0 }
          ]
        }
      ]
    };

    expect(runColumnComparisonSignificanceAdapter(zeroBaseInput, readyPlan)).toMatchObject({
      method: "column_comparison",
      status: "not_executed",
      inputAccepted: true,
      reasonCodes: ["insufficient_base"],
      unmetPrerequisites: [],
      result: {
        summary: {
          testedComparisons: 0,
          deferredComparisons: 1,
          notTestedComparisons: 1,
          pendingComparisons: 0,
          significantComparisons: 0
        },
        outcomes: [
          {
            rowId: "trust_a_lot",
            columnId: "gen_z",
            comparedColumnId: "millennial",
            status: "not_tested",
            reasonCodes: ["insufficient_base"],
            statistics: {
              pValue: null,
              confidence: null,
              direction: null
            }
          }
        ]
      }
    });
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
        notTestedComparisons: 0,
        pendingComparisons: 0,
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
        notTestedComparisons: 0,
        pendingComparisons: 0,
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
          notTestedComparisons: 0,
          pendingComparisons: 1,
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
          notTestedComparisons: 0,
          pendingComparisons: 0,
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
          notTestedComparisons: 0,
          pendingComparisons: 1,
          significantComparisons: 0
        }
      }
    });
  });

  it("executes a narrow two-wave percent comparison when the provider can run wave significance", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredWaveComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const report = runWaveComparisonSignificanceAdapter(
      {
        ...waveComparisonInput,
        rows: [
          {
            id: "trust_a_lot",
            label: "Trust a lot",
            cells: [
              { waveId: "ecofocus_2025", value: 30, base: 1495 },
              { waveId: "ecofocus_2024", value: 20, base: 1410 }
            ]
          }
        ]
      },
      readyPlan
    );

    expect(report).toMatchObject({
      method: "wave_comparison",
      status: "executed",
      inputAccepted: true,
      reasonCodes: [],
      unmetPrerequisites: [],
      result: {
        method: "wave_comparison",
        comparisonScope: {
          basis: "wave",
          primaryDatasetId: "ecofocus_2025",
          comparisonDatasetIds: ["ecofocus_2024"]
        },
        outcomes: [
          {
            rowId: "trust_a_lot",
            waveId: "ecofocus_2025",
            comparedWaveId: "ecofocus_2024",
            status: "tested",
            reasonCodes: [],
            statistics: {
              confidence: 0.95,
              direction: "up"
            }
          }
        ],
        summary: {
          testedComparisons: 1,
          deferredComparisons: 0,
          notTestedComparisons: 0,
          pendingComparisons: 0,
          significantComparisons: 1
        }
      }
    });
    expect(report?.result?.outcomes[0].statistics.pValue).toBeGreaterThan(0);
    expect(report?.result?.outcomes[0].statistics.pValue).toBeLessThan(0.05);
  });

  it("executes narrow two-wave percent breakout-wave comparisons by aligned breakout column", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredWaveComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const report = runWaveComparisonSignificanceAdapter(breakoutWaveComparisonInput, readyPlan);

    expect(validateWaveComparisonExecutionInput(breakoutWaveComparisonInput)).toEqual({
      valid: true,
      reasonCodes: [],
      unmetPrerequisites: []
    });
    expect(report).toMatchObject({
      method: "wave_comparison",
      status: "executed",
      inputAccepted: true,
      reasonCodes: [],
      unmetPrerequisites: [],
      result: {
        method: "wave_comparison",
        comparisonScope: {
          basis: "wave",
          primaryDatasetId: "ecofocus_2025",
          comparisonDatasetIds: ["ecofocus_2024"],
          breakoutColumnIds: ["gen_z", "millennial"]
        },
        outcomes: expect.arrayContaining([
          expect.objectContaining({
            rowId: "trust_a_lot",
            waveId: "ecofocus_2025",
            comparedWaveId: "ecofocus_2024",
            breakoutColumnId: "gen_z",
            status: "tested",
            reasonCodes: [],
            statistics: expect.objectContaining({
              confidence: 0.95,
              direction: "up"
            })
          }),
          expect.objectContaining({
            rowId: "trust_a_lot",
            waveId: "ecofocus_2025",
            comparedWaveId: "ecofocus_2024",
            breakoutColumnId: "millennial",
            status: "tested",
            reasonCodes: []
          })
        ]),
        summary: {
          testedComparisons: 2,
          deferredComparisons: 0,
          notTestedComparisons: 0,
          pendingComparisons: 0,
          significantComparisons: 1
        }
      }
    });
    expect(
      report?.method === "wave_comparison"
        ? report.result?.outcomes.find((outcome) => outcome.breakoutColumnId === "gen_z")?.statistics.pValue
        : null
    ).toBeLessThan(0.05);
  });

  it("keeps valid but broader wave comparison inputs not executed outside the narrow bridge", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredWaveComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const multiWaveInput: AnalyticsWaveComparisonExecutionInput = {
      ...waveComparisonInput,
      comparisonScope: {
        basis: "wave",
        rowIds: ["trust_a_lot"],
        waveIds: ["ecofocus_2025", "ecofocus_2024", "ecofocus_2023"],
        primaryDatasetId: "ecofocus_2025",
        comparisonDatasetIds: ["ecofocus_2024", "ecofocus_2023"],
        pairingStrategy: "adjacent_wave"
      },
      waves: [
        ...waveComparisonInput.waves,
        { id: "ecofocus_2023", label: "2023" }
      ],
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [
            ...waveComparisonInput.rows[0].cells,
            { waveId: "ecofocus_2023", value: 14, base: 1360 }
          ]
        }
      ]
    };

    expect(runWaveComparisonSignificanceAdapter(multiWaveInput, readyPlan)).toMatchObject({
      method: "wave_comparison",
      status: "executed",
      inputAccepted: true,
      reasonCodes: [],
      unmetPrerequisites: [],
      result: {
        summary: {
          testedComparisons: 2,
          deferredComparisons: 0,
          notTestedComparisons: 0,
          pendingComparisons: 0,
          significantComparisons: 2
        },
        outcomes: [
          expect.objectContaining({
            rowId: "trust_a_lot",
            waveId: "ecofocus_2025",
            comparedWaveId: "ecofocus_2024",
            status: "tested"
          }),
          expect.objectContaining({
            rowId: "trust_a_lot",
            waveId: "ecofocus_2024",
            comparedWaveId: "ecofocus_2023",
            status: "tested"
          })
        ]
      }
    });
  });

  it("keeps multi-wave summary inputs deferred when they are not explicit adjacent trend pairs", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredWaveComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const primaryVsManyInput: AnalyticsWaveComparisonExecutionInput = {
      ...waveComparisonInput,
      comparisonScope: {
        basis: "wave",
        rowIds: ["trust_a_lot"],
        waveIds: ["ecofocus_2025", "ecofocus_2024", "ecofocus_2023"],
        primaryDatasetId: "ecofocus_2025",
        comparisonDatasetIds: ["ecofocus_2024", "ecofocus_2023"],
        pairingStrategy: "primary_vs_comparison"
      },
      waves: [
        ...waveComparisonInput.waves,
        { id: "ecofocus_2023", label: "2023" }
      ],
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [
            ...waveComparisonInput.rows[0].cells,
            { waveId: "ecofocus_2023", value: 14, base: 1360 }
          ]
        }
      ]
    };

    expect(runWaveComparisonSignificanceAdapter(primaryVsManyInput, readyPlan)).toEqual({
      method: "wave_comparison",
      status: "not_executed",
      inputAccepted: true,
      reasonCodes: ["future_method"],
      unmetPrerequisites: [],
      result: shapeDeferredWaveComparisonResult(primaryVsManyInput, ["future_method"])
    });
  });

  it("marks narrow wave comparisons as not tested when bases are unusable", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredWaveComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const report = runWaveComparisonSignificanceAdapter(
      {
        ...waveComparisonInput,
        rows: [
          {
            id: "trust_a_lot",
            label: "Trust a lot",
            cells: [
              { waveId: "ecofocus_2025", value: 30, base: 0 },
              { waveId: "ecofocus_2024", value: 20, base: 1410 }
            ]
          }
        ]
      },
      readyPlan
    );

    expect(report).toMatchObject({
      method: "wave_comparison",
      status: "not_executed",
      inputAccepted: true,
      reasonCodes: ["insufficient_base"],
      unmetPrerequisites: [],
      result: {
        summary: {
          testedComparisons: 0,
          deferredComparisons: 1,
          notTestedComparisons: 1,
          pendingComparisons: 0,
          significantComparisons: 0
        },
        outcomes: [
          {
            rowId: "trust_a_lot",
            waveId: "ecofocus_2025",
            comparedWaveId: "ecofocus_2024",
            status: "not_tested",
            reasonCodes: ["insufficient_base"],
            statistics: {
              pValue: null,
              confidence: null,
              direction: null
            }
          }
        ]
      }
    });
  });

  it("marks breakout-wave comparison cells as not tested when a breakout base is unusable", () => {
    const readyPlan: AnalyticsSignificanceExecutionPlan = {
      ...deferredWaveComparisonPlan,
      status: "ready",
      providerCanExecute: true,
      reasonCodes: [],
      unmetPrerequisites: []
    };
    const report = runWaveComparisonSignificanceAdapter(
      {
        ...breakoutWaveComparisonInput,
        rows: [
          {
            ...breakoutWaveComparisonInput.rows[0],
            cells: breakoutWaveComparisonInput.rows[0].cells.map((cell) =>
              cell.breakoutColumnId === "millennial" && cell.waveId === "ecofocus_2024"
                ? { ...cell, base: 0 }
                : cell
            )
          }
        ]
      },
      readyPlan
    );

    expect(report).toMatchObject({
      method: "wave_comparison",
      status: "executed",
      inputAccepted: true,
      result: {
        summary: {
          testedComparisons: 1,
          deferredComparisons: 1,
          notTestedComparisons: 1,
          pendingComparisons: 0,
          significantComparisons: 1
        },
        outcomes: expect.arrayContaining([
          expect.objectContaining({
            breakoutColumnId: "gen_z",
            status: "tested"
          }),
          expect.objectContaining({
            breakoutColumnId: "millennial",
            status: "not_tested",
            reasonCodes: ["insufficient_base"],
            statistics: {
              pValue: null,
              confidence: null,
              direction: null
            }
          })
        ])
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
        notTestedComparisons: 0,
        pendingComparisons: 1,
        significantComparisons: 0
      }
    });
  });

  it("shapes real tested wave-comparison outcomes for the narrow bridge", () => {
    const executed = executeWaveComparisonSignificance({
      ...waveComparisonInput,
      rows: [
        {
          id: "trust_a_lot",
          label: "Trust a lot",
          cells: [
            { waveId: "ecofocus_2025", value: 30, base: 1495 },
            { waveId: "ecofocus_2024", value: 20, base: 1410 }
          ]
        }
      ]
    });

    expect(executed.summary).toEqual({
      testedComparisons: 1,
          deferredComparisons: 0,
          notTestedComparisons: 0,
          pendingComparisons: 0,
          significantComparisons: 1
    });
    expect(executed.outcomes[0]).toMatchObject({
      rowId: "trust_a_lot",
      waveId: "ecofocus_2025",
      comparedWaveId: "ecofocus_2024",
      status: "tested",
      reasonCodes: [],
      statistics: {
        confidence: 0.95,
        direction: "up"
      }
    });
    expect(executed.outcomes[0].statistics.pValue).toBeLessThan(0.05);
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
