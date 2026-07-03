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

function isExecutableDimension(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && (field.type === "categorical" || field.modelingRole === "candidate_dimension"));
}

function isExecutableMeasure(field: ImportedDatasetField | null | undefined) {
  return Boolean(field && (field.type === "numeric" || field.modelingRole === "candidate_measure"));
}

function isMeasureMetric(metric: Metric | undefined) {
  return metric === "average" || metric === "sum";
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
