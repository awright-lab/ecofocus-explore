import type { DashboardTile } from "../../../shared/types/dashboard";
import { canonicalLocalEvidence } from "../../../shared/analytics/localExecutionEvidence";
import { hasValidRecordedCalculations, recordedCalculation } from "../../../shared/analytics/recordedCalculation";
import { buildDotPlotModel } from "./dotPlotModel";
import { wilson95, intervalPercentLabel } from "../significance-review/proportionIntervalModel";

export const dotIntervalMethod = "wilson95_independent_unweighted_v1" as const;
export const dotIntervalExplanation = "Lines show individual 95% Wilson score intervals under the author's declared independent, unweighted respondent model. They are not intervals for differences or simultaneous coverage; overlap does not test significance. Missing responses, nonresponse bias, clustering and survey weights are not accounted for.";
export function dotIntervalCandidate(tile: DashboardTile) {
  const result = tile.result, source = result.query.sourceIdentity;
  if (tile.appearance.dotPlotLayout !== undefined && tile.appearance.dotPlotLayout !== "separate") throw Error("Choose Separate series before showing intervals; intervals are not supported in comparison layouts.");
  const grid = buildDotPlotModel(result); if (grid.status !== "ready") throw Error(grid.reason);
  if (tile.derivedOutput || result.metric.id !== "percent_selected" || result.metric.valueFormat !== "percent" || source?.kind !== "imported" || source.queryKind === "measure" || source.intersectionAudience || result.query.sourceRef?.provider !== "local_file" || result.calculationInputs?.percentageValueMode !== "unrounded_ratio_v1" || !hasValidRecordedCalculations(result))
    throw Error("Intervals require ordinary local unweighted percentages with exact recorded respondent counts. Refresh a supported percentage analysis; no counts are inferred from rounded values.");
  const cells = result.table.map(row => result.columns.map(column => {
    const count = recordedCalculation(result, row, column.id);
    if (!count) throw Error("Exact respondent counts are missing or inconsistent. Refresh the percentage analysis.");
    return { events: count.numerator, base: count.denominator, interval: wilson95(count.numerator, count.denominator) };
  }));
  const {chartType: _chartType, ...query} = result.query;
  const binding = canonicalLocalEvidence({query, columns: result.columns, rows: result.table, counts: cells.map(row => row.map(({events,base}) => ({events,base})))});
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
