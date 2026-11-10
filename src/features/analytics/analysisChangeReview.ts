import type { AnalyticsQueryResponse, AnalyticsTableColumn, AnalyticsTableRow } from "../../../shared/types/analytics";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analyticalBase, analyticalCell } from "../../../shared/analytics/resultCells";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { audienceSummary } from "../audiences/audienceModel";

export function analysisChangeSettings(result: AnalyticsQueryResponse): Record<string, string> {
  const source = result.query.sourceIdentity;
  const imported = source?.kind === "imported" ? source : null;
  return {
    Study: imported?.datasetLabel ?? result.query.dataset,
    "Import event": imported?.datasetImportedAt ?? "Not recorded",
    Grouping: imported?.primaryFieldLabel ?? result.query.question,
    Measure: imported?.measureFieldLabel ?? "Not applicable",
    Breakout: imported?.bannerFieldLabel ?? result.query.breakBy,
    Filter: imported?.filterFieldLabel ? `${imported.filterFieldLabel} is ${imported.filterValue ?? "(missing value)"}` : result.query.filters.map(filter => `${filter.field}: ${filter.values.join(" or ")}`).join(" AND ") || "None",
    Audience: imported?.audience ? `${imported.audience.label}: ${audienceSummary(imported.audience)}` : "All respondents",
    Values: result.metric.label,
    Weight: result.weighting.applied ? result.weighting.label : result.query.weight ? `Requested: ${result.query.weight} (unverified)` : "Unweighted",
    Output: result.query.chartType,
  };
}

type AxisItem = AnalyticsTableColumn | AnalyticsTableRow;
const itemId = (item: AxisItem) => "optionId" in item ? item.optionId : item.id;
function axis(items: AxisItem[]) {
  const map = new Map<string, AxisItem>();
  for (const item of items) {
    const key = item.sourceCategoryKey === undefined ? `id:${itemId(item)}` : `raw:${item.sourceCategoryKey}`;
    if (map.has(key)) return null;
    map.set(key, item);
  }
  return map;
}

export interface ChangeAxisEntry { key: string; label: string; beforeId?: string; afterId?: string }
export interface AnalysisChangeReview {
  issue: string | null;
  rows: ChangeAxisEntry[];
  columns: ChangeAxisEntry[];
  deltaUnavailable: string | null;
  before: Record<string, string>;
  after: Record<string, string>;
  changedSettings: string[];
}

function settingIdentity(result: AnalyticsQueryResponse): Record<string, unknown> {
  const source = result.query.sourceIdentity, imported = source?.kind === "imported" ? source : null;
  return { Study: [result.query.dataset, imported?.datasetId, result.query.sourceRef], "Import event": imported?.datasetImportedAt, Grouping: [imported?.primaryFieldId, imported?.groupingScope, result.query.question], Measure: [imported?.measureFieldId, imported?.queryKind], Breakout: [imported?.bannerFieldId, result.query.breakBy], Filter: [imported?.filterFieldId, imported?.filterValue, result.query.filters], Audience: imported?.audience, Values: [result.metric.id, result.metric.valueFormat], Weight: [result.query.weight, result.weighting.applied, result.weighting.label], Output: result.query.chartType };
}

export function analysisChangeReview(before: AnalyticsQueryResponse, after: AnalyticsQueryResponse): AnalysisChangeReview {
  const leftSettings = settingIdentity(before), rightSettings = settingIdentity(after);
  const model: AnalysisChangeReview = { issue: resultIdentityIssue(before) ?? resultIdentityIssue(after), rows: [], columns: [], deltaUnavailable: null, before: analysisChangeSettings(before), after: analysisChangeSettings(after), changedSettings: Object.keys(leftSettings).filter(key => JSON.stringify(leftSettings[key]) !== JSON.stringify(rightSettings[key])) };
  if (model.issue) return model;
  const a = before.query.sourceIdentity, b = after.query.sourceIdentity;
  const sameGrouping = a?.kind === "imported" && b?.kind === "imported" && a.datasetId === b.datasetId && Boolean(a.datasetImportedAt) && a.datasetImportedAt === b.datasetImportedAt && a.primaryFieldId === b.primaryFieldId && a.groupingScope === b.groupingScope && a.queryKind === b.queryKind && a.bannerFieldId === b.bannerFieldId;
  const hasRawAxes = [before, after].every(result => result.table.every(row => typeof row.sourceCategoryKey === "string") && result.columns.every(column => typeof column.sourceCategoryKey === "string" || result.columns.length === 1 && column.id === "summary" && result.query.sourceIdentity?.kind === "imported" && !result.query.sourceIdentity.bannerFieldId));
  const contextsAgree = [before, after].every(result => result.metadataRefs.source && analysisSettingsMatch({ ...result.query, sourceIdentity: result.metadataRefs.source }, result.query));
  const leftRows = axis(before.table), rightRows = axis(after.table), leftColumns = axis(before.columns), rightColumns = axis(after.columns);
  if (!leftRows || !rightRows || !leftColumns || !rightColumns) {
    model.issue = "Repeated raw category identities prevent a safe cell comparison. The separate result samples remain available.";
    return model;
  }
  // Different grouping dimensions may reuse generated IDs and even identical labels.
  // Present their cells separately; never imply a match across different meanings.
  function merge(left: Map<string, AxisItem>, right: Map<string, AxisItem>): ChangeAxisEntry[] {
    if (!sameGrouping || !contextsAgree || !hasRawAxes) return [...left].map<ChangeAxisEntry>(([key, value]) => ({ key: `before:${key}`, label: `${value.label} (current)`, beforeId: itemId(value) })).concat([...right].map<ChangeAxisEntry>(([key, value]) => ({ key: `after:${key}`, label: `${value.label} (proposed)`, afterId: itemId(value) })));
    return [...new Set([...left.keys(), ...right.keys()])].map(key => ({ key, label: right.get(key)?.label ?? left.get(key)!.label, beforeId: left.has(key) ? itemId(left.get(key)!) : undefined, afterId: right.has(key) ? itemId(right.get(key)!) : undefined }));
  }
  model.rows = merge(leftRows, rightRows); model.columns = merge(leftColumns, rightColumns);
  const supported = [before, after].every(result => !result.query.authoredVariableSet && !result.metadataRefs.authoredVariableSet?.applied && !result.query.weight && !result.weighting.applied && !(result.query.sourceIdentity?.kind === "imported" && result.query.sourceIdentity.intersectionAudience) && result.query.sourceRef?.provider === "local_file" && (!["percent_selected", "average"].includes(result.metric.id) || result.calculationInputs?.method === "local_unweighted_v1" && analysisSettingsMatch(result.calculationInputs.query,result.query)) && result.metric.id === result.query.metric);
  const sameCalculation = a?.kind === "imported" && b?.kind === "imported" && a.measureFieldId === b.measureFieldId && before.metric.id === after.metric.id && before.metric.valueFormat === after.metric.valueFormat;
  if (!sameGrouping || !contextsAgree || !hasRawAxes || !supported || !sameCalculation) model.deltaUnavailable = "Arithmetic differences require matching recorded study/import, grouping, breakout, measure and metric with unweighted, ordinary local results. Inspect the separate values when these differ. This does not validate a weighted method or a live source.";
  if (!model.deltaUnavailable && before.metric.valueFormat === "percent" && before.calculationInputs?.percentageValueMode !== after.calculationInputs?.percentageValueMode) model.deltaUnavailable = "The results use different recorded percentage precision. Inspect the separate values and recorded counts; a precision change alone does not establish a population change.";
  return model;
}

function rowCell(result: AnalyticsQueryResponse, row: AnalyticsTableRow | undefined, columnId?: string) {
  if (!row || !columnId) return { value: null, base: null, status: "Not present in this result" };
  const cell = analyticalCell(result, row, columnId), base = analyticalBase(result, row, columnId);
  const value = base !== null ? cell.value : null;
  return { value, base: cell.status !== "rerun_required" ? base : null, status: value === null ? "Unavailable" : "Available" };
}

export function changeReviewCell(result: AnalyticsQueryResponse, rowId?: string, columnId?: string) {
  if (!rowId || !columnId) return rowCell(result, undefined, columnId);
  return rowCell(result, result.table.find(item => item.optionId === rowId), columnId);
}
/** One linear index for a complete selected column; keeps the existing cell rules. */
export function changeReviewColumn(result: AnalyticsQueryResponse, columnId?: string) {
  return new Map(result.table.map(row => [row.optionId, rowCell(result, row, columnId)]));
}
