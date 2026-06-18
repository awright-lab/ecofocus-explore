import {
  bannerDimensions,
  defaultDataset,
  filterDimensions
} from "../builderConstants";
import type { DashboardTile, SavedBanner, SavedFilterSet, SavedWeightProfile } from "../../../../shared/types/dashboard";

export interface SettingProvenanceRow {
  id: "banner" | "filter" | "weight";
  label: string;
  value: string;
  source: string;
  saved: boolean;
}

function bannerLabel(tile: DashboardTile) {
  return bannerDimensions.find((item) => item.id === tile.query.breakBy)?.label ?? tile.query.breakBy;
}

function filterLabel(tile: DashboardTile) {
  const filter = tile.query.filters[0];
  if (!filter?.field || filter.values[0] === "all") return "No filter";

  const dimension = filterDimensions.find((item) => item.id === filter.field);
  const value = filter.values[0];
  const valueLabel = dimension?.values.find((item) => item.id === value)?.label ?? value;
  return dimension ? `${dimension.label}: ${valueLabel}` : valueLabel;
}

function weightLabel(tile: DashboardTile) {
  if (!tile.query.weight) return "Unweighted";
  return defaultDataset.weights.find((item) => item.id === tile.query.weight)?.label ?? tile.query.weight;
}

function savedSource(label: string | undefined) {
  return label ? `Saved: ${label}` : "Current only";
}

export function buildSettingProvenanceRows(
  tile: DashboardTile,
  savedBanners: SavedBanner[],
  savedFilters: SavedFilterSet[],
  savedWeights: SavedWeightProfile[]
): SettingProvenanceRow[] {
  const activeFilter = tile.query.filters[0];
  const activeFilterField = activeFilter?.field ?? null;
  const activeFilterValue = activeFilter?.values[0] ?? "all";
  const savedBanner = savedBanners.find((item) => item.datasetId === tile.query.dataset && item.breakBy === tile.query.breakBy);
  const savedFilter = savedFilters.find(
    (item) => item.datasetId === tile.query.dataset && item.filterField === activeFilterField && item.filterValue === activeFilterValue
  );
  const savedWeight = savedWeights.find((item) => item.datasetId === tile.query.dataset && item.weight === (tile.query.weight ?? null));

  return [
    {
      id: "banner",
      label: "Banner",
      value: bannerLabel(tile),
      source: savedSource(savedBanner?.label),
      saved: Boolean(savedBanner)
    },
    {
      id: "filter",
      label: "Filter",
      value: filterLabel(tile),
      source: savedSource(savedFilter?.label),
      saved: Boolean(savedFilter)
    },
    {
      id: "weight",
      label: "Weight",
      value: weightLabel(tile),
      source: savedSource(savedWeight?.label),
      saved: Boolean(savedWeight)
    }
  ];
}
