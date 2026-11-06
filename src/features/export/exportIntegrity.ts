import { resultWeightingLabel } from "../../../shared/analytics/weightingLabel";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import type { DashboardPage, DashboardTile } from "../../../shared/types/dashboard";
import { getDimensionMetadata, getQuestionMetadata } from "../../../shared/metadata/ecofocus2025";
import { resultInferenceLabel } from "../../../shared/analytics/inferenceSafety";
import { buildImportedResultProvenance } from "../data/importedDatasetAnalytics";
import { resultBannerLabel, resultDatasetLabel, resultFilterLabel, resultSourceLabel, sampleSizeLabel } from "../builder/components/CanvasRenderers";

export function assertExportResultsCurrent(pages: DashboardPage[]): void {
  for (const page of pages) for (const tile of page.tiles.filter(tile => !tile.hidden)) {
    const identityIssue = resultIdentityIssue(tile.result);
    if (identityIssue) throw new Error(`Cannot export "${tile.title || tile.name}": ${identityIssue}`);
    if (!analysisSettingsMatch(tile.query, tile.result.query)) {
      throw new Error(`Refresh "${tile.title || tile.name}" before exporting: its edited analysis settings do not match the displayed results.`);
    }
    for (const row of tile.result.table) for (const column of tile.result.columns) {
      if (!Object.hasOwn(row.values, column.id) || !Number.isFinite(row.values[column.id])) {
        throw new Error(`Cannot export "${tile.title || tile.name}": an analytical cell is missing or is not a finite number.`);
      }
    }
  }
}

export function analysisContextRows(tile: DashboardTile): Array<[string, string]> {
  const result = tile.result;
  const imported = buildImportedResultProvenance(result);
  return [
    ["Dataset", resultDatasetLabel(result)],
    ["Question or grouping", resultSourceLabel(result)],
    ["Metric", `${result.metric.label} (${result.metric.id}; ${result.metric.valueFormat})`],
    ["Numeric measure", imported?.measureLabel ?? "Not applicable"],
    ["Breakout", imported?.bannerLabel ?? resultBannerLabel(result)],
    ["Filter", imported?.filterLabel ?? (result.query.filters.length ? result.query.filters.map(filter => {
      const metadata = getDimensionMetadata(result.query.dataset, filter.field as Parameters<typeof getDimensionMetadata>[1]) ?? getQuestionMetadata(result.query.dataset, filter.field as Parameters<typeof getQuestionMetadata>[1]);
      return `${metadata?.label ?? filter.field}: ${filter.values.map(value => metadata && "values" in metadata ? metadata.values.find(item => item.id === value)?.label ?? value : metadata && "options" in metadata ? metadata.options.find(item => item.id === value)?.label ?? value : value).join(" or ")}`;
    }).join(" and ") : "No filter")],
    ["Weighting", resultWeightingLabel(result)],
    ["Base scope", `${imported?.baseLabel ?? sampleSizeLabel(result)}${result.weighting.applied || result.query.weight ? "; respondent sample size is unavailable" : ""}`],
    ["Column labels (JSON)", JSON.stringify(result.columns.map(column => ({ id: column.id, sourceLabel: column.label, displayLabel: tile.appearance.axisLabelOverrides[column.id] ?? column.label })))],
    ["Inference", resultInferenceLabel(result)],
    ["Result warnings", result.warnings.join("\n")],
    ["Executed query (JSON)", JSON.stringify(result.query)]
  ];
}

export function spreadsheetColumnName(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 16384) throw new Error("Excel supports at most 16,384 columns. Use JSON for this result.");
  let value = index + 1;
  let label = "";
  while (value > 0) { value -= 1; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); }
  return label;
}

export function assertSpreadsheetText(value: string): void {
  if (value.length > 32767) throw new Error("An Excel cell exceeds 32,767 characters. Use JSON to preserve the complete text.");
  if ((value.match(/\n/g)?.length ?? 0) > 253) throw new Error("An Excel cell exceeds 253 line feeds. Use JSON to preserve the complete text.");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/.test(value) ||
      [...value].some(char => { const code = char.codePointAt(0)!; return code >= 0xD800 && code <= 0xDFFF; })) {
    throw new Error("Excel cannot represent an invalid XML character in this text. Use JSON to preserve the original data.");
  }
}
