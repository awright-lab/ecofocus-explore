import { ecofocus2025Metadata, getMetricMetadata } from "../metadata/ecofocus2025";
import type {
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  AnalyticsSeries,
  AnalyticsTableRow
} from "../types/analytics";

type MockQuestionData = Record<string, Record<string, { value: number; base: number }>>;

const mockPercentData: Record<string, Record<string, MockQuestionData>> = {
  Q_PACKAGING_TRUST: {
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
};

export function runMockAnalyticsQuery(query: AnalyticsQueryRequest): AnalyticsQueryResponse {
  const question = ecofocus2025Metadata.questions.find((item) => item.id === query.question);
  const dimension = ecofocus2025Metadata.dimensions.find((item) => item.id === query.breakBy);
  const metric = getMetricMetadata(query.dataset, query.metric);

  if (!question || !dimension || !metric) {
    throw new Error("Unsupported mock query metadata.");
  }

  const questionData = mockPercentData[query.question]?.[query.breakBy];

  if (!questionData) {
    throw new Error("No mock data exists for this query.");
  }

  const labels = dimension.values.map((value) => value.label);
  const series: AnalyticsSeries[] = question.options.map((option) => {
    const values = dimension.values.map((dimensionValue) => {
      const cell = questionData[option.id]?.[dimensionValue.id];
      return query.metric === "count" ? Math.round((cell.value / 100) * cell.base) : cell.value;
    });

    const bases = dimension.values.map((dimensionValue) => {
      return questionData[option.id]?.[dimensionValue.id]?.base ?? 0;
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
    values: Object.fromEntries(dimension.values.map((dimensionValue, index) => [dimensionValue.id, item.values[index]])),
    bases: Object.fromEntries(dimension.values.map((dimensionValue, index) => [dimensionValue.id, item.bases[index]]))
  }));

  return {
    query,
    labels,
    series,
    table,
    metric,
    warnings: collectBaseWarnings(series, ecofocus2025Metadata.minBaseWarning),
    notes: [
      "Mock data for internal MVP validation.",
      "Filters are accepted by the contract but not applied by the mock provider yet."
    ],
    metadataRefs: {
      dataset: query.dataset,
      question: query.question,
      breakBy: query.breakBy
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
