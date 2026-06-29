export type DatasetId = "ecofocus_2023" | "ecofocus_2024" | "ecofocus_2025";

export type QuestionId = "Q_PACKAGING_TRUST" | "Q_SUSTAINABILITY_IMPORTANCE" | "Q15_TOP2_BRAND_PRIORITIES";

export type BreakById = "SUMMARY" | "GENERATION" | "REGION";

export type FilterFieldId = BreakById | "SHOPPER_SEGMENT";

export type DimensionId = FilterFieldId;

export type Metric = "column_percent" | "percent_selected" | "count";

export type ChartType = "vertical_bar" | "horizontal_bar" | "grouped_bar" | "stacked_bar" | "line_chart" | "donut" | "table";

export type WeightId = "weightvar";

export type ConfidenceLevel = 0.9 | 0.95 | 0.99;

export type ComparisonMode = "none" | "wave";

export interface AnalyticsFilter {
  field: FilterFieldId | QuestionId;
  values: string[];
}

export type AnalyticsAuthoredRowKind = "option" | "net" | "topbox" | "bottombox";

export interface AnalyticsAuthoredVariableSetRow {
  id: string;
  label: string;
  kind: AnalyticsAuthoredRowKind;
  sourceOptionIds: string[];
  rowOrder: number;
  visible: boolean;
  emphasis: "detail" | "summary";
}

export interface AnalyticsAuthoredVariableSet {
  id: string;
  label: string;
  rowMode: "authored";
  rows: AnalyticsAuthoredVariableSetRow[];
}

export interface AnalyticsQueryRequest {
  dataset: DatasetId;
  question: QuestionId;
  breakBy: BreakById;
  filters: AnalyticsFilter[];
  weight: WeightId | null;
  metric: Metric;
  chartType: ChartType;
  confidenceLevel: ConfidenceLevel;
  comparisonMode?: ComparisonMode;
  comparisonDatasets?: DatasetId[];
  authoredVariableSet?: AnalyticsAuthoredVariableSet;
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
  presentation?: {
    rowKind: "option" | "net" | "topbox" | "bottombox";
    emphasis: "detail" | "summary";
  };
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

export type SignificanceMethod = "none" | "mock_placeholder" | "column_comparison" | "wave_comparison";

export type SignificanceStatus = "none" | "placeholder" | "unsupported" | "eligible" | "tested";

export type SignificanceReasonCode =
  | "mock_provider_placeholder"
  | "mock_provider_not_available"
  | "wave_comparison_unsupported"
  | "summary_only"
  | "no_comparison_basis"
  | "insufficient_base"
  | "future_method"
  | "invalid_execution_input";

export type SignificanceReadinessStatus = "candidate" | "unsupported" | "not_applicable";

export interface AnalyticsSignificanceReadiness {
  status: SignificanceReadinessStatus;
  method: SignificanceMethod;
  reasonCodes: SignificanceReasonCode[];
  comparisonBasis: "none" | "summary" | "breakout" | "wave";
}

export type SignificanceExecutionPlanStatus = "ready" | "deferred" | "blocked" | "not_applicable";

export type SignificanceExecutionPrerequisite =
  | "comparison_basis"
  | "provider_method"
  | "statistical_engine"
  | "wave_support"
  | "execution_input";

export interface AnalyticsSignificanceExecutionPlan {
  status: SignificanceExecutionPlanStatus;
  candidateMethod: SignificanceMethod;
  queryShapeSupported: boolean;
  providerCanExecute: boolean;
  executionInputContract: "column_comparison" | "wave_comparison" | null;
  reasonCodes: SignificanceReasonCode[];
  unmetPrerequisites: SignificanceExecutionPrerequisite[];
}

export interface AnalyticsColumnComparisonExecutionInput {
  method: "column_comparison";
  confidenceLevel: ConfidenceLevel;
  metric: {
    id: Metric;
    valueFormat: "percent" | "number";
  };
  comparisonScope: {
    basis: "breakout";
    rowIds: string[];
    columnIds: string[];
  };
  columns: Array<{
    id: string;
    label: string;
  }>;
  rows: Array<{
    id: string;
    label: string;
    cells: Array<{
      columnId: string;
      value: number;
      base: number;
    }>;
  }>;
}

export interface AnalyticsWaveComparisonExecutionInput {
  method: "wave_comparison";
  confidenceLevel: ConfidenceLevel;
  metric: {
    id: Metric;
    valueFormat: "percent" | "number";
  };
  comparisonScope: {
    basis: "wave";
    rowIds: string[];
    waveIds: DatasetId[];
    primaryDatasetId: DatasetId;
    comparisonDatasetIds: DatasetId[];
    breakoutColumnIds?: string[];
  };
  breakoutColumns?: Array<{
    id: string;
    label: string;
  }>;
  waves: Array<{
    id: DatasetId;
    label: string;
  }>;
  rows: Array<{
    id: string;
    label: string;
    cells: Array<{
      waveId: DatasetId;
      breakoutColumnId?: string;
      value: number;
      base: number;
    }>;
  }>;
}

export type AnalyticsSignificanceExecutionInput = AnalyticsColumnComparisonExecutionInput | AnalyticsWaveComparisonExecutionInput;

export type SignificanceExecutionReportStatus = "not_executed" | "deferred" | "executed";

export interface AnalyticsColumnComparisonExecutionResult {
  method: "column_comparison";
  comparisonScope: {
    basis: "breakout";
    rowIds: string[];
    columnIds: string[];
  };
  outcomes: Array<{
    rowId: string;
    columnId: string;
    comparedColumnId: string;
    status: "deferred" | "not_tested" | "placeholder" | "tested";
    reasonCodes: SignificanceReasonCode[];
    statistics: {
      pValue: number | null;
      confidence: ConfidenceLevel | null;
      direction: "up" | "down" | null;
    };
  }>;
  summary: {
    testedComparisons: number;
    deferredComparisons: number;
    notTestedComparisons?: number;
    pendingComparisons?: number;
    significantComparisons?: number;
  };
}

export interface AnalyticsColumnComparisonExecutionReport {
  method: "column_comparison";
  status: SignificanceExecutionReportStatus;
  inputAccepted: boolean;
  reasonCodes: SignificanceReasonCode[];
  unmetPrerequisites: SignificanceExecutionPrerequisite[];
  result: AnalyticsColumnComparisonExecutionResult | null;
}

export interface AnalyticsWaveComparisonExecutionResult {
  method: "wave_comparison";
  comparisonScope: {
    basis: "wave";
    rowIds: string[];
    waveIds: DatasetId[];
    primaryDatasetId: DatasetId;
    comparisonDatasetIds: DatasetId[];
  };
  outcomes: Array<{
    rowId: string;
    waveId: DatasetId;
    comparedWaveId: DatasetId;
    breakoutColumnId?: string;
    status: "deferred" | "not_tested" | "placeholder" | "tested";
    reasonCodes: SignificanceReasonCode[];
    statistics: {
      pValue: number | null;
      confidence: ConfidenceLevel | null;
      direction: "up" | "down" | null;
    };
  }>;
  summary: {
    testedComparisons: number;
    deferredComparisons: number;
    notTestedComparisons?: number;
    pendingComparisons?: number;
    significantComparisons?: number;
  };
}

export interface AnalyticsWaveComparisonExecutionReport {
  method: "wave_comparison";
  status: SignificanceExecutionReportStatus;
  inputAccepted: boolean;
  reasonCodes: SignificanceReasonCode[];
  unmetPrerequisites: SignificanceExecutionPrerequisite[];
  result: AnalyticsWaveComparisonExecutionResult | null;
}

export type AnalyticsSignificanceExecutionReport = AnalyticsColumnComparisonExecutionReport | AnalyticsWaveComparisonExecutionReport;

export interface AnalyticsSignificanceResult {
  status: SignificanceStatus;
  method: SignificanceMethod;
  readiness: AnalyticsSignificanceReadiness;
  reasonCodes: SignificanceReasonCode[];
  comparisonBasis: "none" | "summary" | "breakout" | "wave";
  hasPlaceholders: boolean;
  details: Array<{
    rowId: string;
    columnId: string;
    direction?: "up" | "down";
    confidence: ConfidenceLevel;
    status: Exclude<SignificanceStatus, "none">;
    reasonCodes: SignificanceReasonCode[];
  }>;
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
  statistics: {
    confidenceLevel: ConfidenceLevel;
    significanceMethod: SignificanceMethod;
    significanceExecutionPlan: AnalyticsSignificanceExecutionPlan;
    significanceExecutionInput: AnalyticsSignificanceExecutionInput | null;
    significanceExecutionReport: AnalyticsSignificanceExecutionReport | null;
    significance: AnalyticsSignificanceResult;
  };
  warnings: string[];
  notes: string[];
  metadataRefs: {
    dataset: DatasetId;
    question: QuestionId;
    breakBy: BreakById;
    comparisonMode?: ComparisonMode;
    comparisonDatasets?: DatasetId[];
    authoredVariableSet?: {
      id: string;
      label: string;
      applied: boolean;
    };
  };
}

export interface AnalyticsErrorResponse {
  error: string;
  details?: string[];
}
