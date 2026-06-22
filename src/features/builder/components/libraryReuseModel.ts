import type { ChartType } from "../../../../shared/types/analytics";
import type { DashboardTile, SavedAnalyticalTemplate, SavedBanner, SavedFilterSet, SavedVariableSet, SavedWeightProfile } from "../../../../shared/types/dashboard";
import type { QuestionMetadata } from "../../../../shared/metadata/ecofocus2025";
import type { SavedSettingOriginKind } from "../builderTypes";
import type { InsertionContextView } from "./insertionContextModel";
import { buildTileQueryStatus } from "./inspectorTileQueryModel";

export type SavedSettingReuseKind = SavedSettingOriginKind;

export interface SavedSettingApplyFeedback {
  itemId: string;
  label: string;
  message: string;
  statusLabel: string;
  statusDescription: string;
  needsRefresh: boolean;
  handoffLabel: string;
  handoffDescription: string;
}

export interface SavedVariableSetInsertionFeedback {
  itemId: string;
  label: string;
  message: string;
}

export interface SavedAnalyticalTemplateInsertionFeedback {
  itemId: string;
  label: string;
  message: string;
}

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

export function buildSavedVariableSetInsertionFeedback(
  variableSet: SavedVariableSet,
  objectLabel: string,
  insertionContext: InsertionContextView
): SavedVariableSetInsertionFeedback {
  return {
    itemId: variableSet.id,
    label: `Created ${objectLabel}`,
    message: `Added "${variableSet.label}" to "${insertionContext.targetPageLabel}" at ${insertionContext.placementLabel.toLowerCase()} and selected it for inspector editing.`
  };
}

export function analyticalTemplateSummaryChips(template: SavedAnalyticalTemplate) {
  return [
    template.summary.sourceLabel,
    template.summary.bannerLabel,
    template.summary.filterLabel,
    template.summary.weightLabel,
    template.summary.confidenceLabel,
    template.summary.comparisonLabel
  ].filter(Boolean);
}

export function buildSavedAnalyticalTemplateInsertionFeedback(
  template: SavedAnalyticalTemplate,
  insertionContext: InsertionContextView
): SavedAnalyticalTemplateInsertionFeedback {
  return {
    itemId: template.id,
    label: "Created from template",
    message: `Added "${template.label}" to "${insertionContext.targetPageLabel}" at ${insertionContext.placementLabel.toLowerCase()} and selected it for inspector editing.`
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

export function buildSavedSettingApplyFeedback(
  kind: SavedSettingReuseKind,
  itemId: string,
  itemLabel: string,
  updatedTile: DashboardTile
): SavedSettingApplyFeedback {
  const queryStatus = buildTileQueryStatus(updatedTile);
  const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1);

  return {
    itemId,
    label: `${kindLabel} applied`,
    message: `${itemLabel} was applied to the selected tile.`,
    statusLabel: queryStatus.label,
    statusDescription: queryStatus.hasPendingChanges
      ? "Refresh analysis to update the selected object."
      : "The selected object already reflects this setting.",
    needsRefresh: queryStatus.hasPendingChanges,
    handoffLabel: queryStatus.hasPendingChanges ? "Refresh in inspector" : "Review in inspector",
    handoffDescription: queryStatus.hasPendingChanges
      ? "Open the selected tile's analysis controls to refresh the result."
      : "Open the selected tile's analysis controls to keep editing."
  };
}
