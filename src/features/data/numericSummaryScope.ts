import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export const allRespondentsGroupingId = "__ecofocus_all_respondents__";
// A DOM-only choice. The saved scope remains explicit and its historical ID is
// unchanged; a real or retained field ID must never select synthetic scope.
export function allRespondentsGroupingOption(fields: ReadonlyArray<Pick<ImportedDatasetField, "id">>, retainedId: string | null): string {
  const used = new Set(fields.map(field => field.id));
  if (retainedId !== null) used.add(retainedId);
  if (!used.has(allRespondentsGroupingId)) return allRespondentsGroupingId;
  for (let index = 0; index <= used.size; index++) {
    const candidate = `__ecofocus_all_respondents_option_${index}__`;
    if (!used.has(candidate)) return candidate;
  }
  throw Error("The overall summary choice could not be represented.");
}
// Explicit query scope, never a column inserted into respondent data.
export function allRespondentsGroupingField(dataset: ImportedDatasetRecord | null): ImportedDatasetField {
  return { id: allRespondentsGroupingId, label: "All respondents", sourceColumn: "", type: "categorical",
    modelingRole: "candidate_dimension", nonEmptyCount: dataset?.rowCount ?? 0, distinctCount: 1,
    sampleValues: ["All respondents"], eligibleForFilter: false, eligibleForSegment: false, eligibleForBanner: false };
}
