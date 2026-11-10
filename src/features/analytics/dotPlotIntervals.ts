import type { DashboardTile } from "../../../shared/types/dashboard";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { canonicalLocalEvidence } from "../../../shared/analytics/localExecutionEvidence";
import { hasValidRecordedCalculations, recordedCalculation } from "../../../shared/analytics/recordedCalculation";
import { buildDotPlotModel } from "./dotPlotModel";
import { wilson95, intervalPercentLabel } from "../significance-review/proportionIntervalModel";

export const dotIntervalMethod = "wilson95_independent_unweighted_v1" as const;
export const dotIntervalExplanation = "Lines show individual 95% Wilson score intervals under the author's declared independent, unweighted respondent model. They are not intervals for differences or simultaneous coverage; overlap does not test significance. Missing responses, nonresponse bias, clustering and survey weights are not accounted for. Small valid bases (under 30) require particular caution. Complex-survey inference is unsupported. Connectors compare group estimates only: they do not imply paired respondents, change over time, or a test of the difference.";
export function dotIntervalCandidate(tile: DashboardTile) {
  const result = tile.result, source = result.query.sourceIdentity;
  if(tile.visualization!=='dot_plot')throw Error('This output cannot represent the retained individual intervals. Choose a supported dot-plot layout or explicitly turn intervals off; no declaration was discarded.');
  if(source?.kind!=='imported')throw Error('Intervals require ordinary local unweighted percentages with exact recorded respondent counts.');
  const layout=tile.appearance.dotPlotLayout;
  if (layout!==undefined && !['separate','paired','small_multiples'].includes(layout)) throw Error('Individual intervals cannot be represented safely in this layout. Choose Separate series, Pair two groups or Small multiples, or explicitly turn intervals off; the declaration was retained.');
  if(layout==='paired' && result.columns.length!==2)throw Error('Paired dots with intervals require exactly two recorded groups; no groups were hidden.');
  if(tile.query.weight!==null || result.query.weight!==null || result.weighting.applied || result.weighting.id!==null)throw Error('Weighted or complex-survey intervals are unsupported. Use exact unweighted respondent counts and explicitly review the independent-respondent model.');
  if([tile.query.sourceRef?.provider,result.query.sourceRef?.provider,source.sourceRef?.provider].some(provider=>provider!==undefined&&provider!=='local_file'))throw Error('Remote intervals are unsupported. Use an ordinary complete local-file percentage analysis with exact respondent counts.');
  if(tile.derivedOutput || tile.analysisLifecycle?.role==='derived' || tile.source && tile.source.kind!=='importedField' || result.query.authoredVariableSet || result.metadataRefs.authoredVariableSet?.applied)throw Error('Derived or authored result intervals are unsupported. Use ordinary local respondent percentages, not calculated differences or rounded estimates.');
  if(!analysisSettingsMatch(tile.query,result.query))throw Error('The query changed. Refresh the analysis, then review the independent, unweighted declaration again.');
  if(tile.source?.kind==='importedField' && (tile.source.datasetId!==undefined && tile.source.datasetId!==source.datasetId || tile.source.fieldId!==undefined&&tile.source.fieldId!==source.primaryFieldId || tile.source.sourceRef && (tile.source.sourceRef.provider!=='local_file'||tile.source.sourceRef.datasetId!==source.datasetId)))throw Error('The recorded source changed or is remote. Review the local analysis and independent-respondent declaration again.');
  if (result.metric.id !== "percent_selected" || result.metric.valueFormat !== "percent" || source?.kind !== "imported" || source.queryKind === "measure" || source.intersectionAudience || (source.sourceRef?.provider !== undefined && source.sourceRef.provider!=="local_file") || (result.query.sourceRef?.provider !== "local_file" || result.query.sourceRef.kind !== "imported_file") || result.calculationInputs?.percentageValueMode !== "unrounded_ratio_v1" || !hasValidRecordedCalculations(result))
    throw Error("Intervals require ordinary local unweighted percentages with exact recorded respondent counts. Refresh a supported percentage analysis; no counts are inferred from rounded values.");
  const grid = buildDotPlotModel(result); if (grid.status !== "ready") throw Error(grid.reason);
  const cells = result.table.map(row => result.columns.map(column => {
    const count = recordedCalculation(result, row, column.id);
    if (!count) throw Error("Exact respondent counts are missing or inconsistent. Refresh the percentage analysis.");
    return { events: count.numerator, base: count.denominator, interval: wilson95(count.numerator, count.denominator) };
  }));
  const {chartType: _chartType, ...query} = result.query;
  const binding = canonicalLocalEvidence({query, source:tile.source, localExecution:result.localExecution,
    metric:result.metric, weighting:result.weighting, sourceEvidence:result.metadataRefs.source, calculationInputs:result.calculationInputs,
    series:result.series, columns: result.columns, rows: result.table, counts: cells.map(row => row.map(({events,base}) => ({events,base})))});
  if (binding.length > 131072) throw Error("The interval declaration exceeds the bounded context size. Shorten display metadata or use the reviewed comparison tool.");
  return { binding, cells };
}
export function dotIntervals(tile: DashboardTile) {
  const declaration = tile.appearance.dotPlotIntervals;
  if (declaration === undefined) return null;
  if (!declaration || declaration.method !== dotIntervalMethod || typeof declaration.binding !== "string") throw Error("Review or turn off the unsupported interval declaration; recorded values were retained.");
  const candidate = dotIntervalCandidate(tile);
  if (candidate.binding !== declaration.binding) throw Error("The recorded calculation changed. Turn intervals off and review the independent, unweighted sampling declaration again.");
  return candidate.cells;
}
export function dotIntervalLabel(cell: ReturnType<typeof dotIntervalCandidate>["cells"][number][number]) {
  return cell.interval ? `95% CI ${intervalPercentLabel(cell.interval.lower)} to ${intervalPercentLabel(cell.interval.upper)}` : "CI unavailable: no valid respondents";
}

/** Bounds are fractions on the fixed 0–100% axis; never inferred from displayed text. */
export function dotIntervalSvg(cell: ReturnType<typeof dotIntervalCandidate>["cells"][number][number], y:number, coordinate:(fraction:number)=>number, color:string):string {
  if(!cell.interval)return '';
  const lo=coordinate(cell.interval.lower),hi=coordinate(cell.interval.upper);
  return `<g data-dot-interval="wilson95" data-lower="${cell.interval.lower}" data-upper="${cell.interval.upper}" data-events="${cell.events}" data-valid-base="${cell.base}"><line x1="${lo}" x2="${hi}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="2"/><path d="M${lo} ${y-5}v10M${hi} ${y-5}v10" stroke="${color}" stroke-width="2" fill="none"/></g>`;
}
