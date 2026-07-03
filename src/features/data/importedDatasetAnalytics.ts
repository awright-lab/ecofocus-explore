import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../../../shared/analytics/queryPlan";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, Metric } from "../../../shared/types/analytics";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface ImportedDatasetQueryConfig {
  dataset: ImportedDatasetRecord;
  field: ImportedDatasetField;
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

export function getImportedDatasetQuerySupport(
  dataset: ImportedDatasetRecord | null | undefined,
  field: ImportedDatasetField | null | undefined,
  options?: {
    bannerField?: ImportedDatasetField | null;
    filter?: {
      field: ImportedDatasetField | null;
      value: string;
    } | null;
    chartType?: ChartType;
  }
): ImportedDatasetQuerySupport {
  if (!dataset) return { executable: false, reason: "Choose an imported dataset." };
  if (!field) return { executable: false, reason: "Choose an imported field." };
  if (!isExecutableDimension(field)) {
    return { executable: false, reason: "First imported-query support is limited to categorical dimension fields." };
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
  if (options?.bannerField && options?.filter?.field) return { executable: true, reason: "Supported: filtered categorical field tabulation by one banner." };
  if (options?.bannerField) return { executable: true, reason: "Supported: categorical field tabulation by one banner." };
  if (options?.filter?.field) return { executable: true, reason: "Supported: filtered categorical field tabulation." };
  return { executable: true, reason: "Supported: categorical field tabulation." };
}

function slug(value: string, fallback: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function importedQuery(chartType: ChartType, metric: Metric): AnalyticsQueryRequest {
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
    comparisonDatasets: []
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
    chartType: config.chartType
  });
  if (!support.executable) throw new Error(support.reason);

  const sourceRows = config.dataset.rows?.length ? config.dataset.rows : config.dataset.previewRows;
  const rows = config.filter?.field
    ? sourceRows.filter((row) => ((row[config.filter!.field.sourceColumn] ?? "").trim() || "(blank)") === config.filter!.value)
    : sourceRows;
  const bannerValues = config.bannerField ? importedFieldValues(config.dataset, config.bannerField) : ["Total"];
  const columnBases = new Map<string, number>(bannerValues.map((value) => [value, 0]));
  const counts = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const rawValue = row[config.field.sourceColumn] ?? "";
    const value = rawValue.trim() || "(blank)";
    const bannerValue = config.bannerField ? (row[config.bannerField.sourceColumn] ?? "").trim() || "(blank)" : "Total";
    columnBases.set(bannerValue, (columnBases.get(bannerValue) ?? 0) + 1);
    const rowCounts = counts.get(value) ?? new Map<string, number>();
    rowCounts.set(bannerValue, (rowCounts.get(bannerValue) ?? 0) + 1);
    counts.set(value, rowCounts);
  });
  const total = rows.length;
  const entries = Array.from(counts.entries()).sort((a, b) => {
    const aTotal = Array.from(a[1].values()).reduce((sum, count) => sum + count, 0);
    const bTotal = Array.from(b[1].values()).reduce((sum, count) => sum + count, 0);
    return bTotal - aTotal || a[0].localeCompare(b[0]);
  });
  const metric = config.metric === "count"
    ? { id: "count" as const, label: "Count", valueFormat: "number" as const }
    : { id: "percent_selected" as const, label: "% of rows", valueFormat: "percent" as const };
  const query = importedQuery(config.chartType, metric.id);
  const columns = bannerValues.map((label, index) => ({
    id: config.bannerField ? `${slug(label, "banner")}_${index + 1}` : "summary",
    label
  }));
  const series = entries.map(([label, rowCounts], index) => ({
    id: `${slug(label, "value")}_${index + 1}`,
    label,
    values: columns.map((column) => {
      const count = rowCounts.get(column.label) ?? 0;
      const base = columnBases.get(column.label) ?? 0;
      return metric.id === "count" ? count : base > 0 ? Math.round((count / base) * 1000) / 10 : 0;
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
      `Tabulated categorical field: ${config.field.label}.`,
      ...(config.bannerField ? [`Banner: ${config.bannerField.label}.`] : []),
      ...(config.filter?.field ? [`Filter: ${config.filter.field.label} = ${config.filter.value}.`] : []),
      "Imported-data support is currently limited to one categorical field, one optional banner, and one optional filter."
    ],
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      comparisonMode: "none",
      comparisonDatasets: []
    }
  };
}
