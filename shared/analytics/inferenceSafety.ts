import type { AnalyticsQueryResponse, SignificanceReasonCode } from "../types/analytics";

export function unsupportedInferenceReason(result: AnalyticsQueryResponse): SignificanceReasonCode | null {
  if (result.metric.id === "calculated") return "future_method";
  if (result.weighting.applied || result.query.weight) return "weighted_inference_unsupported";
  if (result.metadataRefs.source?.kind === "imported") return "summary_only";
  return result.statistics?.inferenceBasis === "unweighted_full_precision_v1" ? null : "inference_precision_unverified";
}

export function inferenceSafetyMessage(reason: SignificanceReasonCode): string {
  if (reason === "future_method") return "No statistical inference is available for calculated arithmetic metrics.";
  if (reason === "summary_only") return "Significance is unavailable for this imported summary. No statistical test was performed.";
  return reason === "weighted_inference_unsupported"
    ? "Weighted significance is unavailable: survey design and variance information are required. Weighted totals are not respondent sample sizes."
    : "Significance is unavailable for rounded or unverified estimates. Rerun an unweighted analysis with full-precision data.";
}

export function resultInferenceLabel(result: AnalyticsQueryResponse): string {
  if (unsupportedInferenceReason(result)) return "Significance unavailable";
  if (result.statistics.significanceExecutionReport?.status !== "executed") return "No significance test performed";
  return `${Math.round(result.statistics.confidenceLevel * 100)}% pairwise confidence (approximate, unadjusted)`;
}

// Presentation/load compatibility only: preserve all original measurements and
// source objects; never display unverified cached test claims. A later ordinary
// save can persist the suppression, while respondent measurements stay intact.
export function withSafeInference(result: AnalyticsQueryResponse): AnalyticsQueryResponse {
  const reason = unsupportedInferenceReason(result);
  if (!reason) return result;
  const comparisonBasis = result.statistics?.significance?.comparisonBasis ?? "none";
  const readiness = { status: "unsupported" as const, method: "none" as const, comparisonBasis, reasonCodes: [reason] };
  return {
    ...result,
    annotations: [],
    warnings: [...new Set([
      ...result.warnings.filter((warning) => reason !== "summary_only" || warning !== inferenceSafetyMessage("inference_precision_unverified")),
      inferenceSafetyMessage(reason)
    ])],
    statistics: {
      ...result.statistics,
      significanceMethod: "none",
      significanceExecutionPlan: { status: "blocked", candidateMethod: "none", queryShapeSupported: false, providerCanExecute: false,
        executionInputContract: null, reasonCodes: [reason], unmetPrerequisites: ["execution_input"] },
      significanceExecutionInput: null,
      significanceExecutionReport: null,
      significance: { status: "unsupported", method: "none", readiness, comparisonBasis, reasonCodes: [reason], hasPlaceholders: false, details: [] }
    }
  };
}
