import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../../../shared/analytics/queryPlan";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, ImportedAnalyticsSourceIdentity, Metric } from "../../../shared/types/analytics";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { importedSurveyQuestionDisplayLabel } from "./importedSurveyLabelModel";

export interface ImportedDatasetQueryConfig {
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
  const mostlyUnique =
    field.nonEmptyCount > 50 &&
    field.distinctCount <= field.nonEmptyCount &&
    field.distinctCount / Math.max(field.nonEmptyCount, 1) > 0.9;
  return nameLooksLikeIdentifier || mostlyUnique;
}

export function isImportedFieldAnalysisCandidate(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && !isLikelyImportedIdentifierField(field));
}

function importedDatasetHasRows(dataset: ImportedDatasetRecord | null | undefined) {
  return Boolean(dataset && ((dataset.rows?.length ?? 0) > 0 || (dataset.previewRows?.length ?? 0) > 0 || (dataset.remote?.provider === "netlify" && dataset.rowCount > 0)));
}

function importedFieldDisplayLabel(field: ImportedDatasetField | null | undefined) {
  if (!field) return undefined;
  return importedSurveyQuestionDisplayLabel(field);
}

function uniquePositiveBases(result: AnalyticsQueryResponse) {
  return [...new Set(result.table.flatMap((row) => Object.values(row.bases)).filter((base) => base > 0))].sort((a, b) => a - b);
}

function baseRangeLabel(prefix: string, bases: number[]) {
  if (bases.length === 0) return `${prefix} n/a`;
  if (bases.length === 1) return `${prefix} n = ${bases[0].toLocaleString()}`;
  return `${prefix} n = ${bases[0].toLocaleString()}-${bases[bases.length - 1].toLocaleString()}`;
}

export function importedMetricLabel(metric: Metric) {
  if (metric === "average") return "Average";
  if (metric === "sum") return "Sum";
  if (metric === "count") return "Number of responses";
  return "% of responses";
}

export function formatImportedMeasureValue(value: number, metric: Metric) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: metric === "average" || metric === "sum" ? 1 : 0
  }).format(value);
}

export function buildImportedResultProvenance(result: AnalyticsQueryResponse): ImportedResultProvenanceView | null {
  const source = result.metadataRefs.source;
  if (source?.kind !== "imported") return null;

  const isMeasure = source.queryKind === "measure" || isMeasureMetric(result.metric.id);
  const metricLabel = importedMetricLabel(result.metric.id);
  const groupingLabel = source.primaryFieldLabel;
  const measureLabel = source.measureFieldLabel ?? null;
  const bannerLabel = source.bannerFieldLabel ?? "No breakout";
  const filterLabel = source.filterFieldLabel && source.filterValue ? `${source.filterFieldLabel} is ${source.filterValue}` : "No filter";
  const baseLabel = baseRangeLabel(isMeasure ? "Valid measure" : "Sample", uniquePositiveBases(result));
  const summaryLabel = isMeasure && measureLabel
    ? `${metricLabel} ${measureLabel} by ${groupingLabel}`
    : source.bannerFieldLabel
      ? `Count responses for ${groupingLabel}, broken out by ${source.bannerFieldLabel}`
      : `Count responses for ${groupingLabel}`;

  return {
    isImported: true,
    isMeasure,
    queryKindLabel: isMeasure ? "Imported numeric summary" : source.bannerFieldLabel ? "Imported response count by breakout" : "Imported response count",
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
    ...(field.eligibleForBanner ? ["Banner"] : []),
    ...(field.eligibleForFilter ? ["Filter"] : [])
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
  if (!importedDatasetHasRows(dataset)) return [];

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
  if (!isExecutableDimension(field)) {
    return { executable: false, reason: "Imported queries require a categorical grouping field." };
  }
  if (isMeasureMetric(options?.metric)) {
    if (!options?.measureField) {
      return { executable: false, reason: "Choose a numeric imported measure field." };
    }
    if (!isExecutableMeasure(options.measureField)) {
      return { executable: false, reason: "Measure aggregation is limited to numeric measure fields." };
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
    if (options.chartType === "donut") {
      return { executable: false, reason: "Donut charts are only supported for imported queries without a banner." };
    }
  }
  if (options?.filter?.field) {
    if (!options.filter.field.eligibleForFilter || !isExecutableDimension(options.filter.field)) {
      return { executable: false, reason: "Imported filters are limited to filter-eligible categorical fields." };
    }
    if (!options.filter.value || options.filter.value === "all") {
      return { executable: false, reason: "Choose a filter value or remove the imported filter." };
    }
  }
  const hasRemoteRows = dataset.remote?.provider === "netlify" && dataset.rowCount > 0;
  const rows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  if (!rows.length && !hasRemoteRows) {
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

function importedSourceIdentity(config: ImportedDatasetQueryConfig): ImportedAnalyticsSourceIdentity {
  return {
    kind: "imported",
    queryKind: isMeasureMetric(config.metric) ? "measure" : "categorical",
    datasetId: config.dataset.id,
    datasetLabel: config.dataset.title,
    primaryFieldId: config.field.id,
    primaryFieldLabel: importedFieldDisplayLabel(config.field) ?? config.field.label,
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
    sourceIdentity
  };
}

export function importedFieldValues(dataset: ImportedDatasetRecord | null | undefined, field: ImportedDatasetField | null | undefined) {
  if (!dataset || !field) return [];
  const rows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  return Array.from(
    new Set(rows.map((row) => importedFieldDisplayValue(field, row[field.sourceColumn])))
  ).sort((a, b) => a.localeCompare(b));
}

function importedFieldDisplayValue(field: ImportedDatasetField, rawValue: string | undefined) {
  const value = (rawValue ?? "").trim();
  if (!value) return "(blank)";
  return field.valueLabels?.[value] ?? field.valueLabels?.[Number(value).toString()] ?? value;
}

function importedFieldAnswerChoiceLabels(field: ImportedDatasetField) {
  return Object.entries(field.valueLabels ?? {})
    .sort(([valueA], [valueB]) => {
      const numericA = Number(valueA);
      const numericB = Number(valueB);
      if (Number.isFinite(numericA) && Number.isFinite(numericB)) return numericA - numericB;
      return valueA.localeCompare(valueB);
    })
    .map(([, label]) => label.trim())
    .filter(Boolean);
}

export function runImportedDatasetQuery(config: ImportedDatasetQueryConfig): AnalyticsQueryResponse {
  const support = getImportedDatasetQuerySupport(config.dataset, config.field, {
    bannerField: config.bannerField,
    filter: config.filter,
    measureField: config.measureField,
    metric: config.metric,
    chartType: config.chartType
  });
  if (!support.executable) throw new Error(support.reason);

  const sourceRows = config.dataset.rows?.length ? config.dataset.rows : config.dataset.previewRows;
  const rows = config.filter?.field
    ? sourceRows.filter((row) => importedFieldDisplayValue(config.filter!.field, row[config.filter!.field.sourceColumn]) === config.filter!.value)
    : sourceRows;
  const bannerValues = config.bannerField ? importedFieldValues(config.dataset, config.bannerField) : ["Total"];
  const columnBases = new Map<string, number>(bannerValues.map((value) => [value, 0]));
  const counts = new Map<string, Map<string, { count: number; sum: number }>>();
  rows.forEach((row) => {
    const rawValue = row[config.field.sourceColumn] ?? "";
    const value = importedFieldDisplayValue(config.field, rawValue);
    const bannerValue = config.bannerField ? importedFieldDisplayValue(config.bannerField, row[config.bannerField.sourceColumn]) : "Total";
    const numericValue = config.measureField ? Number.parseFloat((row[config.measureField.sourceColumn] ?? "").replace(/,/g, "")) : null;
    const usableMeasureValue = numericValue !== null && Number.isFinite(numericValue);
    if (isMeasureMetric(config.metric) && !usableMeasureValue) return;
    columnBases.set(bannerValue, (columnBases.get(bannerValue) ?? 0) + 1);
    const rowCounts = counts.get(value) ?? new Map<string, { count: number; sum: number }>();
    const current = rowCounts.get(bannerValue) ?? { count: 0, sum: 0 };
    rowCounts.set(bannerValue, {
      count: current.count + 1,
      sum: current.sum + (usableMeasureValue ? numericValue! : 0)
    });
    counts.set(value, rowCounts);
  });
  const answerChoiceLabels = importedFieldAnswerChoiceLabels(config.field);
  const entries = (answerChoiceLabels.length
    ? answerChoiceLabels.map((label) => [label, counts.get(label) ?? new Map<string, { count: number; sum: number }>()] as const)
    : Array.from(counts.entries())
  ).sort((a, b) => {
    if (answerChoiceLabels.length) return answerChoiceLabels.indexOf(a[0]) - answerChoiceLabels.indexOf(b[0]);
    const aTotal = Array.from(a[1].values()).reduce((sum, cell) => sum + cell.count, 0);
    const bTotal = Array.from(b[1].values()).reduce((sum, cell) => sum + cell.count, 0);
    return bTotal - aTotal || a[0].localeCompare(b[0]);
  });
  const metric = config.metric === "average"
    ? { id: "average" as const, label: `Average ${importedFieldDisplayLabel(config.measureField) ?? "number"}`, valueFormat: "number" as const }
    : config.metric === "sum"
      ? { id: "sum" as const, label: `Total ${importedFieldDisplayLabel(config.measureField) ?? "number"}`, valueFormat: "number" as const }
      : config.metric === "count"
        ? { id: "count" as const, label: "Number of responses", valueFormat: "number" as const }
        : { id: "percent_selected" as const, label: "% of responses", valueFormat: "percent" as const };
  const sourceIdentity = importedSourceIdentity(config);
  const query = importedQuery(config.chartType, metric.id, sourceIdentity);
  const columns = bannerValues.map((label, index) => ({
    id: config.bannerField ? `${slug(label, "banner")}_${index + 1}` : "summary",
    label
  }));
  const series = entries.map(([label, rowCounts], index) => ({
    id: `${slug(label, "value")}_${index + 1}`,
    label,
    values: columns.map((column) => {
      const cell = rowCounts.get(column.label) ?? { count: 0, sum: 0 };
      const base = columnBases.get(column.label) ?? 0;
      if (metric.id === "average") return cell.count > 0 ? Math.round((cell.sum / cell.count) * 10) / 10 : 0;
      if (metric.id === "sum") return Math.round(cell.sum * 10) / 10;
      return metric.id === "count" ? cell.count : base > 0 ? Math.round((cell.count / base) * 1000) / 10 : 0;
    }),
    bases: columns.map((column) => columnBases.get(column.label) ?? 0)
  }));
  const table = series.map((item) => ({
    optionId: item.id,
    label: item.label,
    values: Object.fromEntries(columns.map((column, index) => [column.id, item.values[index] ?? 0])),
    bases: Object.fromEntries(columns.map((column, index) => [column.id, item.bases[index] ?? 0])),
    presentation: {
      rowKind: "option" as const,
      emphasis: "detail" as const
    }
  }));
  const readiness = buildSignificanceReadiness(query);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(readiness, {
    columnComparison: false,
    waveComparison: false,
    statisticalEngine: false
  });

  return {
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
      ...(!config.dataset.rows?.length && sourceRows === config.dataset.previewRows ? ["Imported result is based on stored preview rows only."] : []),
      ...(config.filter?.field && rows.length === 0 ? ["Imported filter returned no matching rows."] : [])
    ],
    notes: [
      `Imported dataset: ${config.dataset.title}.`,
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
