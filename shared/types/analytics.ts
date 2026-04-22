export type DatasetId = "ecofocus_2025";

export type QuestionId = "Q_PACKAGING_TRUST" | "Q_SUSTAINABILITY_IMPORTANCE" | "Q15_TOP2_BRAND_PRIORITIES";

export type BreakById = "SUMMARY" | "GENERATION" | "REGION";

export type FilterFieldId = BreakById | "SHOPPER_SEGMENT";

export type DimensionId = FilterFieldId;

export type Metric = "column_percent" | "percent_selected" | "count";

export type ChartType = "vertical_bar" | "grouped_bar" | "table";

export type WeightId = "weightvar";

export interface AnalyticsFilter {
  field: FilterFieldId | QuestionId;
  values: string[];
}

export interface AnalyticsQueryRequest {
  dataset: DatasetId;
  question: QuestionId;
  breakBy: BreakById;
  filters: AnalyticsFilter[];
  weight: WeightId | null;
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

export interface AnalyticsTableColumn {
  id: string;
  label: string;
}

export interface AnalyticsAnnotation {
  rowId: string;
  columnId: string;
  direction: "up" | "down";
  confidence: number;
}

export interface AnalyticsQueryResponse {
  query: AnalyticsQueryRequest;
  labels: string[];
  series: AnalyticsSeries[];
  columns: AnalyticsTableColumn[];
  table: AnalyticsTableRow[];
  metric: {
    id: Metric;
    label: string;
    valueFormat: "percent" | "number";
  };
  weighting: {
    applied: boolean;
    id: WeightId | null;
    label: string;
  };
  annotations: AnalyticsAnnotation[];
  warnings: string[];
  notes: string[];
  metadataRefs: {
    dataset: DatasetId;
    question: QuestionId;
    breakBy: BreakById;
  };
}

export interface AnalyticsErrorResponse {
  error: string;
  details?: string[];
}
