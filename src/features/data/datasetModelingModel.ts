import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { buildImportedFieldSuitability } from "./importedDatasetAnalytics";

export interface ImportedDatasetModelingHealth {
  queryReadyDimensions: number;
  queryReadyMeasures: number;
  bannerReadyFields: number;
  filterReadyFields: number;
  fieldsNeedingReview: number;
  dateFields: number;
  rawTextFields: number;
  readinessScore: number;
  statusLabel: string;
  statusTone: "strong" | "partial" | "review";
  guidance: string;
  chips: string[];
}

export interface ImportedFieldModelingProfile {
  analyticalRoleSummary: string;
  distinctValueSummary: string;
  suitabilitySummary: string;
  structureSummary: string;
  dateTreatment: string | null;
  chips: string[];
}

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
  const dimensions = fields.filter((field) => field.type === "categorical" || field.modelingRole === "candidate_dimension");
  const filters = fields.filter((field) => field.eligibleForFilter);
  const segments = fields.filter((field) => field.eligibleForSegment);
  const banners = fields.filter((field) => field.eligibleForBanner);
  const measures = fields.filter((field) => field.type === "numeric" || field.modelingRole === "candidate_measure");
  const health = buildImportedDatasetModelingHealth(dataset);

  return {
    fields,
    dimensions,
    filters,
    segments,
    banners,
    measures,
    health,
    dimensionLabel: `${dimensions.length} query-ready dimension${dimensions.length === 1 ? "" : "s"}`,
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

export function buildImportedDatasetModelingHealth(dataset: ImportedDatasetRecord | null | undefined): ImportedDatasetModelingHealth {
  const fields = dataset?.fields ?? [];
  const queryReadyDimensions = fields.filter((field) => {
    const suitability = buildImportedFieldSuitability(field);
    return suitability.readiness.status === "ready_dimension" || suitability.readiness.status === "limited";
  }).length;
  const queryReadyMeasures = fields.filter((field) => buildImportedFieldSuitability(field).readiness.status === "ready_measure").length;
  const bannerReadyFields = fields.filter((field) => field.eligibleForBanner && (field.type === "categorical" || field.modelingRole === "candidate_dimension")).length;
  const filterReadyFields = fields.filter((field) => field.eligibleForFilter && (field.type === "categorical" || field.modelingRole === "candidate_dimension")).length;
  const fieldsNeedingReview = fields.filter((field) => {
    const tone = buildImportedFieldSuitability(field).readiness.tone;
    return tone === "attention" || tone === "limited" || tone === "blocked";
  }).length;
  const dateFields = fields.filter((field) => field.type === "date" || field.modelingRole === "candidate_date").length;
  const rawTextFields = fields.filter((field) => field.type === "text" && field.modelingRole === "raw_variable").length;
  const readinessScore = fields.length
    ? Math.round(((queryReadyDimensions + queryReadyMeasures) / fields.length) * 100)
    : 0;
  const statusTone: ImportedDatasetModelingHealth["statusTone"] =
    queryReadyDimensions > 0 && fieldsNeedingReview === 0
      ? "strong"
      : queryReadyDimensions > 0 || queryReadyMeasures > 0
        ? "partial"
        : "review";
  const statusLabel =
    statusTone === "strong"
      ? "Analysis-ready model"
      : statusTone === "partial"
        ? "Partially modeled"
        : "Needs modeling setup";
  const guidance =
    statusTone === "strong"
      ? "This imported dataset has modeled fields ready for supported tabulations, crosstabs, and measure views."
      : statusTone === "partial"
        ? "This imported dataset has useful modeled fields, with some fields still worth reviewing before broader analysis."
        : "Model at least one categorical dimension before creating imported analysis.";

  return {
    queryReadyDimensions,
    queryReadyMeasures,
    bannerReadyFields,
    filterReadyFields,
    fieldsNeedingReview,
    dateFields,
    rawTextFields,
    readinessScore,
    statusLabel,
    statusTone,
    guidance,
    chips: [
      `${queryReadyDimensions} dimensions`,
      `${queryReadyMeasures} measures`,
      `${filterReadyFields} filters`,
      `${bannerReadyFields} banners`,
      `${fieldsNeedingReview} review`
    ]
  };
}

export function buildImportedFieldModelingProfile(field: ImportedDatasetField): ImportedFieldModelingProfile {
  const suitability = buildImportedFieldSuitability(field);
  const isDimension = field.type === "categorical" || field.modelingRole === "candidate_dimension";
  const isMeasure = field.type === "numeric" || field.modelingRole === "candidate_measure";
  const isDate = field.type === "date" || field.modelingRole === "candidate_date";
  const distinctValueSummary = field.distinctCount > 40
    ? `${field.distinctCount.toLocaleString()} distinct values · better for tables or recoding before charts`
    : field.distinctCount > 12
      ? `${field.distinctCount.toLocaleString()} distinct values · usable, but banner use may be noisy`
      : `${field.distinctCount.toLocaleString()} distinct values · compact enough for simple imported charts`;
  const analyticalRoleSummary = isMeasure
    ? "Modeled as a numeric measure for averages and sums."
    : isDimension
      ? "Modeled as a categorical dimension for grouping, filters, segments, and crosstabs."
      : isDate
        ? "Modeled as a date/time field; imported date analysis is not supported yet."
        : "Still a raw imported field; choose a role before relying on it for analysis.";
  const structureSummary = [
    field.eligibleForFilter ? "filter-ready" : null,
    field.eligibleForSegment ? "segment-ready" : null,
    field.eligibleForBanner ? "banner-ready" : null
  ].filter(Boolean).join(" · ") || "No filter/banner structure enabled";

  return {
    analyticalRoleSummary,
    distinctValueSummary,
    suitabilitySummary: suitability.readiness.reason,
    structureSummary,
    dateTreatment: isDate ? "Date fields are preserved as metadata until imported date grouping or trend analysis is added." : null,
    chips: [
      importedFieldTypeLabel(field.type),
      importedFieldRoleLabel(field.modelingRole),
      suitability.readiness.label,
      ...(isMeasure ? ["Measure aggregation"] : []),
      ...(isDimension ? ["Grouping field"] : [])
    ]
  };
}
