import type { SavedImportedAudience } from "../../../shared/types/audience";
import { compileAudience, audienceSummary } from "../audiences/audienceModel";
import { importedRawFieldValue } from "./importedRawValue";
export { importedRawFieldValue } from "./importedRawValue";
import { FiniteNumericSum } from "./finiteNumericSum";
import { allRespondentsGroupingId } from "./numericSummaryScope";
import { parseImportedNumber } from "./importedNumericValue";
import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../../../shared/analytics/queryPlan";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, ImportedAnalyticsSourceIdentity, Metric } from "../../../shared/types/analytics";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { normalizeDatasetSourceRefForImportedDataset } from "./datasetSourceRegistry";
import { importedSurveyQuestionDisplayLabel, importedSurveyQuestionPrompt } from "./importedSurveyLabelModel";

export interface ImportedDatasetQueryConfig {
  audience?: SavedImportedAudience;
  groupingScope?: "all_respondents";
  dataset: ImportedDatasetRecord;
  field: ImportedDatasetField;
  measureField?: ImportedDatasetField | null;
  bannerField?: ImportedDatasetField | null;
  filter?: {
    field: ImportedDatasetField;
    value: string;
  } | null;
  chartType: ChartType;
  metric: Metric;
}

export interface ImportedDatasetQuerySupport {
  executable: boolean;
  reason: string;
}

export interface ImportedResultProvenanceView {
  isImported: boolean;
  isMeasure: boolean;
  queryKindLabel: string;
  summaryLabel: string;
  datasetLabel: string;
  groupingLabel: string;
  measureLabel: string | null;
  metricLabel: string;
  bannerLabel: string;
  filterLabel: string;
  baseLabel: string;
  chips: string[];
}

export interface ImportedFieldSuitabilityView {
  badges: string[];
  helperText: string;
  recommendedQueryMode: "categorical" | "measure" | "modeling";
  readiness: ImportedFieldReadinessView;
  recommendations: ImportedFieldModelingRecommendation[];
}

export interface ImportedQueryRecommendationView {
  id: "categorical" | "categorical_breakout" | "measure";
  label: string;
  description: string;
  actionLabel: string;
  chartType: ChartType;
  metric: Metric;
  bannerFieldId: string | null;
  measureFieldId: string | null;
  recommended: boolean;
}

export type ImportedFieldReadinessStatus =
  | "ready_dimension"
  | "ready_measure"
  | "needs_modeling"
  | "limited"
  | "unsupported";

export interface ImportedFieldReadinessView {
  status: ImportedFieldReadinessStatus;
  label: string;
  tone: "ready" | "measure" | "attention" | "limited" | "blocked";
  reason: string;
  bestUse: string;
  recommendedAction: string;
}

export interface ImportedFieldModelingRecommendation {
  id:
    | "mark_dimension"
    | "mark_measure"
    | "change_type_categorical"
    | "change_type_numeric"
    | "enable_filter"
    | "enable_banner"
    | "avoid_measure"
    | "avoid_banner"
    | "use_grouping"
    | "unsupported_date"
    | "review_values";
  label: string;
  description: string;
  impact: string;
  suggestedUpdates?: Partial<Pick<ImportedDatasetField, "type" | "modelingRole" | "eligibleForFilter" | "eligibleForSegment" | "eligibleForBanner">>;
  workflowAction?: {
    label: string;
    description: string;
    queryMode: "categorical" | "measure";
  };
}

function isExecutableDimension(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && (field.type === "categorical" || field.modelingRole === "candidate_dimension"));
}

function isExecutableMeasure(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && (field.type === "numeric" || field.modelingRole === "candidate_measure"));
}

function isMeasureMetric(metric: Metric | undefined) {
  return metric === "average" || metric === "sum";
}

export function isLikelyImportedIdentifierField(field: ImportedDatasetField | null | undefined) {
  if (!field) return false;
  const source = field.sourceColumn.toLowerCase();
  const label = `${field.label} ${field.variableLabel ?? ""}`.toLowerCase();
  const nameLooksLikeIdentifier =
    /(^|_|\b)(id|uuid|guid|record|respondent|participant_id|response_id|caseid|case_id)(\b|_)/.test(source) ||
    /\b(record number|respondent identifier|participant identifier|unique id|case id)\b/.test(label);
  const looksLikeSystemField =
    /(^|_|\b)(edit|edits|hidden|marker|markers|sys|system|admin|audit|timestamp)(\b|_)/.test(source) ||
    /\b(hidden|internal|admin|audit|track changes|marker is used to track)\b/.test(label);
  // Continuous measurements commonly have one distinct value per respondent.
  // Named identifiers/system fields remain excluded regardless of numeric type.
  const mostlyUnique =
    !isExecutableMeasure(field) &&
    field.nonEmptyCount > 50 &&
    field.distinctCount <= field.nonEmptyCount &&
    field.distinctCount / Math.max(field.nonEmptyCount, 1) > 0.9;
  return nameLooksLikeIdentifier || looksLikeSystemField || mostlyUnique;
}

export function isImportedFieldAnalysisCandidate(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && !isLikelyImportedIdentifierField(field));
}

export function importedDatasetHasQueryableRows(dataset: ImportedDatasetRecord | null | undefined) {
  if (!dataset) return false;
  if (dataset.remote?.provider === "netlify" && dataset.rowCount > 0) return true;
  const available = dataset.rows?.length || dataset.previewRows?.length || 0;
  return available > 0 && available >= dataset.rowCount;
}

function importedFieldDisplayLabel(field: ImportedDatasetField | null | undefined) {
  if (!field) return undefined;
  return importedSurveyQuestionDisplayLabel(field);
}


function uniqueSampleBases(result: AnalyticsQueryResponse, includeZero = false) {
  return [...new Set(result.table.flatMap((row) => result.columns.map(column => row.bases[column.id])).filter((base) => includeZero ? base >= 0 : base > 0))].sort((a, b) => a - b);
}

function baseRangeLabel(prefix: string, bases: number[], sampleSize = true) {
  const unit = sampleSize ? " n" : "";
  if (bases.length === 0) return `${prefix} n/a`;
  if (bases.length === 1) return `${prefix}${unit} = ${bases[0].toLocaleString()}`;
  return `${prefix}${unit} = ${bases[0].toLocaleString()}-${bases[bases.length - 1].toLocaleString()}`;
}

export function importedMetricLabel(metric: Metric) {
  if (metric === "average") return "Average";
  if (metric === "sum") return "Sum";
  if (metric === "count") return "Number of responses";
  return "% of responses";
}

export function formatImportedMeasureValue(value: number, metric: Metric) {
  if (!Number.isFinite(value)) return "Unavailable";
  const isMeasure = metric === "average" || metric === "sum";
  const scientific = isMeasure && value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e12);
  return new Intl.NumberFormat("en-US", scientific
    ? { notation: "scientific", maximumSignificantDigits: 5 }
    : { minimumFractionDigits: 0, maximumFractionDigits: isMeasure ? 4 : 0 }).format(value);
}

export function importedMeasureBasesNeedRefresh(result: AnalyticsQueryResponse) {
  const source = result.metadataRefs.source;
  return source?.kind === "imported" && (source.queryKind === "measure" || isMeasureMetric(result.metric.id)) && source.measureBaseScope !== "cell";
}

export function buildImportedResultProvenance(result: AnalyticsQueryResponse): ImportedResultProvenanceView | null {
  const source = result.metadataRefs.source;
  if (source?.kind !== "imported") return null;

  const isMeasure = source.queryKind === "measure" || isMeasureMetric(result.metric.id);
  const metricLabel = importedMetricLabel(result.metric.id);
  const groupingLabel = source.primaryFieldLabel;
  const measureLabel = source.measureFieldLabel ?? null;
  const bannerLabel = source.bannerFieldLabel ?? "No breakout";
  const simpleFilter = source.filterFieldLabel && source.filterValue !== undefined ? `${source.filterFieldLabel} is ${source.filterValue}` : null;
  const filterLabel = [source.audience !== undefined ? audienceSummary(source.audience) : null,simpleFilter].filter(Boolean).join(" AND ") || "No filter";
  const weighted = result.weighting.applied || Boolean(result.query.weight);
  const recordedBases = result.table.flatMap(row => result.columns.map(column => row.bases[column.id]));
  const invalidBases = recordedBases.some(base => !Number.isFinite(base) || base < 0 || !weighted && !Number.isSafeInteger(base));
  const baseLabel = importedMeasureBasesNeedRefresh(result)
    ? "Sample bases need refresh; rerun analysis."
    : invalidBases ? "Recorded bases unavailable; rerun analysis."
    : weighted ? baseRangeLabel(result.weighting.applied ? "Recorded weighted base total" : "Recorded base (weighting unverified)", uniqueSampleBases(result, true), false)
    : baseRangeLabel(isMeasure ? "Valid measure per cell" : "Sample", uniqueSampleBases(result, true));
  const responseAction = result.metric.id === "count" ? "Count responses" : "Show response percentages";
  const responseKind = result.metric.id === "count" ? "Imported response count" : "Imported response percentages";
  const summaryLabel = isMeasure && measureLabel
    ? `${metricLabel} ${measureLabel} by ${groupingLabel}`
    : source.bannerFieldLabel
      ? `${responseAction} for ${groupingLabel}, broken out by ${source.bannerFieldLabel}`
      : `${responseAction} for ${groupingLabel}`;

  return {
    isImported: true,
    isMeasure,
    queryKindLabel: isMeasure ? "Imported numeric summary" : source.bannerFieldLabel ? `${responseKind} by breakout` : responseKind,
    summaryLabel,
    datasetLabel: source.datasetLabel,
    groupingLabel,
    measureLabel,
    metricLabel,
    bannerLabel,
    filterLabel,
    baseLabel,
    chips: [
      `Dataset: ${source.datasetLabel}`,
      `Grouped by: ${groupingLabel}`,
      ...(isMeasure && measureLabel ? [`Number: ${measureLabel}`] : []),
      `Values: ${metricLabel}`,
      `Breakout: ${bannerLabel}`,
      `Filter: ${filterLabel}`,
      baseLabel
    ]
  };
}

export function buildImportedFieldSuitability(field: ImportedDatasetField): ImportedFieldSuitabilityView {
  if (isLikelyImportedIdentifierField(field)) {
    return {
      badges: ["Identifier"],
      helperText: "This looks like a record or respondent identifier, so it is best kept as source metadata.",
      recommendedQueryMode: "modeling",
      recommendations: [{
        id: "review_values",
        label: "Choose a response field instead",
        description: "Identifier fields are useful for tracking rows, but they do not make meaningful counts, averages, or charts.",
        impact: "Use fields such as status, demographics, answers, or ratings for analysis."
      }],
      readiness: {
        status: "limited",
        label: "Reference field",
        tone: "limited",
        reason: "This field appears to identify records rather than describe responses.",
        bestUse: "Keep as source metadata or use it only for row lookup.",
        recommendedAction: "Choose another field"
      }
    };
  }

  const isDimension = isExecutableDimension(field);
  const isMeasure = isExecutableMeasure(field);
  const hasRows = field.nonEmptyCount > 0;
  const isHighCardinalityDimension = isDimension && field.distinctCount > 40;
  const lowCardinality = field.distinctCount > 0 && field.distinctCount <= 20;
  const recommendations = buildImportedFieldModelingRecommendations(field, {
    isDimension,
    isMeasure,
    hasRows,
    isHighCardinalityDimension,
    lowCardinality
  });
  const badges = [
    ...(isDimension ? ["Dimension"] : []),
    ...(isMeasure ? ["Measure"] : []),
    ...(isDimension && field.eligibleForBanner ? ["Banner"] : []),
    ...(isDimension && field.eligibleForFilter ? ["Filter"] : [])
  ];

  if (isMeasure && !isDimension) {
    return {
      badges,
      helperText: "Best used as a numeric measure with a categorical grouping field.",
      recommendedQueryMode: "measure",
      recommendations,
      readiness: {
        status: hasRows ? "ready_measure" : "unsupported",
        label: hasRows ? "Ready for measure views" : "No usable values",
        tone: hasRows ? "measure" : "blocked",
        reason: hasRows
          ? "This field is modeled as numeric, so imported queries can aggregate it as an average or sum."
          : "This field has no non-empty values to aggregate.",
        bestUse: "Use as the measure in a grouped imported metric view.",
        recommendedAction: hasRows ? "Build measure view" : "Review source values"
      }
    };
  }

  if (isDimension) {
    if (isHighCardinalityDimension) {
      return {
        badges: badges.length ? badges : ["Dimension"],
        helperText: "Usable as a grouping field, but many distinct values may make simple charts harder to read.",
        recommendedQueryMode: "categorical",
        recommendations,
        readiness: {
          status: "limited",
          label: "Limited query support",
          tone: "limited",
          reason: `This field has ${field.distinctCount.toLocaleString()} distinct values; simple imported charts work best with fewer categories.`,
          bestUse: "Use as a table or refine the field before using it as a chart grouping.",
          recommendedAction: "Review model"
        }
      };
    }

    return {
      badges,
      helperText: field.eligibleForBanner
        ? "Best used as a grouping field or one-banner crosstab dimension."
        : "Best used as a grouping field for imported tabulations.",
      recommendedQueryMode: "categorical",
      recommendations,
      readiness: {
        status: hasRows ? "ready_dimension" : "unsupported",
        label: hasRows ? "Ready for analysis" : "No usable values",
        tone: hasRows ? "ready" : "blocked",
        reason: hasRows
          ? "This field is modeled as a usable dimension for imported counts, charts, filters, and one-field breakouts."
          : "This field has no non-empty values to tabulate.",
        bestUse: field.eligibleForBanner
          ? "Use as a grouping field, filter, segment, or one-banner crosstab input."
          : "Use as the primary grouping field for a simple imported tabulation.",
        recommendedAction: hasRows ? "Create analysis" : "Review source values"
      }
    };
  }

  const unsupportedDate = field.type === "date" && field.modelingRole === "candidate_date";

  return {
    badges: badges.length ? badges : ["Modeling needed"],
    helperText: unsupportedDate
      ? "Date fields need additional modeling before imported analysis can use them."
      : "Refine this field's type or role before using it in an imported query.",
    recommendedQueryMode: "modeling",
    recommendations,
    readiness: {
      status: unsupportedDate ? "unsupported" : "needs_modeling",
      label: unsupportedDate ? "Not suitable yet" : "Needs modeling review",
      tone: unsupportedDate ? "blocked" : "attention",
      reason: unsupportedDate
        ? "The current imported query engine does not yet support date trend or date grouping analysis."
        : "This field is not marked as a usable dimension or numeric measure yet.",
      bestUse: unsupportedDate
        ? "Keep as source metadata until imported date analysis is added."
        : "Choose whether this should behave as a dimension, measure, filter, banner, or raw field.",
      recommendedAction: "Model field"
    }
  };
}

function buildImportedFieldModelingRecommendations(
  field: ImportedDatasetField,
  context: {
    isDimension: boolean;
    isMeasure: boolean;
    hasRows: boolean;
    isHighCardinalityDimension: boolean;
    lowCardinality: boolean;
  }
): ImportedFieldModelingRecommendation[] {
  if (!context.hasRows) {
    return [{
      id: "review_values",
      label: "Review source values",
      description: "This field has no non-empty values, so imported analysis cannot calculate a useful result yet.",
      impact: "Check the imported file or choose another field before creating analysis."
    }];
  }

  if (field.type === "date" || field.modelingRole === "candidate_date") {
    return [{
      id: "unsupported_date",
      label: "Keep as source metadata",
      description: "Date fields are not yet supported by the imported query engine for trends or date grouping.",
      impact: "Use a categorical period field for now, or keep this field out of imported analysis."
    }];
  }

  const recommendations: ImportedFieldModelingRecommendation[] = [];

  if (field.type === "numeric" && field.modelingRole !== "candidate_measure") {
    recommendations.push({
      id: "mark_measure",
      label: "Mark as measure",
      description: "This numeric field can become an average or sum when grouped by a categorical field.",
      impact: "Clarifies that this field should be aggregated, not used as a banner or segment.",
      suggestedUpdates: {
        modelingRole: "candidate_measure",
        eligibleForFilter: false,
        eligibleForSegment: false,
        eligibleForBanner: false
      },
      workflowAction: {
        label: "Apply and build measure view",
        description: "Applies the measure model and opens the guided query with this field as the selected measure.",
        queryMode: "measure"
      }
    });
  }

  if (!context.isDimension && !context.isMeasure) {
    if (field.type === "numeric") {
      recommendations.push({
        id: "mark_measure",
        label: "Mark as measure",
        description: "This numeric field can become an average or sum when grouped by a categorical field.",
        impact: "Unlocks imported measure views for averages and sums.",
        suggestedUpdates: {
          modelingRole: "candidate_measure",
          eligibleForFilter: false,
          eligibleForSegment: false,
          eligibleForBanner: false
        },
        workflowAction: {
          label: "Apply and build measure view",
          description: "Applies the measure model and opens the guided query with this field as the selected measure.",
          queryMode: "measure"
        }
      });
    } else if (context.lowCardinality) {
      recommendations.push({
        id: "mark_dimension",
        label: "Mark as dimension",
        description: "This field has a manageable number of values, so it can work as a grouping field.",
        impact: "Unlocks response counts, simple charts, filters, segments, and one-field breakouts.",
        suggestedUpdates: {
          type: "categorical",
          modelingRole: "candidate_dimension",
          eligibleForFilter: true,
          eligibleForSegment: true,
          eligibleForBanner: true
        },
        workflowAction: {
          label: "Apply and analyze",
          description: "Applies the dimension model and opens the guided query for a categorical tabulation.",
          queryMode: "categorical"
        }
      });
    } else {
      recommendations.push({
        id: "avoid_measure",
        label: "Do not use as a measure",
        description: "This text field has many distinct values and is not a numeric measure candidate.",
        impact: "Use it as reference text, or recode it into fewer categories before analysis."
      });
    }
  }

  if (field.type === "text" && context.lowCardinality && field.modelingRole !== "candidate_dimension") {
    recommendations.push({
      id: "change_type_categorical",
      label: "Treat as categorical",
      description: "Low-cardinality text fields usually work best as categories, not raw text.",
      impact: "Makes this field query-ready for grouping and filtering.",
      suggestedUpdates: {
        type: "categorical",
        modelingRole: "candidate_dimension",
        eligibleForFilter: true,
        eligibleForSegment: true
      },
      workflowAction: {
        label: "Apply and analyze",
        description: "Treats this field as categorical and opens the guided query for supported imported analysis.",
        queryMode: "categorical"
      }
    });
  }

  if (field.type === "text" && field.distinctCount > 40) {
    recommendations.push({
      id: "use_grouping",
      label: "Refine categories first",
      description: "This field has many distinct text values, which can make imported charts noisy.",
      impact: "Use a table for review or recode into fewer categories before charting."
    });
  }

  if (context.isDimension && !context.isHighCardinalityDimension) {
    if (!field.eligibleForFilter) {
      recommendations.push({
        id: "enable_filter",
        label: "Enable filter use",
        description: "This modeled dimension can safely narrow imported queries.",
        impact: "Lets users filter imported tabulations by this field.",
        suggestedUpdates: { eligibleForFilter: true }
      });
    }
    if (!field.eligibleForBanner && field.distinctCount <= 12) {
      recommendations.push({
        id: "enable_banner",
        label: "Enable breakout use",
        description: "This field has few enough categories to split imported results clearly.",
        impact: "Lets users compare imported results across this field.",
        suggestedUpdates: { eligibleForBanner: true }
      });
    }
  }

  if (context.isHighCardinalityDimension && field.eligibleForBanner) {
    recommendations.push({
      id: "avoid_banner",
      label: "Avoid breakout use",
      description: "Fields with many categories create wide, hard-to-read breakouts.",
      impact: "Keeps imported results readable; use this field as a table grouping instead.",
      suggestedUpdates: { eligibleForBanner: false }
    });
  }

  if (context.isMeasure && (field.eligibleForBanner || field.eligibleForFilter || field.eligibleForSegment)) {
    recommendations.push({
      id: "use_grouping",
      label: "Use as a number, not a grouping",
      description: "Numeric fields should be averaged or summed by a separate grouping field rather than used as filters or breakouts.",
      impact: "Keeps imported measure views clean and avoids misleading result splits.",
      suggestedUpdates: {
        eligibleForFilter: false,
        eligibleForSegment: false,
        eligibleForBanner: false
      }
    });
  }

  return recommendations.slice(0, 3);
}

export function firstImportedDimensionField(dataset: ImportedDatasetRecord | null | undefined) {
  return (dataset?.fields ?? []).find((field) => isExecutableDimension(field) && isImportedFieldAnalysisCandidate(field)) ?? null;
}

export function firstImportedMeasureField(dataset: ImportedDatasetRecord | null | undefined) {
  return (dataset?.fields ?? []).find((field) => isExecutableMeasure(field) && isImportedFieldAnalysisCandidate(field)) ?? null;
}

export function buildImportedQueryRecommendations(
  dataset: ImportedDatasetRecord | null | undefined,
  field: ImportedDatasetField | null | undefined,
  options?: {
    selectedQueryMode?: "categorical" | "measure";
    measureField?: ImportedDatasetField | null;
    bannerFields?: ImportedDatasetField[];
  }
): ImportedQueryRecommendationView[] {
  if (!dataset || !field || !isExecutableDimension(field)) return [];
  if (!importedDatasetHasQueryableRows(dataset)) return [];

  const bannerField = options?.bannerFields?.find((item) => item.id !== field.id) ?? null;
  const measureField = options?.measureField ?? firstImportedMeasureField(dataset);
  const fieldLabel = importedFieldDisplayLabel(field) ?? field.label;
  const bannerLabel = importedFieldDisplayLabel(bannerField);
  const measureLabel = importedFieldDisplayLabel(measureField);
  const recommendations: ImportedQueryRecommendationView[] = [
    {
      id: "categorical",
      label: "Show responses for this field",
      description: `Show how all respondents answered ${fieldLabel}. No breakout or numeric summary is applied.`,
      actionLabel: "Use all responses",
      chartType: "vertical_bar",
      metric: "percent_selected",
      bannerFieldId: null,
      measureFieldId: null,
      recommended: options?.selectedQueryMode !== "measure"
    }
  ];

  if (bannerField) {
    recommendations.push({
      id: "categorical_breakout",
      label: "Compare responses by a breakout",
      description: `Show responses for ${fieldLabel}, broken out by ${bannerLabel}.`,
      actionLabel: "Use breakout",
      chartType: "grouped_bar",
      metric: "percent_selected",
      bannerFieldId: bannerField.id,
      measureFieldId: null,
      recommended: false
    });
  }

  if (measureField && measureField.id !== field.id && measureField.id !== bannerField?.id) {
    recommendations.push({
      id: "measure",
      label: "Summarize a numeric field",
      description: `Show average ${measureLabel} grouped by ${fieldLabel}.`,
      actionLabel: "Use numeric summary",
      chartType: bannerField ? "grouped_bar" : "vertical_bar",
      metric: "average",
      bannerFieldId: bannerField?.id ?? null,
      measureFieldId: measureField.id,
      recommended: options?.selectedQueryMode === "measure" || buildImportedFieldSuitability(measureField).recommendedQueryMode === "measure"
    });
  }

  return recommendations;
}

export function getImportedDatasetQuerySupport(
  dataset: ImportedDatasetRecord | null | undefined,
  field: ImportedDatasetField | null | undefined,
  options?: {
    audience?: SavedImportedAudience;
    groupingScope?: "all_respondents";
    bannerField?: ImportedDatasetField | null;
    filter?: {
      field: ImportedDatasetField | null;
      value: string;
    } | null;
    measureField?: ImportedDatasetField | null;
    metric?: Metric;
    chartType?: ChartType;
  }
): ImportedDatasetQuerySupport {
  if (!dataset) return { executable: false, reason: "Choose an imported dataset." };
  if (!field) return { executable: false, reason: "Choose an imported field." };
  if(options?.audience !== undefined) { try { compileAudience(options.audience,dataset); } catch(error) { return { executable:false,reason:error instanceof Error?error.message:"The audience cannot be applied." }; } }
  if (field.id === allRespondentsGroupingId && options?.groupingScope !== "all_respondents") {
    return { executable: false, reason: "Select an explicit all-respondent numeric summary scope." };
  }
  if (options?.groupingScope === "all_respondents") {
    if (!isMeasureMetric(options.metric) || field.id !== allRespondentsGroupingId) return { executable: false, reason: "All respondents is available only for an explicit numeric sum or average." };
    if (dataset.remote?.provider === "netlify") return { executable: false, reason: "All-respondent numeric summaries currently require complete browser data. Server-backed studies still support grouped summaries." };
  }
  if (dataset.remote?.provider !== "netlify" && !importedDatasetHasQueryableRows(dataset) && dataset.rowCount > 0) {
    return { executable: false, reason: "The complete respondent data is unavailable in this browser. Re-import the source file before analyzing; preview rows cannot represent the full study." };
  }
  if (!isExecutableDimension(field)) {
    return { executable: false, reason: "Imported queries require a categorical grouping field." };
  }
  const localRows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  const hasRemoteRows = dataset.remote?.provider === "netlify" && dataset.rowCount > 0;
  const hasLocalFieldValues = localRows.some((row) => importedRawFieldValue(row, field).trim());
  if (field.nonEmptyCount <= 0 && !hasLocalFieldValues && !hasRemoteRows) {
    return { executable: false, reason: `${importedFieldDisplayLabel(field) ?? "This field"} has answer-choice labels, but no respondent answers were imported for that field.` };
  }
  if (isMeasureMetric(options?.metric)) {
    if (!options?.measureField) {
      return { executable: false, reason: "Choose a numeric imported measure field." };
    }
    if (!isExecutableMeasure(options.measureField)) {
      return { executable: false, reason: "Measure aggregation is limited to numeric measure fields." };
    }
    const hasLocalMeasureValues = localRows.some((row) => importedRawFieldValue(row, options.measureField).trim());
    if (options.measureField.nonEmptyCount <= 0 && !hasLocalMeasureValues && !hasRemoteRows) {
      return { executable: false, reason: `${importedFieldDisplayLabel(options.measureField) ?? "The selected number"} has no imported values to summarize.` };
    }
    if (options.measureField.id === field.id || options.measureField.id === options.bannerField?.id || options.measureField.id === options.filter?.field?.id) {
      return { executable: false, reason: "Choose a different numeric field for the imported measure." };
    }
    if (options.chartType === "donut") {
      return { executable: false, reason: "Donut charts are only supported for categorical count/percent queries." };
    }
  }
  if (options?.bannerField) {
    if (options.bannerField.id === field.id) {
      return { executable: false, reason: "Choose a different field for the imported banner." };
    }
    if (!options.bannerField.eligibleForBanner || !isExecutableDimension(options.bannerField)) {
      return { executable: false, reason: "Imported breakouts are limited to breakout-ready categorical fields." };
    }
    const hasLocalBannerValues = localRows.some((row) => importedRawFieldValue(row, options.bannerField).trim());
    if (options.bannerField.nonEmptyCount <= 0 && !hasLocalBannerValues && !hasRemoteRows) {
      return { executable: false, reason: `${importedFieldDisplayLabel(options.bannerField) ?? "The selected breakout"} has no imported values to break out by.` };
    }
    if (options.chartType === "donut") {
      return { executable: false, reason: "Donut charts are only supported for imported queries without a banner." };
    }
  }
  if (options?.filter?.field) {
    const filterChoices = getImportedFilterChoiceSupport(dataset);
    if (!filterChoices.executable) return filterChoices;
    if (!options.filter.field.eligibleForFilter || !isExecutableDimension(options.filter.field)) {
      return { executable: false, reason: "Imported filters are limited to filter-eligible categorical fields." };
    }
    const hasLocalFilterValues = localRows.some((row) => importedRawFieldValue(row, options.filter?.field).trim());
    if (options.filter.field.nonEmptyCount <= 0 && !hasLocalFilterValues && !hasRemoteRows) {
      return { executable: false, reason: `${importedFieldDisplayLabel(options.filter.field) ?? "The selected filter"} has no imported values to filter on.` };
    }
    if (importedFilterValueIsAmbiguous(dataset, options.filter.field, options.filter.value)) {
      return { executable: false, reason: "This saved filter label matches multiple source codes. Choose a specific coded value before rerunning the analysis." };
    }
    if (!options.filter.value) {
      return { executable: false, reason: "Choose a filter value or remove the imported filter." };
    }
  }
  if (!localRows.length && !hasRemoteRows) {
    return {
      executable: false,
      reason: "This import only has SAV labels and field metadata right now. The respondent rows were not imported, so InsightCanvas cannot count or chart this dataset yet."
    };
  }
  if (isMeasureMetric(options?.metric)) {
    if (options?.bannerField && options?.filter?.field) return { executable: true, reason: `Ready: ${options.metric} a numeric field, grouped, filtered, and broken out once.` };
    if (options?.bannerField) return { executable: true, reason: `Ready: ${options.metric} a numeric field, grouped and broken out once.` };
    if (options?.filter?.field) return { executable: true, reason: `Ready: ${options.metric} a numeric field for the filtered responses.` };
    return { executable: true, reason: `Ready: ${options?.metric} a numeric field by a grouping field.` };
  }
  if (options?.bannerField && options?.filter?.field) return { executable: true, reason: "Ready: count filtered responses by one field and one breakout." };
  if (options?.bannerField) return { executable: true, reason: "Ready: count responses by one field and one breakout." };
  if (options?.filter?.field) return { executable: true, reason: "Ready: count responses for the selected filter." };
  return { executable: true, reason: "Ready: count responses by this field." };
}

function slug(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function importedSourceIdentity(config: ImportedDatasetQueryConfig, intersectionAudience?: SavedImportedAudience): ImportedAnalyticsSourceIdentity {
  return {
    kind: "imported",
    datasetImportedAt: config.dataset.importedAt,
    ...(config.audience !== undefined ? { audience: structuredClone(config.audience) } : {}),
    ...(intersectionAudience !== undefined ? { intersectionAudience: structuredClone(intersectionAudience) } : {}),
    ...(isMeasureMetric(config.metric) ? { measureBaseScope: "cell" as const } : {}),
    queryKind: isMeasureMetric(config.metric) ? "measure" : "categorical",
    ...(config.groupingScope ? { groupingScope: config.groupingScope } : {}),
    sourceRef: normalizeDatasetSourceRefForImportedDataset(config.dataset),
    datasetId: config.dataset.id,
    datasetLabel: config.dataset.title,
    primaryFieldId: config.field.id,
    primaryFieldLabel: importedFieldDisplayLabel(config.field) ?? config.field.label,
    primaryFieldPrompt: importedSurveyQuestionPrompt(config.field) ?? undefined,
    measureFieldId: config.measureField?.id,
    measureFieldLabel: importedFieldDisplayLabel(config.measureField),
    bannerFieldId: config.bannerField?.id,
    bannerFieldLabel: importedFieldDisplayLabel(config.bannerField),
    filterFieldId: config.filter?.field.id,
    filterFieldLabel: importedFieldDisplayLabel(config.filter?.field),
    filterValue: config.filter?.value
  };
}

function importedQuery(chartType: ChartType, metric: Metric, sourceIdentity: ImportedAnalyticsSourceIdentity): AnalyticsQueryRequest {
  return {
    dataset: "ecofocus_2025",
    question: "Q_PACKAGING_TRUST",
    breakBy: "SUMMARY",
    filters: [],
    weight: null,
    metric,
    chartType,
    confidenceLevel: 0.95,
    comparisonMode: "none",
    comparisonDatasets: [],
    sourceRef: sourceIdentity.sourceRef,
    sourceIdentity
  };
}

type ImportedCategoryKey = string | null;

function importedCategoryKey(field: ImportedDatasetField, rawValue: string | undefined): ImportedCategoryKey {
  const value = (rawValue ?? "").trim();
  if (!value) return null;
  if (Object.hasOwn(field.valueLabels ?? {}, value)) return value;
  const numeric = Number(value);
  const numericKey = String(numeric);
  return Number.isFinite(numeric) && Object.hasOwn(field.valueLabels ?? {}, numericKey) ? numericKey : value;
}

function declaredCategoryKeys(field: ImportedDatasetField) {
  return Object.keys(field.valueLabels ?? {}).sort((a, b) => {
    const numericA = Number(a), numericB = Number(b);
    return Number.isFinite(numericA) && Number.isFinite(numericB) ? numericA - numericB : a.localeCompare(b);
  });
}

function importedCategoryLabel(field: ImportedDatasetField, key: ImportedCategoryKey) {
  if (key === null) return "(blank)";
  const labels = field.valueLabels ?? {};
  const label = Object.hasOwn(labels, key) ? labels[key] : undefined;
  return label?.trim() || key;
}

function importedCategoryLabels(field: ImportedDatasetField, observedKeys: Iterable<ImportedCategoryKey>) {
  const keys = [...new Set<ImportedCategoryKey>([...declaredCategoryKeys(field), ...observedKeys])];
  const baseLabel = (key: ImportedCategoryKey) => importedCategoryLabel(field, key);
  const frequencies = new Map<string, number>();
  keys.forEach((key) => frequencies.set(baseLabel(key), (frequencies.get(baseLabel(key)) ?? 0) + 1));
  const usedLabels = new Set<string>();
  return new Map(keys.map((key) => {
    const base = baseLabel(key);
    const suffix = key === null ? "missing" : key;
    let label = frequencies.get(base)! > 1 ? `${base} [${suffix}]` : base;
    while (usedLabels.has(label)) label += ` [${suffix}]`;
    usedLabels.add(label);
    return [key, label] as const;
  }));
}

function importedFilterValueIsAmbiguous(dataset: ImportedDatasetRecord, field: ImportedDatasetField, value: string) {
  const rows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  const observedKeys = rows.map((row) => importedCategoryKey(field, importedRawFieldValue(row, field)));
  const labels = importedCategoryLabels(field, observedKeys);
  if ([...labels.values()].includes(value)) return false;
  return [...labels.keys()].filter((key) => importedCategoryLabel(field, key) === value).length > 1;
}

function importedFieldCategories(dataset: ImportedDatasetRecord, field: ImportedDatasetField) {
  const rows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  const keys = [...new Set(rows.map((row) => importedCategoryKey(field, importedRawFieldValue(row, field))))];
  const labels = importedCategoryLabels(field, keys);
  return keys.map((key) => ({ key, label: labels.get(key)! })).sort((a, b) => a.label.localeCompare(b.label));
}

export function getImportedFilterChoiceSupport(dataset: ImportedDatasetRecord | null | undefined): ImportedDatasetQuerySupport {
  if (!dataset) return { executable: false, reason: "Choose an imported dataset." };
  const available = dataset.rows?.length || dataset.previewRows?.length || 0;
  if (available < dataset.rowCount) {
    return { executable: false, reason: dataset.remote?.provider === "netlify"
      ? "Complete filter choices are unavailable: this browser only has a preview of this study. Select No filter to continue."
      : "Complete respondent data is unavailable. Re-import the source file before choosing a filter." };
  }
  return { executable: true, reason: "Complete respondent rows are available for filter choices." };
}

export function importedFieldValues(dataset: ImportedDatasetRecord | null | undefined, field: ImportedDatasetField | null | undefined) {
  if (!dataset || !field || !getImportedFilterChoiceSupport(dataset).executable) return [];
  return importedFieldCategories(dataset, field).map((category) => category.label);
}

export function runImportedDatasetQuery(config: ImportedDatasetQueryConfig, intersectionAudience?: SavedImportedAudience): AnalyticsQueryResponse {
  if(intersectionAudience && config.dataset.remote) throw new Error("Temporary audience intersections require a complete local study.");
  const support = getImportedDatasetQuerySupport(config.dataset, config.field, {
    groupingScope: config.groupingScope,
    bannerField: config.bannerField,
    filter: config.filter,
    measureField: config.measureField,
    metric: config.metric,
    chartType: config.chartType
  });
  if (!support.executable) throw new Error(support.reason);

  const sourceRows = config.dataset.rows?.length ? config.dataset.rows : config.dataset.previewRows;
  if (sourceRows.length < config.dataset.rowCount) {
    throw new Error("The complete respondent data is required for analysis. Load the server dataset or re-import the source file; preview-only results are not supported.");
  }
  const filterLabels = config.filter ? importedCategoryLabels(config.filter.field,
    sourceRows.map((row) => importedCategoryKey(config.filter!.field, importedRawFieldValue(row, config.filter!.field)))) : null;
  const audiencePredicate = config.audience !== undefined ? compileAudience(config.audience,config.dataset) : null;
  // Compile each independently: a valid saved audience retains its entire depth/node budget.
  const intersectionPredicate = intersectionAudience !== undefined ? compileAudience(intersectionAudience,config.dataset) : null;
  const audienceRows = audiencePredicate || intersectionPredicate ? sourceRows.filter(row=>(!audiencePredicate || audiencePredicate(row)===true) && (!intersectionPredicate || intersectionPredicate(row)===true)) : sourceRows;
  const rows = config.filter?.field
    ? audienceRows.filter((row) => filterLabels!.get(importedCategoryKey(config.filter!.field, importedRawFieldValue(row, config.filter!.field))) === config.filter!.value)
    : audienceRows;
  const bannerCategories = config.bannerField ? importedFieldCategories(config.dataset, config.bannerField) : [{ key: null, label: "Total" }];
  const columnBases = new Map<ImportedCategoryKey, number>(bannerCategories.map(({ key }) => [key, 0]));
  const counts = new Map<ImportedCategoryKey, Map<ImportedCategoryKey, { count: number; sum: FiniteNumericSum }>>();
  let skippedBlankPrimaryResponses = 0;
  let skippedInvalidMeasures = 0;
  rows.forEach((row) => {
    const rawValue = config.groupingScope === "all_respondents" ? "All respondents" : importedRawFieldValue(row, config.field);
    if (!rawValue.trim()) {
      skippedBlankPrimaryResponses += 1;
      return;
    }
    const value = importedCategoryKey(config.field, rawValue);
    const bannerValue = config.bannerField ? importedCategoryKey(config.bannerField, importedRawFieldValue(row, config.bannerField)) : null;
    const numericValue = config.measureField ? parseImportedNumber(importedRawFieldValue(row, config.measureField)) : null;
    const usableMeasureValue = numericValue !== null && Number.isFinite(numericValue);
    // Keep observed grouping categories even when none of their measurements
    // are usable; their mean is unavailable, rather than a missing category.
    if (config.metric === "average" && !counts.has(value)) counts.set(value, new Map());
    if (isMeasureMetric(config.metric) && !usableMeasureValue) { skippedInvalidMeasures += 1; return; }
    columnBases.set(bannerValue, (columnBases.get(bannerValue) ?? 0) + 1);
    const rowCounts = counts.get(value) ?? new Map<ImportedCategoryKey, { count: number; sum: FiniteNumericSum }>();
    const current = rowCounts.get(bannerValue) ?? { count: 0, sum: new FiniteNumericSum() };
    if (!current.sum.add(usableMeasureValue ? numericValue! : 0)) throw new Error("This numeric summary exceeds the supported number range. Rescale the source values before summarizing; no result was created.");
    rowCounts.set(bannerValue, {
      count: current.count + 1,
      sum: current.sum
    });
    counts.set(value, rowCounts);
  });
  // Aggregate by source code, then decorate labels for display. Partial label
  // dictionaries must not drop observed codes, and equal labels are not equal codes.
  if (config.groupingScope === "all_respondents" && ![...columnBases.values()].some(base => base > 0)) {
    throw new Error("No valid numeric values remain for this summary. Check the selected number and filter; no result was created.");
  }
  if (config.groupingScope === "all_respondents" && config.metric === "average" &&
      bannerCategories.some(({ key }) => (columnBases.get(key) ?? 0) === 0)) {
    throw new Error("A breakout group has no valid numeric values for this average. Remove the breakout or choose a supported grouping; no zero mean was created.");
  }
  const declaredKeys = config.groupingScope === "all_respondents" ? [] : declaredCategoryKeys(config.field);
  const categoryLabels = config.groupingScope === "all_respondents" ? new Map<ImportedCategoryKey, string>([["All respondents", "All respondents"]])
    : importedCategoryLabels(config.field, sourceRows.map((row) => importedCategoryKey(config.field, importedRawFieldValue(row, config.field))));
  const unlistedKeys = [...counts.keys()].filter((key) => !declaredKeys.includes(key!)).sort((a, b) => {
    const total = (key: ImportedCategoryKey) => [...(counts.get(key)?.values() ?? [])].reduce((sum, cell) => sum + cell.count, 0);
    return total(b) - total(a) || categoryLabels.get(a)!.localeCompare(categoryLabels.get(b)!);
  });
  const entries = [...declaredKeys, ...unlistedKeys].map((key) => [key, counts.get(key) ?? new Map<ImportedCategoryKey, { count: number; sum: FiniteNumericSum }>()] as const);
  const metric = config.metric === "average"
    ? { id: "average" as const, label: `Average ${importedFieldDisplayLabel(config.measureField) ?? "number"}`, valueFormat: "number" as const }
    : config.metric === "sum"
      ? { id: "sum" as const, label: `Total ${importedFieldDisplayLabel(config.measureField) ?? "number"}`, valueFormat: "number" as const }
      : config.metric === "count"
        ? { id: "count" as const, label: "Number of responses", valueFormat: "number" as const }
        : { id: "percent_selected" as const, label: "% of responses", valueFormat: "percent" as const };
  const sourceIdentity = importedSourceIdentity(config,intersectionAudience);
  const query = importedQuery(config.chartType, metric.id, sourceIdentity);
  const columns = bannerCategories.map(({ key, label }, index) => ({
    sourceCategoryKey: JSON.stringify(key),
    id: config.bannerField ? `${slug(label, "banner")}_${index + 1}` : "summary",
    label
  }));
  const series = entries.map(([key, rowCounts], index) => {
    const label = categoryLabels.get(key)!;
    return {
      id: `${slug(label, "value")}_${index + 1}`,
      label,
      values: bannerCategories.map(({ key }) => {
        const cell = rowCounts.get(key) ?? { count: 0, sum: new FiniteNumericSum() };
        const base = columnBases.get(key) ?? 0;
        if (metric.id === "average" || metric.id === "sum") {
          const total = cell.sum.value();
          if (total === null) throw new Error("This numeric summary exceeds the supported number range. Rescale the source values before summarizing; no result was created.");
          return metric.id === "sum" ? total : cell.count > 0 ? total / cell.count : 0;
        }
        return metric.id === "count" ? cell.count : base > 0 ? Math.round((cell.count / base) * 1000) / 10 : 0;
      }),
      bases: bannerCategories.map(({ key }) => isMeasureMetric(config.metric) ? rowCounts.get(key)?.count ?? 0 : columnBases.get(key) ?? 0)
    };
  });
  const table = series.map((item, index) => ({
    sourceCategoryKey: JSON.stringify(entries[index][0]),
    optionId: item.id,
    label: item.label,
    values: Object.fromEntries(columns.map((column, index) => [column.id, item.values[index] ?? 0])),
    bases: Object.fromEntries(columns.map((column, index) => [column.id, item.bases[index] ?? 0])),
    presentation: {
      rowKind: "option" as const,
      emphasis: "detail" as const
    }
  }));
  const calculationInputs = metric.id === "percent_selected" || metric.id === "average" ? {
    version: 1 as const, method: "local_unweighted_v1" as const,
    query: JSON.parse(JSON.stringify(query)) as AnalyticsQueryRequest,
    columns: Object.fromEntries(columns.map(column => [column.id, column.label])),
    rows: Object.fromEntries(table.map((row, rowIndex) => [row.optionId, {
      label: row.label,
      cells: Object.fromEntries(columns.map((column, columnIndex) => {
        const cell = entries[rowIndex][1].get(bannerCategories[columnIndex].key);
        const numerator = metric.id === "average" ? cell?.sum.value() ?? 0 : cell?.count ?? 0;
        return [column.id, { numerator, denominator: row.bases[column.id] }];
      }))
    }]))
  } : undefined;
  const readiness = buildSignificanceReadiness(query);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(readiness, {
    columnComparison: false,
    waveComparison: false,
    statisticalEngine: false
  });

  return {
    ...(calculationInputs ? { calculationInputs } : {}),
    query,
    labels: columns.map((column) => column.label),
    series,
    columns,
    table,
    metric,
    weighting: {
      applied: false,
      id: null,
      label: "Unweighted"
    },
    annotations: [],
    statistics: {
      confidenceLevel: query.confidenceLevel,
      significanceMethod: "none",
      significanceExecutionPlan,
      significanceExecutionInput: null,
      significanceExecutionReport: null,
      significance: {
        status: "none",
        method: "none",
        readiness,
        reasonCodes: ["summary_only"],
        comparisonBasis: "summary",
        hasPlaceholders: false,
        details: []
      }
    },
    warnings: [
      ...(config.metric === "average" && table.some(row => columns.some(column => row.bases[column.id] === 0)) ? ["Unavailable averages have no valid numeric observations in that cell. They are not zero estimates."] : []),
      ...(!config.dataset.rows?.length && sourceRows === config.dataset.previewRows ? ["Imported result is based on stored preview rows only."] : []),
      ...(config.filter?.field && rows.length === 0 ? ["Imported filter returned no matching rows."] : []),
      ...(skippedInvalidMeasures > 0 ? [`Skipped ${skippedInvalidMeasures.toLocaleString()} row${skippedInvalidMeasures === 1 ? "" : "s"} without a valid numeric value for ${importedFieldDisplayLabel(config.measureField)}.`] : []),
      ...(skippedBlankPrimaryResponses > 0 ? [`Skipped ${skippedBlankPrimaryResponses.toLocaleString()} row${skippedBlankPrimaryResponses === 1 ? "" : "s"} without an answer for ${importedFieldDisplayLabel(config.field)}.`] : []),
      ...(skippedBlankPrimaryResponses === rows.length && rows.length > 0 ? [`No respondent answers were available for ${importedFieldDisplayLabel(config.field)} in the stored rows used for this result.`] : [])
    ],
    notes: [
      `Imported dataset: ${config.dataset.title}.`,
      ...(intersectionAudience ? ["Temporary linked-view intersection applies in addition to the original audience and filter. Recreate it in Explore; ordinary saved-query replay is not supported."] : []),
      isMeasureMetric(config.metric)
        ? `Aggregated ${importedFieldDisplayLabel(config.measureField) ?? "numeric field"} by ${importedFieldDisplayLabel(config.field)}.`
        : `Counted responses for ${importedFieldDisplayLabel(config.field)}.`,
      ...(config.bannerField ? [`Broken out by ${importedFieldDisplayLabel(config.bannerField)}.`] : []),
      ...(config.filter?.field ? [`Filtered to ${importedFieldDisplayLabel(config.filter.field)} is ${config.filter.value}.`] : []),
      "Imported-data support is currently limited to one categorical grouping field, one optional breakout, one optional filter, and one optional numeric measure."
    ],
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      source: sourceIdentity,
      comparisonMode: "none",
      comparisonDatasets: []
    }
  };
}
