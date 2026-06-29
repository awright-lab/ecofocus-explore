import type {
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsColumnComparisonExecutionResult,
  AnalyticsSignificanceExecutionPlan,
  AnalyticsSignificanceExecutionReport,
  AnalyticsWaveComparisonExecutionInput,
  AnalyticsWaveComparisonExecutionResult,
  SignificanceExecutionPrerequisite,
  SignificanceReasonCode
} from "../types/analytics";

export interface ColumnComparisonInputValidation {
  valid: boolean;
  reasonCodes: SignificanceReasonCode[];
  unmetPrerequisites: SignificanceExecutionPrerequisite[];
}

export function validateColumnComparisonExecutionInput(input: AnalyticsColumnComparisonExecutionInput): ColumnComparisonInputValidation {
  const reasonCodes: SignificanceReasonCode[] = [];
  const unmetPrerequisites: SignificanceExecutionPrerequisite[] = [];
  const addInvalidInput = () => {
    if (!reasonCodes.includes("invalid_execution_input")) reasonCodes.push("invalid_execution_input");
    if (!unmetPrerequisites.includes("execution_input")) unmetPrerequisites.push("execution_input");
  };
  const columnIds = new Set(input.columns.map((column) => column.id));
  const rowIds = new Set(input.rows.map((row) => row.id));

  if (input.comparisonScope.basis !== "breakout" || input.columns.length < 2 || input.rows.length === 0) {
    addInvalidInput();
  }

  if (input.columns.some((column) => !column.id.trim()) || input.rows.some((row) => !row.id.trim())) {
    addInvalidInput();
  }

  if (
    input.comparisonScope.columnIds.length !== input.columns.length
    || input.comparisonScope.rowIds.length !== input.rows.length
    || input.comparisonScope.columnIds.some((columnId) => !columnIds.has(columnId))
    || input.comparisonScope.rowIds.some((rowId) => !rowIds.has(rowId))
  ) {
    addInvalidInput();
  }

  if (
    input.rows.some((row) => {
      const cellIds = new Set(row.cells.map((cell) => cell.columnId));
      return input.comparisonScope.columnIds.some((columnId) => !cellIds.has(columnId))
        || row.cells.some((cell) => !columnIds.has(cell.columnId) || !Number.isFinite(cell.value) || !Number.isFinite(cell.base));
    })
  ) {
    addInvalidInput();
  }

  return {
    valid: reasonCodes.length === 0,
    reasonCodes,
    unmetPrerequisites
  };
}

export function shapeDeferredColumnComparisonResult(
  input: AnalyticsColumnComparisonExecutionInput,
  reasonCodes: SignificanceReasonCode[]
): AnalyticsColumnComparisonExecutionResult {
  const outcomes = input.rows.flatMap((row) =>
    input.columns.flatMap((column, columnIndex) =>
      input.columns.slice(columnIndex + 1).map((comparedColumn) => ({
        rowId: row.id,
        columnId: column.id,
        comparedColumnId: comparedColumn.id,
        status: "deferred" as const,
        reasonCodes,
        statistics: {
          pValue: null,
          confidence: null,
          direction: null
        }
      }))
    )
  );

  return {
    method: "column_comparison",
    comparisonScope: input.comparisonScope,
    outcomes,
    summary: {
      testedComparisons: 0,
      deferredComparisons: outcomes.length,
      significantComparisons: 0
    }
  };
}

export function validateWaveComparisonExecutionInput(input: AnalyticsWaveComparisonExecutionInput): ColumnComparisonInputValidation {
  const reasonCodes: SignificanceReasonCode[] = [];
  const unmetPrerequisites: SignificanceExecutionPrerequisite[] = [];
  const addInvalidInput = () => {
    if (!reasonCodes.includes("invalid_execution_input")) reasonCodes.push("invalid_execution_input");
    if (!unmetPrerequisites.includes("execution_input")) unmetPrerequisites.push("execution_input");
  };
  const waveIds = new Set(input.waves.map((wave) => wave.id));
  const rowIds = new Set(input.rows.map((row) => row.id));

  if (
    input.comparisonScope.basis !== "wave"
    || input.waves.length < 2
    || input.rows.length === 0
    || input.comparisonScope.comparisonDatasetIds.length === 0
  ) {
    addInvalidInput();
  }

  if (
    input.waves.some((wave) => !wave.id.trim())
    || input.rows.some((row) => !row.id.trim())
    || !waveIds.has(input.comparisonScope.primaryDatasetId)
    || input.comparisonScope.comparisonDatasetIds.some((datasetId) => !waveIds.has(datasetId))
  ) {
    addInvalidInput();
  }

  if (
    input.comparisonScope.waveIds.length !== input.waves.length
    || input.comparisonScope.rowIds.length !== input.rows.length
    || input.comparisonScope.waveIds.some((waveId) => !waveIds.has(waveId))
    || input.comparisonScope.rowIds.some((rowId) => !rowIds.has(rowId))
  ) {
    addInvalidInput();
  }

  if (
    input.rows.some((row) => {
      const cellWaveIds = new Set(row.cells.map((cell) => cell.waveId));
      return input.comparisonScope.waveIds.some((waveId) => !cellWaveIds.has(waveId))
        || row.cells.some((cell) => !waveIds.has(cell.waveId) || !Number.isFinite(cell.value) || !Number.isFinite(cell.base));
    })
  ) {
    addInvalidInput();
  }

  return {
    valid: reasonCodes.length === 0,
    reasonCodes,
    unmetPrerequisites
  };
}

export function shapeDeferredWaveComparisonResult(
  input: AnalyticsWaveComparisonExecutionInput,
  reasonCodes: SignificanceReasonCode[]
): AnalyticsWaveComparisonExecutionResult {
  const outcomes = input.rows.flatMap((row) =>
    input.comparisonScope.comparisonDatasetIds.map((comparedWaveId) => ({
      rowId: row.id,
      waveId: input.comparisonScope.primaryDatasetId,
      comparedWaveId,
      status: "deferred" as const,
      reasonCodes,
      statistics: {
        pValue: null,
        confidence: null,
        direction: null
      }
    }))
  );

  return {
    method: "wave_comparison",
    comparisonScope: input.comparisonScope,
    outcomes,
    summary: {
      testedComparisons: 0,
      deferredComparisons: outcomes.length,
      significantComparisons: 0
    }
  };
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * abs);
  const erf =
    1
    - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
      * t
      * Math.exp(-abs * abs);

  return 0.5 * (1 + sign * erf);
}

function twoTailedPercentPValue(value: number, comparedValue: number, base: number, comparedBase: number) {
  if (base <= 0 || comparedBase <= 0) return null;

  const proportion = value / 100;
  const comparedProportion = comparedValue / 100;
  const pooled = ((proportion * base) + (comparedProportion * comparedBase)) / (base + comparedBase);
  const standardError = Math.sqrt(pooled * (1 - pooled) * ((1 / base) + (1 / comparedBase)));

  if (!Number.isFinite(standardError) || standardError <= 0) return null;

  const zScore = (proportion - comparedProportion) / standardError;
  const pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  return Number.isFinite(pValue) ? Math.max(0, Math.min(1, pValue)) : null;
}

function testedColumnComparisonOutcome(
  input: AnalyticsColumnComparisonExecutionInput,
  row: AnalyticsColumnComparisonExecutionInput["rows"][number],
  column: AnalyticsColumnComparisonExecutionInput["columns"][number],
  comparedColumn: AnalyticsColumnComparisonExecutionInput["columns"][number]
): AnalyticsColumnComparisonExecutionResult["outcomes"][number] {
  const cell = row.cells.find((item) => item.columnId === column.id);
  const comparedCell = row.cells.find((item) => item.columnId === comparedColumn.id);
  const pValue =
    cell && comparedCell
      ? twoTailedPercentPValue(cell.value, comparedCell.value, cell.base, comparedCell.base)
      : null;

  if (pValue === null) {
    return {
      rowId: row.id,
      columnId: column.id,
      comparedColumnId: comparedColumn.id,
      status: "not_tested",
      reasonCodes: ["insufficient_base"],
      statistics: {
        pValue: null,
        confidence: null,
        direction: null
      }
    };
  }

  const isSignificant = pValue <= 1 - input.confidenceLevel;

  return {
    rowId: row.id,
    columnId: column.id,
    comparedColumnId: comparedColumn.id,
    status: "tested",
    reasonCodes: [],
    statistics: {
      pValue,
      confidence: input.confidenceLevel,
      direction:
        isSignificant && cell && comparedCell
          ? cell.value > comparedCell.value
            ? "up"
            : "down"
          : null
    }
  };
}

export function executeColumnComparisonSignificance(
  input: AnalyticsColumnComparisonExecutionInput
): AnalyticsColumnComparisonExecutionResult {
  const outcomes = input.rows.flatMap((row) =>
    input.columns.flatMap((column, columnIndex) =>
      input.columns.slice(columnIndex + 1).map((comparedColumn) => testedColumnComparisonOutcome(input, row, column, comparedColumn))
    )
  );

  return {
    method: "column_comparison",
    comparisonScope: input.comparisonScope,
    outcomes,
    summary: {
      testedComparisons: outcomes.filter((outcome) => outcome.status === "tested").length,
      deferredComparisons: outcomes.filter((outcome) => outcome.status !== "tested").length,
      significantComparisons: outcomes.filter((outcome) => outcome.statistics.direction).length
    }
  };
}

function testedWaveComparisonOutcome(
  input: AnalyticsWaveComparisonExecutionInput,
  row: AnalyticsWaveComparisonExecutionInput["rows"][number],
  comparedWaveId: AnalyticsWaveComparisonExecutionInput["comparisonScope"]["comparisonDatasetIds"][number]
): AnalyticsWaveComparisonExecutionResult["outcomes"][number] {
  const cell = row.cells.find((item) => item.waveId === input.comparisonScope.primaryDatasetId);
  const comparedCell = row.cells.find((item) => item.waveId === comparedWaveId);
  const pValue =
    cell && comparedCell
      ? twoTailedPercentPValue(cell.value, comparedCell.value, cell.base, comparedCell.base)
      : null;

  if (pValue === null) {
    return {
      rowId: row.id,
      waveId: input.comparisonScope.primaryDatasetId,
      comparedWaveId,
      status: "not_tested",
      reasonCodes: ["insufficient_base"],
      statistics: {
        pValue: null,
        confidence: null,
        direction: null
      }
    };
  }

  const isSignificant = pValue <= 1 - input.confidenceLevel;

  return {
    rowId: row.id,
    waveId: input.comparisonScope.primaryDatasetId,
    comparedWaveId,
    status: "tested",
    reasonCodes: [],
    statistics: {
      pValue,
      confidence: input.confidenceLevel,
      direction:
        isSignificant && cell && comparedCell
          ? cell.value > comparedCell.value
            ? "up"
            : "down"
          : null
    }
  };
}

export function executeWaveComparisonSignificance(
  input: AnalyticsWaveComparisonExecutionInput
): AnalyticsWaveComparisonExecutionResult {
  const outcomes = input.rows.flatMap((row) =>
    input.comparisonScope.comparisonDatasetIds.map((comparedWaveId) => testedWaveComparisonOutcome(input, row, comparedWaveId))
  );

  return {
    method: "wave_comparison",
    comparisonScope: input.comparisonScope,
    outcomes,
    summary: {
      testedComparisons: outcomes.filter((outcome) => outcome.status === "tested").length,
      deferredComparisons: outcomes.filter((outcome) => outcome.status !== "tested").length,
      significantComparisons: outcomes.filter((outcome) => outcome.statistics.direction).length
    }
  };
}

export function runColumnComparisonSignificanceAdapter(
  input: AnalyticsColumnComparisonExecutionInput | null,
  plan: AnalyticsSignificanceExecutionPlan
): AnalyticsSignificanceExecutionReport | null {
  if (!input || plan.executionInputContract !== "column_comparison") {
    return null;
  }
  const validation = validateColumnComparisonExecutionInput(input);
  const reasonCodes = Array.from(new Set([...plan.reasonCodes, ...validation.reasonCodes]));
  const unmetPrerequisites = Array.from(new Set([...plan.unmetPrerequisites, ...validation.unmetPrerequisites]));
  const canExecute = validation.valid && plan.providerCanExecute && input.metric.valueFormat === "percent";
  const executedResult = canExecute ? executeColumnComparisonSignificance(input) : null;
  const hasTestedComparisons = (executedResult?.summary.testedComparisons ?? 0) > 0;
  const executionReasonCodes =
    canExecute && !hasTestedComparisons
      ? Array.from(new Set([...reasonCodes, "insufficient_base" as const]))
      : reasonCodes;

  return {
    method: "column_comparison",
    status: canExecute ? (hasTestedComparisons ? "executed" : "not_executed") : validation.valid && plan.providerCanExecute ? "not_executed" : "deferred",
    inputAccepted: validation.valid,
    reasonCodes: canExecute ? (hasTestedComparisons ? [] : executionReasonCodes) : reasonCodes,
    unmetPrerequisites: canExecute ? [] : unmetPrerequisites,
    result: validation.valid ? (canExecute ? executedResult : shapeDeferredColumnComparisonResult(input, reasonCodes)) : null
  };
}

export function runWaveComparisonSignificanceAdapter(
  input: AnalyticsWaveComparisonExecutionInput | null,
  plan: AnalyticsSignificanceExecutionPlan
): AnalyticsSignificanceExecutionReport | null {
  if (!input || plan.executionInputContract !== "wave_comparison") {
    return null;
  }
  const validation = validateWaveComparisonExecutionInput(input);
  const supportsNarrowWaveExecution =
    input.metric.valueFormat === "percent"
    && input.comparisonScope.comparisonDatasetIds.length === 1
    && input.comparisonScope.waveIds.length === 2
    && input.waves.length === 2;
  const unsupportedNarrowReason =
    validation.valid && plan.providerCanExecute && !supportsNarrowWaveExecution ? ["future_method" as const] : [];
  const reasonCodes = Array.from(new Set([
    ...plan.reasonCodes,
    ...validation.reasonCodes,
    ...unsupportedNarrowReason
  ]));
  const unmetPrerequisites = Array.from(new Set([...plan.unmetPrerequisites, ...validation.unmetPrerequisites]));
  const canExecute = validation.valid && plan.providerCanExecute && supportsNarrowWaveExecution;
  const executedResult = canExecute ? executeWaveComparisonSignificance(input) : null;
  const hasTestedComparisons = (executedResult?.summary.testedComparisons ?? 0) > 0;
  const executionReasonCodes =
    canExecute && !hasTestedComparisons
      ? Array.from(new Set([...reasonCodes, "insufficient_base" as const]))
      : reasonCodes;

  return {
    method: "wave_comparison",
    status: canExecute ? (hasTestedComparisons ? "executed" : "not_executed") : validation.valid && plan.providerCanExecute ? "not_executed" : "deferred",
    inputAccepted: validation.valid,
    reasonCodes: canExecute ? (hasTestedComparisons ? [] : executionReasonCodes) : reasonCodes,
    unmetPrerequisites: canExecute ? [] : unmetPrerequisites,
    result: validation.valid ? (canExecute ? executedResult : shapeDeferredWaveComparisonResult(input, reasonCodes)) : null
  };
}
