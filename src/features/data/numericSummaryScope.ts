import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export const allRespondentsGroupingId = "__ecofocus_all_respondents__";
// Explicit query scope, never a column inserted into respondent data.
export function allRespondentsGroupingField(dataset: ImportedDatasetRecord | null): ImportedDatasetField {
  return { id: allRespondentsGroupingId, label: "All respondents", sourceColumn: "", type: "categorical",
    modelingRole: "candidate_dimension", nonEmptyCount: dataset?.rowCount ?? 0, distinctCount: 1,
    sampleValues: ["All respondents"], eligibleForFilter: false, eligibleForSegment: false, eligibleForBanner: false };
}
