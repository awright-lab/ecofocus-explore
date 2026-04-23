import {
  getDatasetMetadata,
  getDimensionMetadata,
  getMetricMetadata,
  getQuestionMetadata,
  getWeightMetadata
} from "../metadata/ecofocus2025";
import type { AnalyticsFilter, AnalyticsQueryRequest } from "../types/analytics";

export interface AnalyticsQueryPlan {
  dataset: {
    id: string;
    label: string;
  };
  rows: {
    id: string;
    type: string;
    sourceColumn: string;
    sourceVariables: string[];
  };
  columns: {
    id: string;
    sourceColumn: string;
  };
  filters: AnalyticsFilter[];
  metric: {
    id: string;
    valueFormat: string;
  };
  weight: {
    id: string | null;
    sourceColumn: string | null;
  };
  statistics: {
    confidenceLevel: number;
  };
}

export function createAnalyticsQueryPlan(query: AnalyticsQueryRequest): AnalyticsQueryPlan {
  const dataset = getDatasetMetadata(query.dataset);
  const question = getQuestionMetadata(query.dataset, query.question);
  const dimension = getDimensionMetadata(query.dataset, query.breakBy);
  const metric = getMetricMetadata(query.dataset, query.metric);
  const weight = getWeightMetadata(query.dataset, query.weight);

  if (!dataset || !question || !dimension || !metric) {
    throw new Error("Cannot create query plan for unsupported metadata.");
  }

  return {
    dataset: {
      id: dataset.id,
      label: dataset.label
    },
    rows: {
      id: question.id,
      type: question.type,
      sourceColumn: question.sourceColumn,
      sourceVariables: question.sourceVariables ?? [question.sourceColumn]
    },
    columns: {
      id: dimension.id,
      sourceColumn: dimension.sourceColumn
    },
    filters: query.filters,
    metric: {
      id: metric.id,
      valueFormat: metric.valueFormat
    },
    weight: {
      id: weight?.id ?? null,
      sourceColumn: weight?.sourceColumn ?? null
    },
    statistics: {
      confidenceLevel: query.confidenceLevel
    }
  };
}
