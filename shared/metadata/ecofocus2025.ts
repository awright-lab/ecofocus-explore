import type { ChartType, DatasetId, DimensionId, Metric, QuestionId } from "../types/analytics";

export interface QuestionOptionMetadata {
  id: string;
  label: string;
}

export interface QuestionMetadata {
  id: QuestionId;
  label: string;
  shortLabel: string;
  options: QuestionOptionMetadata[];
  allowedChartTypes: ChartType[];
  allowedMetrics: Metric[];
}

export interface DimensionMetadata {
  id: DimensionId;
  label: string;
  values: QuestionOptionMetadata[];
}

export interface DatasetMetadata {
  id: DatasetId;
  label: string;
  wave: string;
  description: string;
  questions: QuestionMetadata[];
  dimensions: DimensionMetadata[];
}

export const ecofocus2025Metadata: DatasetMetadata = {
  id: "ecofocus_2025",
  label: "EcoFocus 2025",
  wave: "2025",
  description: "Mock survey metadata for the EcoFocus Explore internal MVP.",
  questions: [
    {
      id: "Q_PACKAGING_TRUST",
      label: "How much do you trust sustainability claims on food and beverage packaging?",
      shortLabel: "Packaging claim trust",
      allowedChartTypes: ["grouped_bar", "table"],
      allowedMetrics: ["column_percent", "count"],
      options: [
        { id: "trust_a_lot", label: "Trust a lot" },
        { id: "trust_somewhat", label: "Trust somewhat" },
        { id: "neutral", label: "Neither trust nor distrust" },
        { id: "distrust", label: "Distrust" }
      ]
    },
    {
      id: "Q_SUSTAINABILITY_IMPORTANCE",
      label: "How important is sustainability when choosing food and beverage products?",
      shortLabel: "Sustainability importance",
      allowedChartTypes: ["grouped_bar", "table"],
      allowedMetrics: ["column_percent", "count"],
      options: [
        { id: "very_important", label: "Very important" },
        { id: "somewhat_important", label: "Somewhat important" },
        { id: "not_very_important", label: "Not very important" },
        { id: "not_at_all_important", label: "Not at all important" }
      ]
    }
  ],
  dimensions: [
    {
      id: "GENERATION",
      label: "Generation",
      values: [
        { id: "gen_z", label: "Gen Z" },
        { id: "millennial", label: "Millennial" },
        { id: "gen_x", label: "Gen X" },
        { id: "boomer_plus", label: "Boomer+" }
      ]
    },
    {
      id: "REGION",
      label: "Region",
      values: [
        { id: "northeast", label: "Northeast" },
        { id: "midwest", label: "Midwest" },
        { id: "south", label: "South" },
        { id: "west", label: "West" }
      ]
    }
  ]
};

export const datasets = [ecofocus2025Metadata];
