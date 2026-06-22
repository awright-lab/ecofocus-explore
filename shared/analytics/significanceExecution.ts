import type {
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsSignificanceExecutionPlan,
  AnalyticsSignificanceExecutionReport
} from "../types/analytics";

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
    result: null
  };
}
