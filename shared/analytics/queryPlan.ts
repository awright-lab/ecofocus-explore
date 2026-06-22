import {
  getDatasetMetadata,
  getDimensionMetadata,
  getMetricMetadata,
  getQuestionMetadata,
  getWeightMetadata
} from "../metadata/ecofocus2025";
import type {
  AnalyticsFilter,
  AnalyticsQueryRequest,
  AnalyticsSignificanceExecutionPlan,
  AnalyticsSignificanceReadiness
} from "../types/analytics";

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
    significanceReadiness: AnalyticsSignificanceReadiness;
    significanceExecutionPlan: AnalyticsSignificanceExecutionPlan;
  };
  comparison: {
    mode: string;
    datasets: string[];
  };
}

export interface SignificanceExecutionCapabilities {
  columnComparison: boolean;
  waveComparison: boolean;
  statisticalEngine: boolean;
}

const defaultSignificanceExecutionCapabilities: SignificanceExecutionCapabilities = {
  columnComparison: false,
  waveComparison: false,
  statisticalEngine: false
};

export function buildSignificanceReadiness(query: AnalyticsQueryRequest): AnalyticsSignificanceReadiness {
  if ((query.comparisonMode ?? "none") === "wave") {
    return {
      status: "unsupported",
      method: "wave_comparison",
      reasonCodes: ["wave_comparison_unsupported", "mock_provider_not_available"],
      comparisonBasis: "wave"
    };
  }

  if (query.breakBy === "SUMMARY") {
    return {
      status: "not_applicable",
      method: "none",
      reasonCodes: ["summary_only", "no_comparison_basis"],
      comparisonBasis: "summary"
    };
  }

  return {
    status: "candidate",
    method: "column_comparison",
    reasonCodes: ["future_method"],
    comparisonBasis: "breakout"
  };
}

export function buildSignificanceExecutionPlan(
  readiness: AnalyticsSignificanceReadiness,
  capabilities: SignificanceExecutionCapabilities = defaultSignificanceExecutionCapabilities
): AnalyticsSignificanceExecutionPlan {
  if (readiness.status === "candidate") {
    const providerSupportsMethod =
      readiness.method === "column_comparison"
        ? capabilities.columnComparison
        : readiness.method === "wave_comparison"
          ? capabilities.waveComparison
          : false;
    const providerCanExecute = providerSupportsMethod && capabilities.statisticalEngine;

    return {
      status: providerCanExecute ? "ready" : "deferred",
      candidateMethod: readiness.method,
      queryShapeSupported: true,
      providerCanExecute,
      executionInputContract: readiness.method === "column_comparison" ? "column_comparison" : null,
      reasonCodes: providerCanExecute ? readiness.reasonCodes : ["mock_provider_not_available", ...readiness.reasonCodes],
      unmetPrerequisites: [
        providerSupportsMethod ? "" : "provider_method",
        capabilities.statisticalEngine ? "" : "statistical_engine"
      ].filter(Boolean) as AnalyticsSignificanceExecutionPlan["unmetPrerequisites"]
    };
  }

  if (readiness.status === "unsupported") {
    return {
      status: "blocked",
      candidateMethod: readiness.method,
      queryShapeSupported: false,
      providerCanExecute: false,
      executionInputContract: null,
      reasonCodes: readiness.reasonCodes,
      unmetPrerequisites: ["wave_support", "provider_method", "statistical_engine"]
    };
  }

  return {
    status: "not_applicable",
    candidateMethod: "none",
    queryShapeSupported: false,
    providerCanExecute: false,
    executionInputContract: null,
    reasonCodes: readiness.reasonCodes,
    unmetPrerequisites: ["comparison_basis"]
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

  const significanceReadiness = buildSignificanceReadiness(query);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(significanceReadiness);

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
      confidenceLevel: query.confidenceLevel,
      significanceReadiness,
      significanceExecutionPlan
    },
    comparison: {
      mode: query.comparisonMode ?? "none",
      datasets: query.comparisonDatasets ?? []
    }
  };
}
