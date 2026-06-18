import type { ChartType } from "../../../../shared/types/analytics";
import type { DashboardTile, SavedBanner, SavedFilterSet, SavedVariableSet, SavedWeightProfile } from "../../../../shared/types/dashboard";
import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";

export function savedLibraryItemClass(active: boolean, recentlySaved: boolean) {
  return ["explorer-item", active ? "active" : "", recentlySaved ? "recently-saved" : ""].filter(Boolean).join(" ");
}

export function variableSetChartAction(variableSet: SavedVariableSet): { chartType: ChartType; label: string } {
  const chartType = variableSet.chartType === "table" ? "vertical_bar" : variableSet.chartType;
  return {
    chartType,
    label: chartType === "vertical_bar" ? "chart" : chartType.replace(/_/g, " ")
  };
}

export function bannerReuseState(tile: DashboardTile | null, question: QuestionMetadata | null, banner: SavedBanner) {
  if (!tile || !question) return { enabled: false, helper: "Select a tile to apply this banner." };
  if ((tile.query.comparisonMode ?? "none") === "wave") return { enabled: false, helper: "Wave comparisons use Summary as the banner." };
  if (!question.allowedBreakBys.includes(banner.breakBy)) return { enabled: false, helper: "This banner is not compatible with the selected question." };
  return { enabled: true, helper: "Apply this banner to the selected tile." };
}

export function filterReuseState(tile: DashboardTile | null, filter: SavedFilterSet) {
  if (!tile) return { enabled: false, helper: "Select a tile to apply this filter." };
  return {
    enabled: true,
    helper: filter.filterField ? "Apply this filter to the selected tile." : "Apply the saved no-filter state to the selected tile."
  };
}

export function weightReuseState(tile: DashboardTile | null, weight: SavedWeightProfile) {
  if (!tile) return { enabled: false, helper: "Select a tile to apply this weight." };
  return {
    enabled: true,
    helper: weight.weight ? "Apply this weight to the selected tile." : "Apply the saved unweighted state to the selected tile."
  };
}
