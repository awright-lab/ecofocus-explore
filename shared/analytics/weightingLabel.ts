import type { AnalyticsQueryResponse } from "../types/analytics";
export function resultWeightingLabel(result: AnalyticsQueryResponse): string {
  return result.weighting.applied ? result.weighting.label || "Weight applied"
    : result.query.weight ? `Requested weight ${result.query.weight}; application unconfirmed` : "Unweighted";
}
