import { waveComparisonChartTypes } from "../builderConstants";
import type { AnalyticsQueryRequest, BreakById, ChartType, ComparisonMode, DatasetId, FilterFieldId, Metric, WeightId } from "../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../shared/types/dashboard";

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
