import {
  bannerDimensions,
  defaultDataset,
  filterDimensions
} from "../builderConstants";
import type { DashboardTile, SavedBanner, SavedFilterSet, SavedWeightProfile } from "../../../../shared/types/dashboard";
import {
  updateTileBanner,
  updateTileFilterField,
  updateTileFilterValue,
  updateTileWeight
} from "./inspectorTileQueryModel";

export interface SettingProvenanceRow {
  id: "banner" | "filter" | "weight";
  label: string;
  value: string;
  source: string;
  saved: boolean;
}

export interface SettingProvenanceOption {
  id: string;
  label: string;
  description: string;
  summary: string;
}

export interface SettingProvenancePickerView {
  bannerOptions: SettingProvenanceOption[];
  filterOptions: SettingProvenanceOption[];
  weightOptions: SettingProvenanceOption[];
  activeBannerId: string;
  activeFilterId: string;
  activeWeightId: string;
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

function bannerSettingSummary(banner: SavedBanner) {
  return bannerDimensions.find((item) => item.id === banner.breakBy)?.label ?? banner.breakBy;
}

function filterSettingSummary(filter: SavedFilterSet) {
  if (!filter.filterField || filter.filterValue === "all") return "No filter";
  const dimension = filterDimensions.find((item) => item.id === filter.filterField);
  const valueLabel = dimension?.values.find((item) => item.id === filter.filterValue)?.label ?? filter.filterValue;
  return dimension ? `${dimension.label}: ${valueLabel}` : valueLabel;
}

function weightSettingSummary(weight: SavedWeightProfile) {
  if (!weight.weight) return "Unweighted";
  return defaultDataset.weights.find((item) => item.id === weight.weight)?.label ?? weight.weight;
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

export function buildSettingProvenancePickerView(
  tile: DashboardTile,
  savedBanners: SavedBanner[],
  savedFilters: SavedFilterSet[],
  savedWeights: SavedWeightProfile[]
): SettingProvenancePickerView {
  const activeFilter = tile.query.filters[0];
  const activeFilterField = activeFilter?.field ?? null;
  const activeFilterValue = activeFilter?.values[0] ?? "all";
  const bannerOptions = savedBanners
    .filter((item) => item.datasetId === tile.query.dataset)
    .map((item) => ({ id: item.id, label: item.label, description: item.description, summary: bannerSettingSummary(item) }));
  const filterOptions = savedFilters
    .filter((item) => item.datasetId === tile.query.dataset)
    .map((item) => ({ id: item.id, label: item.label, description: item.description, summary: filterSettingSummary(item) }));
  const weightOptions = savedWeights
    .filter((item) => item.datasetId === tile.query.dataset)
    .map((item) => ({ id: item.id, label: item.label, description: item.description, summary: weightSettingSummary(item) }));

  return {
    bannerOptions,
    filterOptions,
    weightOptions,
    activeBannerId: savedBanners.find((item) => item.datasetId === tile.query.dataset && item.breakBy === tile.query.breakBy)?.id ?? "",
    activeFilterId:
      savedFilters.find((item) => item.datasetId === tile.query.dataset && item.filterField === activeFilterField && item.filterValue === activeFilterValue)?.id ?? "",
    activeWeightId: savedWeights.find((item) => item.datasetId === tile.query.dataset && item.weight === (tile.query.weight ?? null))?.id ?? ""
  };
}

export function updatesForSavedBanner(tile: DashboardTile, banner: SavedBanner) {
  return updateTileBanner(tile, banner.breakBy);
}

export function updatesForSavedFilter(tile: DashboardTile, filter: SavedFilterSet) {
  const fieldUpdate = updateTileFilterField(tile, filter.filterField);
  if (!filter.filterField || filter.filterValue === "all") return fieldUpdate;
  return updateTileFilterValue({ ...tile, ...fieldUpdate }, filter.filterField, filter.filterValue);
}

export function updatesForSavedWeight(tile: DashboardTile, weight: SavedWeightProfile) {
  return updateTileWeight(tile, weight.weight);
}
