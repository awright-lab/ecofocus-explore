export type DatasetId = "ecofocus_2025";

export type QuestionId = "Q_PACKAGING_TRUST" | "Q_SUSTAINABILITY_IMPORTANCE";

export type DimensionId = "GENERATION" | "REGION";

export type Metric = "column_percent" | "count";

export type ChartType = "grouped_bar" | "table";

export interface AnalyticsFilter {
  field: DimensionId | QuestionId;
  values: string[];
}

export interface AnalyticsQueryRequest {
  dataset: DatasetId;
  question: QuestionId;
  breakBy: DimensionId;
  filters: AnalyticsFilter[];
  metric: Metric;
  chartType: ChartType;
}

export interface AnalyticsSeries {
  id: string;
  label: string;
  values: number[];
  bases: number[];
}

export interface AnalyticsTableRow {
  optionId: string;
  label: string;
  values: Record<string, number>;
  bases: Record<string, number>;
}

export interface AnalyticsQueryResponse {
  query: AnalyticsQueryRequest;
  labels: string[];
  series: AnalyticsSeries[];
  table: AnalyticsTableRow[];
  metric: {
    id: Metric;
    label: string;
    valueFormat: "percent" | "number";
  };
  notes: string[];
  metadataRefs: {
    dataset: DatasetId;
    question: QuestionId;
    breakBy: DimensionId;
  };
}

export interface AnalyticsErrorResponse {
  error: string;
  details?: string[];
}
