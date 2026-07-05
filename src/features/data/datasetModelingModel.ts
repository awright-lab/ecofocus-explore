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
  rawFieldSummary: string;
  valueLabelSummary: string | null;
  chips: string[];
}

export function importedFieldDisplayLabel(field: ImportedDatasetField | null | undefined) {
  if (!field) return "selected field";
  return field.variableLabel?.trim() || field.label || field.sourceColumn;
}

export function importedFieldRawNameLabel(field: ImportedDatasetField | null | undefined) {
  if (!field) return null;
  const display = importedFieldDisplayLabel(field);
  return field.sourceColumn && field.sourceColumn !== display ? `Raw field: ${field.sourceColumn}` : null;
}

export function importedDatasetMetadataQualityLabel(dataset: ImportedDatasetRecord | null | undefined) {
  const quality = dataset?.importMetadata?.metadataQuality;
  if (quality === "metadata_rich") return "Survey labels imported";
  if (quality === "structured") return "Spreadsheet headers cleaned";
  return "Labels inferred from raw columns";
}

export function importedFieldValueLabelPreview(field: ImportedDatasetField | null | undefined) {
  const entries = Object.entries(field?.valueLabels ?? {});
  if (!entries.length) return null;
  return entries.slice(0, 4).map(([value, label]) => `${value} means ${label}`).join(" · ");
}

export function importedGroupingPlainLabel(field: ImportedDatasetField | null | undefined) {
  return importedFieldDisplayLabel(field);
}

export function importedMeasurePlainLabel(field: ImportedDatasetField | null | undefined, metric: "average" | "sum" = "average") {
  const metricLabel = metric === "sum" ? "total" : "average";
  return `${metricLabel} ${importedFieldDisplayLabel(field)}`;
}

export function importedQueryModePlainLabel(mode: "categorical" | "measure") {
  return mode === "measure" ? "Average or sum a number" : "Count responses by a field";
}

export function importedBannerPlainLabel(field: ImportedDatasetField | null | undefined) {
  return field ? `Broken out by ${importedFieldDisplayLabel(field)}` : "No breakout";
}

export function importedFilterPlainLabel(field: ImportedDatasetField | null | undefined, value?: string | null) {
  if (!field || !value || value === "all") return "No filter";
  return `Only ${importedFieldDisplayLabel(field)} = ${value}`;
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
    filterLabel: `${filters.length} field${filters.length === 1 ? "" : "s"} can filter results`,
    segmentLabel: `${segments.length} field${segments.length === 1 ? "" : "s"} can define segments`,
    bannerLabel: `${banners.length} field${banners.length === 1 ? "" : "s"} can break out results`,
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
  const suitabilityByField = fields.map((field) => buildImportedFieldSuitability(field));
  const queryReadyDimensions = suitabilityByField.filter((suitability) =>
    suitability.readiness.status === "ready_dimension" || suitability.readiness.status === "limited"
  ).length;
  const queryReadyMeasures = suitabilityByField.filter((suitability) => suitability.readiness.status === "ready_measure").length;
  const bannerReadyFields = fields.filter((field) => field.eligibleForBanner && (field.type === "categorical" || field.modelingRole === "candidate_dimension")).length;
  const filterReadyFields = fields.filter((field) => field.eligibleForFilter && (field.type === "categorical" || field.modelingRole === "candidate_dimension")).length;
  const fieldsNeedingReview = suitabilityByField.filter((suitability) => {
    const tone = suitability.readiness.tone;
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
      `${bannerReadyFields} breakouts`,
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
    field.eligibleForFilter ? "can filter results" : null,
    field.eligibleForSegment ? "segment-ready" : null,
    field.eligibleForBanner ? "can break out results" : null
  ].filter(Boolean).join(" · ") || "No filter/breakout structure enabled";

  return {
    analyticalRoleSummary,
    distinctValueSummary,
    suitabilitySummary: suitability.readiness.reason,
    structureSummary,
    dateTreatment: isDate ? "Date fields are preserved as metadata until imported date grouping or trend analysis is added." : null,
    rawFieldSummary: importedFieldRawNameLabel(field) ?? `Source field: ${field.sourceColumn}`,
    valueLabelSummary: field.valueLabels && Object.keys(field.valueLabels).length
      ? `Value labels: ${importedFieldValueLabelPreview(field)}`
      : null,
    chips: [
      importedFieldTypeLabel(field.type),
      importedFieldRoleLabel(field.modelingRole),
      suitability.readiness.label,
      ...(field.valueLabels && Object.keys(field.valueLabels).length ? ["Value labels"] : []),
      ...(isMeasure ? ["Measure aggregation"] : []),
      ...(isDimension ? ["Grouping field"] : [])
    ]
  };
}
