import type { BreakById, ChartType, DatasetId, DimensionId, FilterFieldId, Metric, QuestionId, WeightId } from "../types/analytics";

export type QuestionType = "single_select" | "multi_binary_set";

export type DimensionRole = "banner" | "filter";

export interface QuestionOptionMetadata {
  id: string;
  label: string;
  sortOrder: number;
}

export interface QuestionMetadata {
  id: QuestionId;
  label: string;
  shortLabel: string;
  topic: string;
  type: QuestionType;
  sourceColumn: string;
  sourceVariables?: string[];
  universe: string;
  defaultMetric: Metric;
  options: QuestionOptionMetadata[];
  allowedChartTypes: ChartType[];
  allowedMetrics: Metric[];
  allowedBreakBys: BreakById[];
}

export interface DimensionMetadata {
  id: DimensionId;
  label: string;
  role: DimensionRole;
  sourceColumn: string;
  defaultForBreakBy?: boolean;
  values: QuestionOptionMetadata[];
}

export interface MetricMetadata {
  id: Metric;
  label: string;
  valueFormat: "percent" | "number";
  description: string;
}

export interface WeightMetadata {
  id: WeightId;
  label: string;
  sourceColumn: string;
  default: boolean;
  description: string;
}

export interface ChartTypeMetadata {
  id: ChartType;
  label: string;
  description: string;
  supportedMetrics: Metric[];
  minSeries?: number;
  maxSeries?: number;
}

export interface DatasetMetadata {
  id: DatasetId;
  label: string;
  wave: string;
  description: string;
  defaultQuestion: QuestionId;
  defaultBreakBy: BreakById;
  defaultWeight: WeightId | null;
  minBaseWarning: number;
  questions: QuestionMetadata[];
  dimensions: DimensionMetadata[];
  metrics: MetricMetadata[];
  weights: WeightMetadata[];
  chartTypes: ChartTypeMetadata[];
}

export const ecofocus2025Metadata: DatasetMetadata = {
  id: "ecofocus_2025",
  label: "EcoFocus 2025",
  wave: "2025",
  description: "Mock survey metadata for the EcoFocus Explore internal MVP.",
  defaultQuestion: "Q15_TOP2_BRAND_PRIORITIES",
  defaultBreakBy: "SUMMARY",
  defaultWeight: "weightvar",
  minBaseWarning: 100,
  metrics: [
    {
      id: "column_percent",
      label: "Column %",
      valueFormat: "percent",
      description: "Percent of respondents within each banner column."
    },
    {
      id: "percent_selected",
      label: "% selected",
      valueFormat: "percent",
      description: "Percent selecting each item in a multi-response variable set."
    },
    {
      id: "count",
      label: "Count",
      valueFormat: "number",
      description: "Estimated respondent count for each answer and banner column."
    }
  ],
  chartTypes: [
    {
      id: "grouped_bar",
      label: "Grouped bar",
      description: "Compare answer distributions across banner groups.",
      supportedMetrics: ["column_percent", "percent_selected", "count"],
      minSeries: 2
    },
    {
      id: "vertical_bar",
      label: "Vertical bar",
      description: "Show a single summary column as a vertical bar chart.",
      supportedMetrics: ["percent_selected", "column_percent", "count"]
    },
    {
      id: "horizontal_bar",
      label: "Horizontal bar",
      description: "Show a single summary column as a horizontal bar chart with long labels.",
      supportedMetrics: ["percent_selected", "column_percent", "count"]
    },
    {
      id: "stacked_bar",
      label: "Stacked bar",
      description: "Stack banner columns within each answer category.",
      supportedMetrics: ["column_percent", "percent_selected", "count"],
      minSeries: 2
    },
    {
      id: "line_chart",
      label: "Line chart",
      description: "Compare banner groups across ordered answer categories.",
      supportedMetrics: ["column_percent", "percent_selected", "count"],
      minSeries: 2
    },
    {
      id: "donut",
      label: "Donut",
      description: "Show a single summary column as a proportional donut chart.",
      supportedMetrics: ["percent_selected", "column_percent", "count"]
    },
    {
      id: "table",
      label: "Table",
      description: "Show crosstab values and bases.",
      supportedMetrics: ["column_percent", "percent_selected", "count"]
    }
  ],
  weights: [
    {
      id: "weightvar",
      label: "EcoFocus respondent weight",
      sourceColumn: "weightvar",
      default: true,
      description: "Respondent-level weight used to align the survey sample to the target population."
    }
  ],
  questions: [
    {
      id: "Q15_TOP2_BRAND_PRIORITIES",
      label: "Consumer Priorities When Choosing Brands and Retailers (Top 2)",
      shortLabel: "Brand and retailer priorities",
      topic: "Brand Sustainability Perceptions",
      type: "multi_binary_set",
      sourceColumn: "Q15_TOP2",
      sourceVariables: ["Q15r1", "Q15r2", "Q15r7", "Q15r8", "Q15r9"],
      universe: "Total respondents",
      defaultMetric: "percent_selected",
      allowedChartTypes: ["vertical_bar", "horizontal_bar", "donut", "table"],
      allowedMetrics: ["percent_selected", "count"],
      allowedBreakBys: ["SUMMARY"],
      options: [
        { id: "Q15r1", label: "To buy brands that support schools and children's education", sortOrder: 1 },
        { id: "Q15r2", label: "To buy products that give some of their profits to charity", sortOrder: 2 },
        { id: "Q15r7", label: "To change the brands you buy to make a more eco-friendly choice", sortOrder: 3 },
        { id: "Q15r8", label: "To shop at retail stores that require that the products and brands sold in their store are eco-friendly", sortOrder: 4 },
        { id: "Q15r9", label: "That retailers offer products that are responsibly sourced", sortOrder: 5 }
      ]
    },
    {
      id: "Q_PACKAGING_TRUST",
      label: "How much do you trust sustainability claims on food and beverage packaging?",
      shortLabel: "Packaging claim trust",
      topic: "Packaging",
      type: "single_select",
      sourceColumn: "q_packaging_trust",
      universe: "Total respondents",
      defaultMetric: "column_percent",
      allowedChartTypes: ["grouped_bar", "stacked_bar", "line_chart", "table"],
      allowedMetrics: ["column_percent", "count"],
      allowedBreakBys: ["GENERATION", "REGION"],
      options: [
        { id: "trust_a_lot", label: "Trust a lot", sortOrder: 1 },
        { id: "trust_somewhat", label: "Trust somewhat", sortOrder: 2 },
        { id: "neutral", label: "Neither trust nor distrust", sortOrder: 3 },
        { id: "distrust", label: "Distrust", sortOrder: 4 }
      ]
    },
    {
      id: "Q_SUSTAINABILITY_IMPORTANCE",
      label: "How important is sustainability when choosing food and beverage products?",
      shortLabel: "Sustainability importance",
      topic: "Sustainability",
      type: "single_select",
      sourceColumn: "q_sustainability_importance",
      universe: "Total respondents",
      defaultMetric: "column_percent",
      allowedChartTypes: ["grouped_bar", "stacked_bar", "line_chart", "table"],
      allowedMetrics: ["column_percent", "count"],
      allowedBreakBys: ["GENERATION", "REGION"],
      options: [
        { id: "very_important", label: "Very important", sortOrder: 1 },
        { id: "somewhat_important", label: "Somewhat important", sortOrder: 2 },
        { id: "not_very_important", label: "Not very important", sortOrder: 3 },
        { id: "not_at_all_important", label: "Not at all important", sortOrder: 4 }
      ]
    }
  ],
  dimensions: [
    {
      id: "SUMMARY",
      label: "Summary",
      role: "banner",
      sourceColumn: "__summary",
      values: [{ id: "summary", label: "Summary", sortOrder: 1 }]
    },
    {
      id: "GENERATION",
      label: "Generation",
      role: "banner",
      sourceColumn: "generation",
      defaultForBreakBy: true,
      values: [
        { id: "gen_z", label: "Gen Z", sortOrder: 1 },
        { id: "millennial", label: "Millennial", sortOrder: 2 },
        { id: "gen_x", label: "Gen X", sortOrder: 3 },
        { id: "boomer_plus", label: "Boomer+", sortOrder: 4 }
      ]
    },
    {
      id: "REGION",
      label: "Region",
      role: "banner",
      sourceColumn: "region",
      values: [
        { id: "northeast", label: "Northeast", sortOrder: 1 },
        { id: "midwest", label: "Midwest", sortOrder: 2 },
        { id: "south", label: "South", sortOrder: 3 },
        { id: "west", label: "West", sortOrder: 4 }
      ]
    },
    {
      id: "SHOPPER_SEGMENT",
      label: "Shopper segment",
      role: "filter",
      sourceColumn: "shopper_segment",
      values: [
        { id: "eco_engaged", label: "Eco engaged", sortOrder: 1 },
        { id: "eco_pragmatic", label: "Eco pragmatic", sortOrder: 2 },
        { id: "price_first", label: "Price first", sortOrder: 3 }
      ]
    }
  ]
};

export const datasets = [ecofocus2025Metadata];

export function getDatasetMetadata(datasetId: DatasetId) {
  return datasets.find((dataset) => dataset.id === datasetId);
}

export function getQuestionMetadata(datasetId: DatasetId, questionId: QuestionId) {
  return getDatasetMetadata(datasetId)?.questions.find((question) => question.id === questionId);
}

export function getDimensionMetadata(datasetId: DatasetId, dimensionId: DimensionId) {
  return getDatasetMetadata(datasetId)?.dimensions.find((dimension) => dimension.id === dimensionId);
}

export function getMetricMetadata(datasetId: DatasetId, metricId: Metric) {
  return getDatasetMetadata(datasetId)?.metrics.find((metric) => metric.id === metricId);
}

export function getChartTypeMetadata(datasetId: DatasetId, chartTypeId: ChartType) {
  return getDatasetMetadata(datasetId)?.chartTypes.find((chartType) => chartType.id === chartTypeId);
}

export function getWeightMetadata(datasetId: DatasetId, weightId: WeightId | null) {
  if (!weightId) {
    return undefined;
  }

  return getDatasetMetadata(datasetId)?.weights.find((weight) => weight.id === weightId);
}

export function getBannerDimensions(datasetId: DatasetId) {
  return getDatasetMetadata(datasetId)?.dimensions.filter((dimension) => dimension.role === "banner") ?? [];
}

export function getFilterDimensions(datasetId: DatasetId): Array<DimensionMetadata & { id: FilterFieldId }> {
  return (getDatasetMetadata(datasetId)?.dimensions.filter((dimension) => dimension.role === "filter") ?? []) as Array<
    DimensionMetadata & { id: FilterFieldId }
  >;
}
