import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../../../shared/analytics/queryPlan";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, ImportedAnalyticsSourceIdentity, Metric } from "../../../shared/types/analytics";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

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
}

export interface ImportedQueryRecommendationView {
  id: "categorical" | "measure";
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

function isExecutableDimension(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && (field.type === "categorical" || field.modelingRole === "candidate_dimension"));
}

function isExecutableMeasure(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && (field.type === "numeric" || field.modelingRole === "candidate_measure"));
}

function isMeasureMetric(metric: Metric | undefined) {
  return metric === "average" || metric === "sum";
}

function uniquePositiveBases(result: AnalyticsQueryResponse) {
  return [...new Set(result.table.flatMap((row) => Object.values(row.bases)).filter((base) => base > 0))].sort((a, b) => a - b);
}

function baseRangeLabel(prefix: string, bases: number[]) {
  if (bases.length === 0) return `${prefix} n/a`;
  if (bases.length === 1) return `${prefix} n=${bases[0].toLocaleString()}`;
  return `${prefix} n=${bases[0].toLocaleString()}-${bases[bases.length - 1].toLocaleString()}`;
}

export function importedMetricLabel(metric: Metric) {
  if (metric === "average") return "Average";
  if (metric === "sum") return "Sum";
  if (metric === "count") return "Count";
  return "% of rows";
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
  const bannerLabel = source.bannerFieldLabel ?? "No banner";
  const filterLabel = source.filterFieldLabel && source.filterValue ? `${source.filterFieldLabel}: ${source.filterValue}` : "No filter";
  const baseLabel = baseRangeLabel(isMeasure ? "Valid measure" : "Rows", uniquePositiveBases(result));
  const summaryLabel = isMeasure && measureLabel
    ? `${metricLabel} ${measureLabel} by ${groupingLabel}`
    : `${groupingLabel}${source.bannerFieldLabel ? ` by ${source.bannerFieldLabel}` : ""}`;

  return {
    isImported: true,
    isMeasure,
    queryKindLabel: isMeasure ? "Imported measure" : source.bannerFieldLabel ? "Imported crosstab" : "Imported categorical",
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
      `Group: ${groupingLabel}`,
      ...(isMeasure && measureLabel ? [`Measure: ${measureLabel}`] : []),
      `Metric: ${metricLabel}`,
      `Banner: ${bannerLabel}`,
      `Filter: ${filterLabel}`,
      baseLabel
    ]
  };
}

export function buildImportedFieldSuitability(field: ImportedDatasetField): ImportedFieldSuitabilityView {
  const isDimension = isExecutableDimension(field);
  const isMeasure = isExecutableMeasure(field);
  const hasRows = field.nonEmptyCount > 0;
  const isHighCardinalityDimension = isDimension && field.distinctCount > 40;
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
      readiness: {
        status: hasRows ? "ready_dimension" : "unsupported",
        label: hasRows ? "Ready for analysis" : "No usable values",
        tone: hasRows ? "ready" : "blocked",
        reason: hasRows
          ? "This field is modeled as a usable dimension for imported tabulations and one-banner crosstabs."
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

export function firstImportedDimensionField(dataset: ImportedDatasetRecord | null | undefined) {
  return (dataset?.fields ?? []).find((field) => isExecutableDimension(field)) ?? null;
}

export function firstImportedMeasureField(dataset: ImportedDatasetRecord | null | undefined) {
  return (dataset?.fields ?? []).find((field) => isExecutableMeasure(field)) ?? null;
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

  const bannerField = options?.bannerFields?.find((item) => item.id !== field.id) ?? null;
  const measureField = options?.measureField ?? firstImportedMeasureField(dataset);
  const recommendations: ImportedQueryRecommendationView[] = [
    {
      id: "categorical",
      label: bannerField ? "Categorical crosstab" : "Categorical tabulation",
      description: bannerField
        ? `Show ${field.label} by ${bannerField.label}.`
        : `Show row counts or % of rows for ${field.label}.`,
      actionLabel: bannerField ? "Use crosstab" : "Use tabulation",
      chartType: bannerField ? "grouped_bar" : "vertical_bar",
      metric: "percent_selected",
      bannerFieldId: bannerField?.id ?? null,
      measureFieldId: null,
      recommended: options?.selectedQueryMode !== "measure"
    }
  ];

  if (measureField && measureField.id !== field.id && measureField.id !== bannerField?.id) {
    recommendations.push({
      id: "measure",
      label: "Numeric measure",
      description: `Average ${measureField.label} by ${field.label}.`,
      actionLabel: "Use measure",
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
      return { executable: false, reason: "Imported banners are limited to banner-eligible categorical fields." };
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
  const rows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  if (!rows.length) return { executable: false, reason: "This dataset has no stored rows to tabulate." };
  if (isMeasureMetric(options?.metric)) {
    if (options?.bannerField && options?.filter?.field) return { executable: true, reason: `Supported: filtered ${options.metric} of one numeric measure by grouping and banner.` };
    if (options?.bannerField) return { executable: true, reason: `Supported: ${options.metric} of one numeric measure by grouping and banner.` };
    if (options?.filter?.field) return { executable: true, reason: `Supported: filtered ${options.metric} of one numeric measure by grouping.` };
    return { executable: true, reason: `Supported: ${options?.metric} of one numeric measure by grouping.` };
  }
  if (options?.bannerField && options?.filter?.field) return { executable: true, reason: "Supported: filtered categorical crosstab by one banner." };
  if (options?.bannerField) return { executable: true, reason: "Supported: categorical crosstab by one banner." };
  if (options?.filter?.field) return { executable: true, reason: "Supported: filtered categorical field tabulation." };
  return { executable: true, reason: "Supported: categorical field tabulation." };
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
    primaryFieldLabel: config.field.label,
    measureFieldId: config.measureField?.id,
    measureFieldLabel: config.measureField?.label,
    bannerFieldId: config.bannerField?.id,
    bannerFieldLabel: config.bannerField?.label,
    filterFieldId: config.filter?.field.id,
    filterFieldLabel: config.filter?.field.label,
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
    new Set(rows.map((row) => (row[field.sourceColumn] ?? "").trim() || "(blank)"))
  ).sort((a, b) => a.localeCompare(b));
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
    ? sourceRows.filter((row) => ((row[config.filter!.field.sourceColumn] ?? "").trim() || "(blank)") === config.filter!.value)
    : sourceRows;
  const bannerValues = config.bannerField ? importedFieldValues(config.dataset, config.bannerField) : ["Total"];
  const columnBases = new Map<string, number>(bannerValues.map((value) => [value, 0]));
  const counts = new Map<string, Map<string, { count: number; sum: number }>>();
  rows.forEach((row) => {
    const rawValue = row[config.field.sourceColumn] ?? "";
    const value = rawValue.trim() || "(blank)";
    const bannerValue = config.bannerField ? (row[config.bannerField.sourceColumn] ?? "").trim() || "(blank)" : "Total";
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
  const entries = Array.from(counts.entries()).sort((a, b) => {
    const aTotal = Array.from(a[1].values()).reduce((sum, cell) => sum + cell.count, 0);
    const bTotal = Array.from(b[1].values()).reduce((sum, cell) => sum + cell.count, 0);
    return bTotal - aTotal || a[0].localeCompare(b[0]);
  });
  const metric = config.metric === "average"
    ? { id: "average" as const, label: `Average ${config.measureField?.label ?? "measure"}`, valueFormat: "number" as const }
    : config.metric === "sum"
      ? { id: "sum" as const, label: `Sum of ${config.measureField?.label ?? "measure"}`, valueFormat: "number" as const }
      : config.metric === "count"
        ? { id: "count" as const, label: "Count", valueFormat: "number" as const }
        : { id: "percent_selected" as const, label: "% of rows", valueFormat: "percent" as const };
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
        ? `Aggregated ${config.measureField?.label ?? "numeric measure"} by ${config.field.label}.`
        : `Tabulated categorical field: ${config.field.label}.`,
      ...(config.bannerField ? [`Banner: ${config.bannerField.label}.`] : []),
      ...(config.filter?.field ? [`Filter: ${config.filter.field.label} = ${config.filter.value}.`] : []),
      "Imported-data support is currently limited to one categorical grouping field, one optional banner, one optional filter, and one optional numeric measure."
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
