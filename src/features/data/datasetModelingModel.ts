import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export function importedFieldTypeLabel(type: ImportedDatasetField["type"]) {
  const labels: Record<ImportedDatasetField["type"], string> = {
    text: "Text",
    numeric: "Numeric",
    categorical: "Categorical",
    date: "Date"
  };
  return labels[type];
}

export function importedFieldRoleLabel(role: ImportedDatasetField["modelingRole"]) {
  const labels: Record<ImportedDatasetField["modelingRole"], string> = {
    raw_variable: "Raw variable",
    candidate_dimension: "Dimension",
    candidate_measure: "Measure",
    candidate_date: "Date/time"
  };
  return labels[role];
}

export function fieldCompletenessLabel(field: ImportedDatasetField) {
  return `${field.nonEmptyCount.toLocaleString()} populated · ${field.distinctCount.toLocaleString()} distinct`;
}

export function buildImportedDatasetStructureSummary(dataset: ImportedDatasetRecord | null | undefined) {
  const fields = dataset?.fields ?? [];
  const filters = fields.filter((field) => field.eligibleForFilter);
  const segments = fields.filter((field) => field.eligibleForSegment);
  const banners = fields.filter((field) => field.eligibleForBanner);
  const measures = fields.filter((field) => field.modelingRole === "candidate_measure");

  return {
    fields,
    filters,
    segments,
    banners,
    measures,
    filterLabel: `${filters.length} candidate filter${filters.length === 1 ? "" : "s"}`,
    segmentLabel: `${segments.length} candidate segment${segments.length === 1 ? "" : "s"}`,
    bannerLabel: `${banners.length} candidate banner${banners.length === 1 ? "" : "s"}`,
    measureLabel: `${measures.length} measure${measures.length === 1 ? "" : "s"}`
  };
}

export function describeFieldModeling(field: ImportedDatasetField) {
  const eligibility = [
    field.eligibleForFilter ? "filter" : null,
    field.eligibleForSegment ? "segment" : null,
    field.eligibleForBanner ? "banner" : null
  ].filter(Boolean);

  return {
    typeLabel: importedFieldTypeLabel(field.type),
    roleLabel: importedFieldRoleLabel(field.modelingRole),
    completenessLabel: fieldCompletenessLabel(field),
    eligibilityLabel: eligibility.length ? `Eligible for ${eligibility.join(", ")}` : "No analytical structure eligibility yet",
    sampleLabel: field.sampleValues.length ? field.sampleValues.join(", ") : "No sample values stored"
  };
}
