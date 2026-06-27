import { buildSignificanceExecutionPlan, buildSignificanceReadiness } from "../analytics/queryPlan";
import { runColumnComparisonSignificanceAdapter, runWaveComparisonSignificanceAdapter } from "../analytics/significanceExecution";
import { applyVariableSetRows } from "../analytics/variableSets";
import { getDatasetMetadata, getMetricMetadata, getWeightMetadata } from "../metadata/ecofocus2025";
import type {
  AnalyticsAnnotation,
  AnalyticsColumnComparisonExecutionInput,
  AnalyticsSignificanceExecutionReport,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  AnalyticsSeries,
  AnalyticsSignificanceReadiness,
  AnalyticsSignificanceResult,
  AnalyticsTableColumn,
  AnalyticsTableRow,
  AnalyticsWaveComparisonExecutionInput,
  ConfidenceLevel,
  DatasetId
} from "../types/analytics";

type MockQuestionData = Record<string, Record<string, { value: number; base: number }>>;

const mockPercentData: Record<DatasetId, Record<string, Record<string, MockQuestionData>>> = {
  ecofocus_2025: {
    Q_PACKAGING_TRUST: {
      SUMMARY: {
        trust_a_lot: { summary: { value: 20, base: 1495 } },
        trust_somewhat: { summary: { value: 42, base: 1495 } },
        neutral: { summary: { value: 22, base: 1495 } },
        distrust: { summary: { value: 16, base: 1495 } }
      },
      GENERATION: {
        trust_a_lot: {
          gen_z: { value: 18, base: 312 },
          millennial: { value: 24, base: 428 },
          gen_x: { value: 19, base: 390 },
          boomer_plus: { value: 14, base: 365 }
        },
        trust_somewhat: {
          gen_z: { value: 44, base: 312 },
          millennial: { value: 46, base: 428 },
          gen_x: { value: 41, base: 390 },
          boomer_plus: { value: 38, base: 365 }
        },
        neutral: {
          gen_z: { value: 23, base: 312 },
          millennial: { value: 18, base: 428 },
          gen_x: { value: 24, base: 390 },
          boomer_plus: { value: 27, base: 365 }
        },
        distrust: {
          gen_z: { value: 15, base: 312 },
          millennial: { value: 12, base: 428 },
          gen_x: { value: 16, base: 390 },
          boomer_plus: { value: 21, base: 365 }
        }
      },
      REGION: {
        trust_a_lot: {
          northeast: { value: 21, base: 302 },
          midwest: { value: 16, base: 348 },
          south: { value: 19, base: 506 },
          west: { value: 23, base: 339 }
        },
        trust_somewhat: {
          northeast: { value: 42, base: 302 },
          midwest: { value: 40, base: 348 },
          south: { value: 43, base: 506 },
          west: { value: 46, base: 339 }
        },
        neutral: {
          northeast: { value: 22, base: 302 },
          midwest: { value: 26, base: 348 },
          south: { value: 23, base: 506 },
          west: { value: 19, base: 339 }
        },
        distrust: {
          northeast: { value: 15, base: 302 },
          midwest: { value: 18, base: 348 },
          south: { value: 15, base: 506 },
          west: { value: 12, base: 339 }
        }
      }
    },
    Q_SUSTAINABILITY_IMPORTANCE: {
      SUMMARY: {
        very_important: { summary: { value: 31, base: 1495 } },
        somewhat_important: { summary: { value: 42, base: 1495 } },
        not_very_important: { summary: { value: 18, base: 1495 } },
        not_at_all_important: { summary: { value: 9, base: 1495 } }
      },
      GENERATION: {
        very_important: {
          gen_z: { value: 31, base: 312 },
          millennial: { value: 35, base: 428 },
          gen_x: { value: 29, base: 390 },
          boomer_plus: { value: 27, base: 365 }
        },
        somewhat_important: {
          gen_z: { value: 43, base: 312 },
          millennial: { value: 41, base: 428 },
          gen_x: { value: 44, base: 390 },
          boomer_plus: { value: 39, base: 365 }
        },
        not_very_important: {
          gen_z: { value: 18, base: 312 },
          millennial: { value: 16, base: 428 },
          gen_x: { value: 19, base: 390 },
          boomer_plus: { value: 22, base: 365 }
        },
        not_at_all_important: {
          gen_z: { value: 8, base: 312 },
          millennial: { value: 8, base: 428 },
          gen_x: { value: 8, base: 390 },
          boomer_plus: { value: 12, base: 365 }
        }
      },
      REGION: {
        very_important: {
          northeast: { value: 33, base: 302 },
          midwest: { value: 27, base: 348 },
          south: { value: 30, base: 506 },
          west: { value: 36, base: 339 }
        },
        somewhat_important: {
          northeast: { value: 42, base: 302 },
          midwest: { value: 43, base: 348 },
          south: { value: 41, base: 506 },
          west: { value: 40, base: 339 }
        },
        not_very_important: {
          northeast: { value: 17, base: 302 },
          midwest: { value: 21, base: 348 },
          south: { value: 20, base: 506 },
          west: { value: 16, base: 339 }
        },
        not_at_all_important: {
          northeast: { value: 8, base: 302 },
          midwest: { value: 9, base: 348 },
          south: { value: 9, base: 506 },
          west: { value: 8, base: 339 }
        }
      }
    }
  },
  ecofocus_2024: {
    Q_PACKAGING_TRUST: {
      SUMMARY: {
        trust_a_lot: { summary: { value: 17, base: 1410 } },
        trust_somewhat: { summary: { value: 39, base: 1410 } },
        neutral: { summary: { value: 25, base: 1410 } },
        distrust: { summary: { value: 19, base: 1410 } }
      }
    },
    Q_SUSTAINABILITY_IMPORTANCE: {
      SUMMARY: {
        very_important: { summary: { value: 27, base: 1410 } },
        somewhat_important: { summary: { value: 41, base: 1410 } },
        not_very_important: { summary: { value: 21, base: 1410 } },
        not_at_all_important: { summary: { value: 11, base: 1410 } }
      }
    }
  },
  ecofocus_2023: {
    Q_PACKAGING_TRUST: {
      SUMMARY: {
        trust_a_lot: { summary: { value: 14, base: 1360 } },
        trust_somewhat: { summary: { value: 37, base: 1360 } },
        neutral: { summary: { value: 27, base: 1360 } },
        distrust: { summary: { value: 22, base: 1360 } }
      }
    },
    Q_SUSTAINABILITY_IMPORTANCE: {
      SUMMARY: {
        very_important: { summary: { value: 24, base: 1360 } },
        somewhat_important: { summary: { value: 39, base: 1360 } },
        not_very_important: { summary: { value: 24, base: 1360 } },
        not_at_all_important: { summary: { value: 13, base: 1360 } }
      }
    }
  }
};

const mockMultiBinarySummaryData: Record<DatasetId, Record<string, { value: number; base: number }>> = {
  ecofocus_2025: {
    Q15r1: { value: 53, base: 3125 },
    Q15r2: { value: 50, base: 3125 },
    Q15r7: { value: 50, base: 3125 },
    Q15r8: { value: 49, base: 3125 },
    Q15r9: { value: 58, base: 3125 }
  },
  ecofocus_2024: {
    Q15r1: { value: 49, base: 3010 },
    Q15r2: { value: 46, base: 3010 },
    Q15r7: { value: 44, base: 3010 },
    Q15r8: { value: 42, base: 3010 },
    Q15r9: { value: 54, base: 3010 }
  },
  ecofocus_2023: {
    Q15r1: { value: 45, base: 2875 },
    Q15r2: { value: 42, base: 2875 },
    Q15r7: { value: 40, base: 2875 },
    Q15r8: { value: 38, base: 2875 },
    Q15r9: { value: 50, base: 2875 }
  }
};

const mockAnnotations: Record<string, AnalyticsAnnotation[]> = {
  Q15_TOP2_BRAND_PRIORITIES: [
    { rowId: "Q15r8", columnId: "summary", direction: "down", confidence: 0.95 },
    { rowId: "Q15r9", columnId: "summary", direction: "up", confidence: 0.95 }
  ]
};

const mockSignificanceExecutionCapabilities = {
  columnComparison: true,
  waveComparison: false,
  statisticalEngine: true
};

function placeholderSignificance(annotations: AnalyticsAnnotation[], readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: "placeholder",
    method: "mock_placeholder",
    readiness,
    reasonCodes: ["mock_provider_placeholder"],
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: true,
    details: annotations.map((annotation) => ({
      rowId: annotation.rowId,
      columnId: annotation.columnId,
      direction: annotation.direction,
      confidence: annotation.confidence as ConfidenceLevel,
      status: "placeholder",
      reasonCodes: ["mock_provider_placeholder"]
    }))
  };
}

function eligibleSignificance(readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: "eligible",
    method: readiness.method,
    readiness,
    reasonCodes: readiness.reasonCodes,
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: []
  };
}

function inactiveSignificance(readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: readiness.status === "unsupported" ? "unsupported" : "none",
    method: "none",
    readiness,
    reasonCodes: readiness.reasonCodes,
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: []
  };
}

function significanceFromReadiness(readiness: AnalyticsSignificanceReadiness, annotations: AnalyticsAnnotation[]): AnalyticsSignificanceResult {
  if (annotations.length > 0) {
    return placeholderSignificance(annotations, readiness);
  }

  if (readiness.status === "candidate") {
    return eligibleSignificance(readiness);
  }

  return inactiveSignificance(readiness);
}

function significanceFromExecutionReport(
  readiness: AnalyticsSignificanceReadiness,
  annotations: AnalyticsAnnotation[],
  report: AnalyticsSignificanceExecutionReport | null
): AnalyticsSignificanceResult {
  if (report?.status !== "executed" || report.method !== "column_comparison" || !report.result) {
    return significanceFromReadiness(readiness, annotations);
  }

  const testedDetails = report.result.outcomes
    .filter((outcome) => outcome.status === "tested")
    .map((outcome) => ({
      rowId: outcome.rowId,
      columnId: outcome.columnId,
      direction: outcome.statistics.direction ?? undefined,
      confidence: outcome.statistics.confidence ?? 0.95,
      status: "tested" as const,
      reasonCodes: outcome.reasonCodes
    }));

  return {
    status: "tested",
    method: "column_comparison",
    readiness,
    reasonCodes: [],
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: testedDetails
  };
}

function unsupportedSignificance(readiness: AnalyticsSignificanceReadiness): AnalyticsSignificanceResult {
  return {
    status: "unsupported",
    method: "none",
    readiness,
    reasonCodes: readiness.reasonCodes,
    comparisonBasis: readiness.comparisonBasis,
    hasPlaceholders: false,
    details: []
  };
}

function columnComparisonExecutionInput(
  query: AnalyticsQueryRequest,
  metric: AnalyticsQueryResponse["metric"],
  columns: AnalyticsQueryResponse["columns"],
  table: AnalyticsQueryResponse["table"]
): AnalyticsColumnComparisonExecutionInput | null {
  if ((query.comparisonMode ?? "none") === "wave" || query.breakBy === "SUMMARY" || columns.length <= 1 || table.length === 0) {
    return null;
  }

  return {
    method: "column_comparison",
    confidenceLevel: query.confidenceLevel,
    metric: {
      id: metric.id,
      valueFormat: metric.valueFormat
    },
    comparisonScope: {
      basis: "breakout",
      rowIds: table.map((row) => row.optionId),
      columnIds: columns.map((column) => column.id)
    },
    columns: columns.map((column) => ({
      id: column.id,
      label: column.label
    })),
    rows: table.map((row) => ({
      id: row.optionId,
      label: row.label,
      cells: columns.map((column) => ({
        columnId: column.id,
        value: row.values[column.id] ?? 0,
        base: row.bases[column.id] ?? 0
      }))
    }))
  };
}

function waveComparisonExecutionInput(
  query: AnalyticsQueryRequest,
  metric: AnalyticsQueryResponse["metric"],
  columns: AnalyticsQueryResponse["columns"],
  table: AnalyticsQueryResponse["table"]
): AnalyticsWaveComparisonExecutionInput | null {
  const comparisonDatasets = query.comparisonDatasets ?? [];
  if ((query.comparisonMode ?? "none") !== "wave" || comparisonDatasets.length === 0 || columns.length <= 1 || table.length === 0) {
    return null;
  }

  const waveIds = columns.map((column) => column.id as DatasetId);

  return {
    method: "wave_comparison",
    confidenceLevel: query.confidenceLevel,
    metric: {
      id: metric.id,
      valueFormat: metric.valueFormat
    },
    comparisonScope: {
      basis: "wave",
      rowIds: table.map((row) => row.optionId),
      waveIds,
      primaryDatasetId: query.dataset,
      comparisonDatasetIds: comparisonDatasets
    },
    waves: columns.map((column) => ({
      id: column.id as DatasetId,
      label: column.label
    })),
    rows: table.map((row) => ({
      id: row.optionId,
      label: row.label,
      cells: columns.map((column) => ({
        waveId: column.id as DatasetId,
        value: row.values[column.id] ?? 0,
        base: row.bases[column.id] ?? 0
      }))
    }))
  };
}

export function runMockAnalyticsQuery(query: AnalyticsQueryRequest): AnalyticsQueryResponse {
  const normalizedQuery = {
    ...query,
    confidenceLevel: query.confidenceLevel ?? 0.95,
    comparisonMode: query.comparisonMode ?? "none",
    comparisonDatasets: query.comparisonDatasets ?? []
  };
  const dataset = getDatasetMetadata(query.dataset);
  const question = dataset?.questions.find((item) => item.id === query.question);
  const dimension = dataset?.dimensions.find((item) => item.id === query.breakBy);
  const metric = getMetricMetadata(query.dataset, query.metric);
  const weight = getWeightMetadata(query.dataset, query.weight);

  if (!dataset || !question || !dimension || !metric) {
    throw new Error("Unsupported mock query metadata.");
  }

  if (normalizedQuery.comparisonMode === "wave") {
    return applyAuthoredRowsIfPresent(runMockWaveComparisonQuery(normalizedQuery, question.options, question.type, metric, weight?.label));
  }

  if (question.type === "multi_binary_set") {
    return applyAuthoredRowsIfPresent(runMockMultiBinarySetQuery(normalizedQuery, question.options, metric, weight?.label));
  }

  const questionData = mockPercentData[query.dataset]?.[query.question]?.[query.breakBy];

  if (!questionData) {
    throw new Error("No mock data exists for this query.");
  }

  const columns: AnalyticsTableColumn[] = dimension.values.map((value) => ({ id: value.id, label: value.label }));
  const labels = columns.map((value) => value.label);
  const series: AnalyticsSeries[] = question.options.map((option) => {
    const values = dimension.values.map((dimensionValue) => {
      const cell = questionData[option.id]?.[dimensionValue.id];
      return query.metric === "count" ? Math.round(((cell?.value ?? 0) / 100) * (cell?.base ?? 0)) : (cell?.value ?? 0);
    });

    const bases = dimension.values.map((dimensionValue) => questionData[option.id]?.[dimensionValue.id]?.base ?? 0);

    return {
      id: option.id,
      label: option.label,
      values,
      bases
    };
  });

  const table: AnalyticsTableRow[] = series.map((item) => ({
    optionId: item.id,
    label: item.label,
    values: Object.fromEntries(dimension.values.map((dimensionValue, index) => [dimensionValue.id, item.values[index]])),
    bases: Object.fromEntries(dimension.values.map((dimensionValue, index) => [dimensionValue.id, item.bases[index]])),
    presentation: {
      rowKind: "option",
      emphasis: "detail"
    }
  }));
  const annotations = (mockAnnotations[query.question] ?? []).map((annotation) => ({ ...annotation, confidence: normalizedQuery.confidenceLevel }));
  const significanceReadiness = buildSignificanceReadiness(normalizedQuery);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(significanceReadiness, mockSignificanceExecutionCapabilities);
  const significanceExecutionInput = columnComparisonExecutionInput(normalizedQuery, metric, columns, table);
  const significanceExecutionReport = runColumnComparisonSignificanceAdapter(significanceExecutionInput, significanceExecutionPlan);
  const significance = significanceFromExecutionReport(significanceReadiness, annotations, significanceExecutionReport);

  return applyAuthoredRowsIfPresent({
    query: normalizedQuery,
    labels,
    series,
    columns,
    table,
    metric,
    weighting: {
      applied: Boolean(query.weight),
      id: query.weight,
      label: weight?.label ?? "Unweighted"
    },
    annotations,
    statistics: {
      confidenceLevel: normalizedQuery.confidenceLevel,
      significanceMethod: significance.method,
      significanceExecutionPlan,
      significanceExecutionInput,
      significanceExecutionReport,
      significance
    },
    warnings: collectBaseWarnings(series, dataset.minBaseWarning),
    notes: [
      "Mock data for internal MVP validation.",
      query.weight ? `Weighted data using ${weight?.label ?? query.weight}.` : "Unweighted mock output.",
      `${Math.round(normalizedQuery.confidenceLevel * 100)}% confidence level for significance annotations.`,
      "Filters are accepted by the contract but not applied by the mock provider yet."
    ],
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      comparisonMode: normalizedQuery.comparisonMode,
      comparisonDatasets: normalizedQuery.comparisonDatasets
    }
  });
}

function applyAuthoredRowsIfPresent(response: AnalyticsQueryResponse) {
  return response.query.authoredVariableSet ? applyVariableSetRows(response, response.query.authoredVariableSet) : response;
}

function runMockWaveComparisonQuery(
  query: AnalyticsQueryRequest,
  options: Array<{ id: string; label: string }>,
  questionType: "single_select" | "multi_binary_set",
  metric: AnalyticsQueryResponse["metric"],
  weightLabel?: string
): AnalyticsQueryResponse {
  const datasets = [query.dataset, ...(query.comparisonDatasets ?? [])];
  const columns: AnalyticsTableColumn[] = datasets.map((datasetId) => ({
    id: datasetId,
    label: getDatasetMetadata(datasetId)?.wave ?? datasetId
  }));

  const series: AnalyticsSeries[] = options.map((option) => {
    const values = datasets.map((datasetId) => {
      const cell =
        questionType === "multi_binary_set"
          ? mockMultiBinarySummaryData[datasetId]?.[option.id]
          : mockPercentData[datasetId]?.[query.question]?.SUMMARY?.[option.id]?.summary;
      return query.metric === "count" ? Math.round((((cell?.value ?? 0)) / 100) * (cell?.base ?? 0)) : (cell?.value ?? 0);
    });

    const bases = datasets.map((datasetId) => {
      const cell =
        questionType === "multi_binary_set"
          ? mockMultiBinarySummaryData[datasetId]?.[option.id]
          : mockPercentData[datasetId]?.[query.question]?.SUMMARY?.[option.id]?.summary;
      return cell?.base ?? 0;
    });

    return {
      id: option.id,
      label: option.label,
      values,
      bases
    };
  });

  const table: AnalyticsTableRow[] = series.map((item) => ({
    optionId: item.id,
    label: item.label,
    values: Object.fromEntries(columns.map((column, index) => [column.id, item.values[index]])),
    bases: Object.fromEntries(columns.map((column, index) => [column.id, item.bases[index]])),
    presentation: {
      rowKind: "option",
      emphasis: "detail"
    }
  }));
  const significanceReadiness = buildSignificanceReadiness(query);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(significanceReadiness, mockSignificanceExecutionCapabilities);
  const significanceExecutionInput = waveComparisonExecutionInput(query, metric, columns, table);
  const significanceExecutionReport = runWaveComparisonSignificanceAdapter(significanceExecutionInput, significanceExecutionPlan);
  const significance = significanceFromExecutionReport(significanceReadiness, [], significanceExecutionReport);

  return {
    query,
    labels: columns.map((column) => column.label),
    series,
    columns,
    table,
    metric,
    weighting: {
      applied: Boolean(query.weight),
      id: query.weight,
      label: weightLabel ?? "Unweighted"
    },
    annotations: [],
    statistics: {
      confidenceLevel: query.confidenceLevel,
      significanceMethod: significance.method,
      significanceExecutionPlan,
      significanceExecutionInput,
      significanceExecutionReport,
      significance
    },
    warnings: [],
    notes: [
      "Wave comparison mock output.",
      `${columns.map((column) => column.label).join(" vs ")} trend comparison.`,
      query.weight ? `Weighted data using ${weightLabel ?? query.weight}.` : "Unweighted mock output."
    ],
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      comparisonMode: "wave",
      comparisonDatasets: query.comparisonDatasets ?? []
    }
  };
}

function runMockMultiBinarySetQuery(
  query: AnalyticsQueryRequest,
  options: Array<{ id: string; label: string }>,
  metric: AnalyticsQueryResponse["metric"],
  weightLabel?: string
): AnalyticsQueryResponse {
  const summaryData = mockMultiBinarySummaryData[query.dataset];
  const columns: AnalyticsTableColumn[] = [{ id: "summary", label: "Summary" }];
  const series: AnalyticsSeries[] = options.map((option) => {
    const cell = summaryData?.[option.id] ?? { value: 0, base: 0 };
    const value = query.metric === "count" ? Math.round((cell.value / 100) * cell.base) : cell.value;

    return {
      id: option.id,
      label: option.label,
      values: [value],
      bases: [cell.base]
    };
  });

  const table: AnalyticsTableRow[] = series.map((item) => ({
    optionId: item.id,
    label: item.label,
    values: { summary: item.values[0] },
    bases: { summary: item.bases[0] },
    presentation: {
      rowKind: "option",
      emphasis: "detail"
    }
  }));
  const annotations = (mockAnnotations[query.question] ?? []).map((annotation) => ({ ...annotation, confidence: query.confidenceLevel }));
  const significanceReadiness = buildSignificanceReadiness(query);
  const significanceExecutionPlan = buildSignificanceExecutionPlan(significanceReadiness);
  const significanceExecutionInput = columnComparisonExecutionInput(query, metric, columns, table);
  const significanceExecutionReport = runColumnComparisonSignificanceAdapter(significanceExecutionInput, significanceExecutionPlan);
  const significance = significanceFromReadiness(significanceReadiness, annotations);

  return {
    query,
    labels: columns.map((column) => column.label),
    series,
    columns,
    table,
    metric,
    weighting: {
      applied: Boolean(query.weight),
      id: query.weight,
      label: weightLabel ?? "Unweighted"
    },
    annotations,
    statistics: {
      confidenceLevel: query.confidenceLevel,
      significanceMethod: significance.method,
      significanceExecutionPlan,
      significanceExecutionInput,
      significanceExecutionReport,
      significance
    },
    warnings: collectBaseWarnings(series, getDatasetMetadata(query.dataset)?.minBaseWarning ?? 100),
    notes: [
      "Mock saved variable set built from Q15r1, Q15r2, Q15r7, Q15r8, and Q15r9.",
      query.weight ? `Weighted data using ${weightLabel ?? query.weight}; sample size = ${series[0]?.bases[0] ?? 0}.` : `Unweighted mock output; sample size = ${series[0]?.bases[0] ?? 0}.`,
      `${Math.round(query.confidenceLevel * 100)}% confidence level for significance annotations.`,
      "Arrows are placeholder significance annotations for chart/table rendering."
    ],
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy,
      comparisonMode: query.comparisonMode ?? "none",
      comparisonDatasets: query.comparisonDatasets ?? []
    }
  };
}

function collectBaseWarnings(series: AnalyticsSeries[], minBase: number) {
  const lowBases = series.flatMap((item) => item.bases).filter((base) => base > 0 && base < minBase);

  if (lowBases.length === 0) {
    return [];
  }

  return [`Some cells have a base below ${minBase}; interpret those comparisons cautiously.`];
}
