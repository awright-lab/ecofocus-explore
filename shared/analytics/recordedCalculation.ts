import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../types/analytics";
import { percentageValueMode, unroundedPercentage } from "./percentagePrecision";
import { analysisSettingsMatch } from "./queryFreshness";

// Read-only evidence for newly executed, unweighted imported percentages and
// means. Never derive integer counts or totals from rounded/cached values.
function compatibleContext(result: AnalyticsQueryResponse) {
  const inputs = result.calculationInputs, source = result.metadataRefs.source;
  return (inputs?.percentageValueMode === undefined || inputs.percentageValueMode === percentageValueMode && result.metric.id === "percent_selected") && inputs?.version === 1 && inputs.method === "local_unweighted_v1" && source?.kind === "imported" &&
    (result.metric.id === "percent_selected" || result.metric.id === "average" && source.measureBaseScope === "cell") &&
    result.query.metric === result.metric.id && !result.weighting.applied && result.weighting.id === null && result.query.weight === null &&
    !result.query.authoredVariableSet && !result.metadataRefs.authoredVariableSet?.applied &&
    (result.query.comparisonMode ?? "none") === "none" && !(result.query.comparisonDatasets?.length) &&
    analysisSettingsMatch(result.query, inputs.query) && analysisSettingsMatch({ ...result.query, sourceIdentity: source }, inputs.query);
}
function compatibleCell(result: AnalyticsQueryResponse, row: AnalyticsTableRow, columnId: string) {
    const inputs = result.calculationInputs!, column = result.columns.find(item => item.id === columnId);
    if (!column || !Object.hasOwn(inputs.columns, columnId) || inputs.columns[columnId] !== column.label || !Object.hasOwn(inputs.rows, row.optionId)) return null;
    const captured = inputs.rows[row.optionId];
    if (captured.label !== row.label || !Object.hasOwn(captured.cells, columnId)) return null;
    const cell = captured.cells[columnId], { numerator, denominator } = cell;
    if (!Number.isFinite(numerator) || !Number.isSafeInteger(denominator) || denominator < 0 || denominator !== row.bases[columnId]) return null;
    if (result.metric.id === "percent_selected" && (!Number.isSafeInteger(numerator) || numerator < 0 || numerator > denominator)) return null;
    const expected = denominator === 0 ? 0 : result.metric.id === "average" ? numerator / denominator : inputs.percentageValueMode === percentageValueMode ? unroundedPercentage(numerator, denominator) : Math.round(numerator / denominator * 1000) / 10;
    if (!Number.isFinite(row.values[columnId]) || expected !== row.values[columnId] || denominator === 0 && numerator !== 0) return null;
    return { numerator, denominator, hasObservations: denominator > 0, metric: result.metric.id, ...(inputs.percentageValueMode ? { percentageValueMode: inputs.percentageValueMode } : {}) };
}
function consistentPercentageColumn(result: AnalyticsQueryResponse, columnId: string) {
  let denominator: number | undefined, responses = 0;
  for (const row of result.table) {
    const cell = compatibleCell(result, row, columnId);
    if (!cell || denominator !== undefined && denominator !== cell.denominator) return false;
    denominator = cell.denominator; responses += cell.numerator;
    if (!Number.isSafeInteger(responses)) return false;
  }
  return denominator === undefined || responses === denominator;
}
export function recordedCalculation(result: AnalyticsQueryResponse, row: AnalyticsTableRow, columnId: string) {
  try {
    if (!compatibleContext(result) || result.metric.id === "percent_selected" && !consistentPercentageColumn(result, columnId)) return null;
    return compatibleCell(result, row, columnId);
  }
  catch { return null; }
}

// Optional transport metadata must be complete and consistent when present.
// Older responses without it remain supported; unsupported/corrupt metadata is
// rejected before a remote response can replace an existing analysis.
export function hasValidRecordedCalculations(result: AnalyticsQueryResponse) {
  if (result.calculationInputs === undefined) return true;
  try {
    if (!compatibleContext(result)) return false;
    const inputs = result.calculationInputs!;
    return Object.keys(inputs.rows).length === result.table.length && Object.keys(inputs.columns).length === result.columns.length &&
      result.table.every(row => Object.keys(inputs.rows[row.optionId]?.cells ?? {}).length === result.columns.length && result.columns.every(column => compatibleCell(result, row, column.id) !== null)) &&
      (result.metric.id !== "percent_selected" || result.columns.every(column => consistentPercentageColumn(result, column.id)));
  } catch { return false; }
}

// Only the newly declared precision contract adds an output gate. Historical
// caches without a marker retain their existing availability and raw values.
export function percentagePrecisionIssue(result: AnalyticsQueryResponse): string | null {
  return result.calculationInputs?.percentageValueMode !== undefined && !hasValidRecordedCalculations(result)
    ? "Refresh this result: its recorded percentage precision does not match its counts, denominator or values. The saved result was retained."
    : null;
}
