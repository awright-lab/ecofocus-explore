import type {
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsColumnComparisonExecutionResult,
  AnalyticsSignificanceExecutionPlan,
  AnalyticsSignificanceExecutionReport,
  SignificanceReasonCode
} from "../types/analytics";

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

  return {
    method: "column_comparison",
    status: plan.providerCanExecute ? "not_executed" : "deferred",
    inputAccepted: true,
    reasonCodes: plan.reasonCodes,
    unmetPrerequisites: plan.unmetPrerequisites,
    result: shapeDeferredColumnComparisonResult(input, plan.reasonCodes)
  };
}
