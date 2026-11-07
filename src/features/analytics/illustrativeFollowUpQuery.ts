import type { AnalyticsQueryRequest } from "../../../shared/types/analytics";
import { validateAnalyticsQuery } from "../../../shared/analytics/validation";
import { runMockAnalyticsQuery } from "../../../shared/mock/analytics";

/** Shared by the sample follow-up preview and its explicit creation command. */
export function runIllustrativeFollowUpQuery(query: AnalyticsQueryRequest) {
  const source = query.sourceIdentity;
  if (source?.kind !== "seeded" || source.sourceRef?.kind !== "seeded_demo" ||
    source.datasetId !== query.dataset || source.questionId !== query.question ||
    source.sourceRef.datasetId !== query.dataset || source.sourceRef.provider !== "ecofocus_demo" ||
    query.sourceRef?.id !== source.sourceRef.id || query.sourceRef.kind !== "seeded_demo" ||
    query.sourceRef.datasetId !== query.dataset || query.sourceRef.provider !== "ecofocus_demo" ||
    query.filters.some(filter => filter.values.some(value => value !== "all")) ||
    query.authoredVariableSet || validateAnalyticsQuery(query).length) {
    throw new Error("This illustrative follow-up needs matching, unfiltered sample metadata. No live service was called.");
  }
  const result = runMockAnalyticsQuery(query);
  return { ...result, metadataRefs: { ...result.metadataRefs, source: structuredClone(source) },
    notes: ["Illustrative sample follow-up, calculated locally with the same provider as its preview. Not an imported study or live-service result.", ...result.notes] };
}
