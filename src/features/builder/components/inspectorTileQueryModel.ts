import { waveComparisonChartTypes } from "../builderConstants";
import { getChartTypeLabel, getQuestionLabel } from "../../analytics/analyticsDisplay";
import { comparisonSummaryLabel, tileSourceKindLabel } from "./CanvasRenderers";
import type { AnalyticsQueryRequest, BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";

export interface TileQueryStatusView {
  hasPendingChanges: boolean;
  label: string;
  description: string;
  sourceLabel: string;
  questionLabel: string;
  visualizationLabel: string;
  comparisonLabel: string;
}

export interface TileQueryActionState {
  canRefresh: boolean;
  canSaveSettings: boolean;
  refreshLabel: string;
  saveHelperText: string;
  refreshHelperText: string;
}

export function updateTileBanner(tile: DashboardTile, breakBy: BreakById): Partial<DashboardTile> {
  return {
    query: { ...tile.query, breakBy }
  };
}

export function updateTileMetric(tile: DashboardTile, metric: Metric): Partial<DashboardTile> {
  return {
    query: { ...tile.query, metric }
  };
}

export function updateTileComparisonMode(tile: DashboardTile, comparisonMode: ComparisonMode): Partial<DashboardTile> {
  const nextVisualization =
    comparisonMode === "wave" && !waveComparisonChartTypes.includes(tile.visualization)
      ? waveComparisonChartTypes[0]
      : tile.visualization;

  return {
    visualization: nextVisualization,
    query: {
      ...tile.query,
      chartType: nextVisualization,
      comparisonMode,
      breakBy: comparisonMode === "wave" ? "SUMMARY" : tile.query.breakBy,
      comparisonDatasets: comparisonMode === "wave" ? tile.query.comparisonDatasets ?? [] : []
    }
  };
}

export function toggleTileComparisonDataset(tile: DashboardTile, datasetId: DatasetId): Partial<DashboardTile> {
  const activeComparisons = tile.query.comparisonDatasets ?? [];
  const active = activeComparisons.includes(datasetId);

  return {
    query: {
      ...tile.query,
      comparisonMode: "wave",
      breakBy: "SUMMARY",
      comparisonDatasets: active
        ? activeComparisons.filter((item) => item !== datasetId)
        : [...activeComparisons, datasetId]
    }
  };
}

export function updateTileWeight(tile: DashboardTile, weight: WeightId | null): Partial<DashboardTile> {
  return {
    query: { ...tile.query, weight }
  };
}

export function updateTileFilterField(tile: DashboardTile, field: FilterFieldId | null): Partial<DashboardTile> {
  return {
    query: {
      ...tile.query,
      filters: field ? [{ field, values: ["all"] }] : []
    }
  };
}

export function updateTileFilterValue(tile: DashboardTile, field: FilterFieldId, value: string): Partial<DashboardTile> {
  return {
    query: {
      ...tile.query,
      filters: [{ field, values: [value] }]
    }
  };
}

export function tileRefreshQuery(tile: DashboardTile): AnalyticsQueryRequest {
  return {
    ...tile.query,
    breakBy: (tile.query.comparisonMode ?? "none") === "wave" ? "SUMMARY" : tile.query.breakBy,
    chartType: tile.visualization as ChartType,
    filters:
      tile.query.filters[0]?.field && tile.query.filters[0]?.values[0] !== "all"
        ? tile.query.filters
        : []
  };
}

function normalizedQuery(query: AnalyticsQueryRequest) {
  return {
    ...query,
    comparisonMode: query.comparisonMode ?? "none",
    comparisonDatasets: (query.comparisonDatasets ?? []).slice().sort(),
    filters: query.filters
      .filter((filter) => filter.values.length > 0 && filter.values[0] !== "all")
      .map((filter) => ({ ...filter, values: filter.values.slice().sort() }))
  };
}

export function buildTileQueryStatus(tile: DashboardTile): TileQueryStatusView {
  const refreshQuery = tileRefreshQuery(tile);
  const hasPendingChanges = JSON.stringify(normalizedQuery(refreshQuery)) !== JSON.stringify(normalizedQuery(tile.result.query));

  return {
    hasPendingChanges,
    label: hasPendingChanges ? "Refresh needed" : "Results current",
    description: hasPendingChanges
      ? "Source settings have changed. Refresh analysis to update the selected object."
      : "The selected object reflects the current source settings.",
    sourceLabel: `${tileSourceKindLabel(tile.source)}: ${tile.source?.label ?? "Ad hoc query"}`,
    questionLabel: getQuestionLabel(tile.query.question),
    visualizationLabel: getChartTypeLabel(tile.visualization),
    comparisonLabel: comparisonSummaryLabel(tile.query)
  };
}

export function buildTileQueryActionState(status: TileQueryStatusView, isLoading: boolean): TileQueryActionState {
  return {
    canRefresh: !isLoading,
    canSaveSettings: !isLoading && !status.hasPendingChanges,
    refreshLabel: isLoading ? "Refreshing..." : status.hasPendingChanges ? "Refresh analysis" : "Refresh again",
    refreshHelperText: status.hasPendingChanges
      ? "Apply the edited source settings to the selected object."
      : "Results already match these settings; refresh again only if the underlying data changed.",
    saveHelperText: status.hasPendingChanges
      ? "Refresh before saving reusable settings so saved items match the updated result."
      : "Reusable settings can be saved from the current result."
  };
}
