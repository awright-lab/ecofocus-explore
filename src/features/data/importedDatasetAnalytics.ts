import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../../../shared/analytics/queryPlan";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse, ChartType, Metric } from "../../../shared/types/analytics";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";

export interface ImportedDatasetQueryConfig {
  dataset: ImportedDatasetRecord;
  field: ImportedDatasetField;
  chartType: ChartType;
  metric: Metric;
}

export interface ImportedDatasetQuerySupport {
  executable: boolean;
  reason: string;
}

export function getImportedDatasetQuerySupport(dataset: ImportedDatasetRecord | null | undefined, field: ImportedDatasetField | null | undefined): ImportedDatasetQuerySupport {
  if (!dataset) return { executable: false, reason: "Choose an imported dataset." };
  if (!field) return { executable: false, reason: "Choose an imported field." };
  if (field.type !== "categorical" && field.modelingRole !== "candidate_dimension") {
    return { executable: false, reason: "First imported-query support is limited to categorical dimension fields." };
  }
  const rows = dataset.rows?.length ? dataset.rows : dataset.previewRows;
  if (!rows.length) return { executable: false, reason: "This dataset has no stored rows to tabulate." };
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

export function runImportedDatasetQuery(config: ImportedDatasetQueryConfig): AnalyticsQueryResponse {
  const support = getImportedDatasetQuerySupport(config.dataset, config.field);
  if (!support.executable) throw new Error(support.reason);

  const rows = config.dataset.rows?.length ? config.dataset.rows : config.dataset.previewRows;
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const rawValue = row[config.field.sourceColumn] ?? "";
    const value = rawValue.trim() || "(blank)";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const metric = config.metric === "count"
    ? { id: "count" as const, label: "Count", valueFormat: "number" as const }
    : { id: "percent_selected" as const, label: "% of rows", valueFormat: "percent" as const };
  const query = importedQuery(config.chartType, metric.id);
  const columns = [{ id: "summary", label: "Total" }];
  const series = entries.map(([label, count], index) => ({
    id: `${slug(label, "value")}_${index + 1}`,
    label,
    values: [metric.id === "count" ? count : total > 0 ? Math.round((count / total) * 1000) / 10 : 0],
    bases: [total]
  }));
  const table = series.map((item) => ({
    optionId: item.id,
    label: item.label,
    values: { summary: item.values[0] },
    bases: { summary: total },
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
    warnings: rows === config.dataset.previewRows && !config.dataset.rows?.length ? ["Imported result is based on stored preview rows only."] : [],
    notes: [
      `Imported dataset: ${config.dataset.title}.`,
      `Tabulated categorical field: ${config.field.label}.`,
      "Imported-data support is currently limited to single-field count/percent tabulations."
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
