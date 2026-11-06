import { audienceDefinitionIssue } from "../audiences/audienceModel";
import { formulaCacheIssue, formulaSourceIssue } from "../metrics/cellFormulaModel";
import { narrativeState } from "../narratives/narrativeEvidence";
import { canvasWidth,canvasHeight } from "../builder/builderConstants";
import { resultWeightingLabel } from "../../../shared/analytics/weightingLabel";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import type { DashboardPage, DashboardTile } from "../../../shared/types/dashboard";
import { getDimensionMetadata, getQuestionMetadata } from "../../../shared/metadata/ecofocus2025";
import { resultInferenceLabel } from "../../../shared/analytics/inferenceSafety";
import { buildImportedResultProvenance } from "../data/importedDatasetAnalytics";
import { resultBannerLabel, resultDatasetLabel, resultFilterLabel, resultSourceLabel, sampleSizeLabel } from "../builder/components/CanvasRenderers";

export function assertExportResultsCurrent(pages: DashboardPage[], sourcePages: DashboardPage[] = pages): void {
  for(const page of pages)for(const element of page.elements.filter(element=>!element.hidden)){
    const state=narrativeState(element,pages);
    if(state&&!state.current)throw new Error(`Review evidence for "${element.name}" before exporting: ${state.reasons.join(" ")} Include its source pages or restore/review its links. JSON keeps the original text and evidence.`);
    if(element.evidence!==undefined){const {x,y,width,height}=element.layout;if(![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||x+width>canvasWidth||y+height>canvasHeight)throw new Error(`Keep the complete linked text object "${element.name}" inside the page before exporting; its claim and citations must not be clipped.`);}
  }
  for (const page of pages) for (const tile of page.tiles.filter(tile => !tile.hidden)) {
    const formulaIssue = formulaCacheIssue(tile);
    if (formulaIssue) throw Error(`Review calculated metric "${tile.title || tile.name}" before exporting: ${formulaIssue}`);
    if (tile.derivedOutput?.kind === "cell_formula") {
      const matches = sourcePages.flatMap(sourcePage => sourcePage.tiles).filter(source => source.id === tile.derivedOutput!.sourceTileId);
      const issue = formulaCacheIssue(tile) ?? formulaSourceIssue(tile.derivedOutput, matches.length === 1 ? matches[0] : undefined);
      if (issue) throw Error(`Review calculated metric "${tile.title || tile.name}" before exporting: ${issue}`);
    }
    if(tile.result.query.sourceIdentity?.kind==="imported"&&tile.result.query.sourceIdentity.intersectionAudience!==undefined || tile.result.metadataRefs.source?.kind==="imported"&&tile.result.metadataRefs.source.intersectionAudience!==undefined) throw new Error("Temporary linked-view results are not an exportable report analysis. Recreate an ordinary analysis with an explicit audience; original report exports are unchanged.");
    const recorded=tile.result.query.sourceIdentity?.kind==="imported"?tile.result.query.sourceIdentity.audience:undefined;
    const metadata=tile.result.metadataRefs.source?.kind==="imported"?tile.result.metadataRefs.source.audience:undefined;
    if(recorded !== undefined && audienceDefinitionIssue(recorded) || metadata !== undefined && audienceDefinitionIssue(metadata) || JSON.stringify(recorded)!==JSON.stringify(metadata))throw new Error(`Refresh "${tile.title||tile.name}" before exporting: its recorded audience context is invalid or inconsistent.`);
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
    ...(tile.derivedOutput?.kind === "cell_formula" && tile.derivedOutput.formula ? [
      ["Formula expression", tile.derivedOutput.formula.expression],
      ["Formula input A", `${tile.derivedOutput.formula.input.a.label}: ${tile.derivedOutput.formula.input.a.value}`],
      ["Formula input B", `${tile.derivedOutput.formula.input.b.label}: ${tile.derivedOutput.formula.input.b.value}`],
      ["Formula source response universe", `n=${tile.derivedOutput.formula.input.base}; not a pooled sample or algebraic denominator`],
    ] as Array<[string, string]> : []),
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
