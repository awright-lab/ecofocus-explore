import type {
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsColumnComparisonExecutionResult,
  AnalyticsSignificanceExecutionPlan,
  AnalyticsSignificanceExecutionReport,
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
      deferredComparisons: outcomes.length
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

  return {
    method: "column_comparison",
    status: validation.valid && plan.providerCanExecute ? "not_executed" : "deferred",
    inputAccepted: validation.valid,
    reasonCodes,
    unmetPrerequisites,
    result: validation.valid ? shapeDeferredColumnComparisonResult(input, reasonCodes) : null
  };
}
