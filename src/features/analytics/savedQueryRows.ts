import {applyVariableSetRows} from "../../../shared/analytics/variableSets";
import {defaultDataset} from "../builder/builderConstants";
import {defaultVariableSetRows} from "../document/documentSeeds";
import type {runAnalyticsQuery} from "../../lib/api";
import type {AnalyticsQueryRequest,FilterFieldId} from "../../../shared/types/analytics";
import type {DashboardTile,SavedVariableSet} from "../../../shared/types/dashboard";

function fallbackVariableSet(source: NonNullable<DashboardTile["source"]>, query: AnalyticsQueryRequest): SavedVariableSet {
  return {
    id: source.id,
    datasetId: defaultDataset.id,
    label: source.label,
    description: "",
    topic: source.label,
    questionIds: [query.question],
    primaryQuestionId: query.question,
    rowMode: "authored",
    rows: defaultVariableSetRows(query.question),
    breakBy: query.breakBy,
    metric: query.metric,
    chartType: query.chartType,
    weight: query.weight,
    filterField: (query.filters[0]?.field as FilterFieldId | undefined) ?? null,
    filterValue: query.filters[0]?.values[0] ?? "all"
  };
}

export function resolveVariableSetResult(
  response: Awaited<ReturnType<typeof runAnalyticsQuery>>,
  query: AnalyticsQueryRequest,
  source: DashboardTile["source"] | undefined,
  savedVariableSets: SavedVariableSet[]
) {
  if (response.metadataRefs.authoredVariableSet?.applied) {
    return response;
  }

  return source?.kind === "variableSet"
    ? applyVariableSetRows(response, savedVariableSets.find((item) => item.id === source.id) ?? fallbackVariableSet(source, query))
    : response;
}
