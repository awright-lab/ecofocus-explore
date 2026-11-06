import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import type { ImportedDatasetQueryConfig } from "./importedDatasetAnalytics";
import { hasValidRecordedCalculations } from "../../../shared/analytics/recordedCalculation";

export function queryResponseObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === "string"); }
function invalidResult(): never {
  throw new Error("The imported-data service returned an incomplete or mismatched result. Your existing analysis has been kept. Retry the query before using this result.");
}
function matchesSourceRef(value: unknown, datasetId: string) {
  if (value === undefined) return true;
  return queryResponseObject(value) && value.datasetId === datasetId &&
    ["id","kind","provider","label"].every(key => typeof value[key] === "string") &&
    ["imported_file","workspace_database"].includes(value.kind as string) &&
    ["connectionId","remoteRecordId","objectPath"].every(key => value[key] === undefined || typeof value[key] === "string");
}
function matchesSource(value: unknown, config: ImportedDatasetQueryConfig) {
  if (!queryResponseObject(value) || value.kind !== "imported" || value.datasetId !== config.dataset.id || value.primaryFieldId !== config.field.id) return false;
  const expected: Record<string, unknown> = {
    measureFieldId: config.measureField?.id, bannerFieldId: config.bannerField?.id,
    filterFieldId: config.filter?.field?.id, filterValue: config.filter?.value, groupingScope: config.groupingScope,
  };
  if (Object.entries(expected).some(([key, expectedValue]) => (value[key] ?? null) !== (expectedValue ?? null))) return false;
  const measure = config.metric === "average" || config.metric === "sum";
  if (value.queryKind !== (measure ? "measure" : "categorical") || measure && value.measureBaseScope !== "cell") return false;
  for (const key of ["datasetLabel", "primaryFieldLabel", ...(measure ? ["measureFieldLabel"] : []), ...(config.bannerField ? ["bannerFieldLabel"] : []), ...(config.filter ? ["filterFieldLabel"] : [])]) {
    if (typeof value[key] !== "string") return false;
  }
  return matchesSourceRef(value.sourceRef,config.dataset.id);
}

// Reject inconsistent transport data before it can replace an existing result.
// Do not repair numbers, infer missing cells or borrow a different study.
export function assertImportedQueryResponse(value: unknown, config: ImportedDatasetQueryConfig): asserts value is AnalyticsQueryResponse {
  if (!queryResponseObject(value) || !queryResponseObject(value.query) || !queryResponseObject(value.metric) ||
      !queryResponseObject(value.metadataRefs) || !queryResponseObject(value.weighting) || !queryResponseObject(value.statistics) ||
      !Array.isArray(value.columns) || !Array.isArray(value.table) || !Array.isArray(value.series) ||
      !strings(value.labels) || !strings(value.warnings) || !strings(value.notes) || !Array.isArray(value.annotations)) invalidResult();
  const metric = ["count", "average", "sum"].includes(config.metric) ? config.metric : "percent_selected";
  const percent = metric === "percent_selected";
  if (value.metric.id !== metric || value.metric.valueFormat !== (percent ? "percent" : "number") || typeof value.metric.label !== "string" ||
      value.query.metric !== metric || value.query.chartType !== config.chartType || value.query.weight !== null ||
      value.query.breakBy !== "SUMMARY" || !Array.isArray(value.query.filters) || value.query.filters.length ||
      (value.query.comparisonMode ?? "none") !== "none" || value.query.authoredVariableSet !== undefined ||
      (value.query.comparisonDatasets !== undefined && (!Array.isArray(value.query.comparisonDatasets) || value.query.comparisonDatasets.length)) ||
      !matchesSource(value.query.sourceIdentity,config) || !matchesSource(value.metadataRefs.source,config) ||
      !matchesSourceRef(value.query.sourceRef,config.dataset.id) || value.metadataRefs.authoredVariableSet !== undefined ||
      value.weighting.applied !== false || value.weighting.id !== null || typeof value.weighting.label !== "string") invalidResult();
  for (const key of ["dataset", "question", "breakBy"]) if (typeof value.query[key] !== "string" || value.metadataRefs[key] !== value.query[key]) invalidResult();
  const statistics = value.statistics, significance = statistics.significance, plan = statistics.significanceExecutionPlan;
  if (![0.9,0.95,0.99].includes(statistics.confidenceLevel as number) || statistics.confidenceLevel !== value.query.confidenceLevel ||
      !queryResponseObject(plan) || typeof plan.status !== "string" || plan.candidateMethod !== "none" ||
      typeof plan.queryShapeSupported !== "boolean" || plan.providerCanExecute !== false || plan.executionInputContract !== null ||
      !strings(plan.reasonCodes) || !strings(plan.unmetPrerequisites) || !queryResponseObject(significance) ||
      !queryResponseObject(significance.readiness) || typeof significance.readiness.status !== "string" ||
      typeof significance.readiness.method !== "string" || typeof significance.readiness.comparisonBasis !== "string" || !strings(significance.readiness.reasonCodes) ||
      !strings(significance.reasonCodes) || !Array.isArray(significance.details) || typeof significance.comparisonBasis !== "string" || significance.hasPlaceholders !== false ||
      !["none","unsupported"].includes(significance.status as string) || significance.method !== "none" ||
      statistics.significanceMethod !== "none" || value.annotations.length || significance.details.length ||
      statistics.significanceExecutionInput !== null || statistics.significanceExecutionReport !== null) invalidResult();
  const ids: string[] = [];
  const columnIds = new Set<string>();
  for (const column of value.columns) {
    if (!queryResponseObject(column) || typeof column.id !== "string" || !column.id || typeof column.label !== "string" || columnIds.has(column.id)) invalidResult();
    ids.push(column.id); columnIds.add(column.id);
  }
  const columns = value.columns;
  if (value.labels.length !== columns.length || value.labels.some((label,index) => label !== (columns[index] as Record<string,unknown>).label) || value.series.length !== value.table.length) invalidResult();
  const rowIds = new Set<string>();
  for (let index=0; index<value.table.length; index+=1) {
    const row = value.table[index], series = value.series[index];
    if (!queryResponseObject(row) || typeof row.optionId !== "string" || !row.optionId || rowIds.has(row.optionId) || typeof row.label !== "string" ||
        !queryResponseObject(row.values) || !queryResponseObject(row.bases) || Object.keys(row.values).length !== ids.length || Object.keys(row.bases).length !== ids.length ||
        !queryResponseObject(series) || series.id !== row.optionId || series.label !== row.label || !Array.isArray(series.values) || !Array.isArray(series.bases) ||
        series.values.length !== ids.length || series.bases.length !== ids.length) invalidResult();
    rowIds.add(row.optionId);
    for (let columnIndex=0; columnIndex<ids.length; columnIndex+=1) {
      const id = ids[columnIndex], amount = row.values[id], base = row.bases[id];
      if (!Object.hasOwn(row.values,id) || !Object.hasOwn(row.bases,id) || typeof amount !== "number" || !Number.isFinite(amount) || typeof base !== "number" || !Number.isSafeInteger(base) || base < 0 || base > config.dataset.rowCount ||
          series.values[columnIndex] !== amount || series.bases[columnIndex] !== base ||
          metric === "count" && (!Number.isSafeInteger(amount) || amount < 0 || amount > base) || percent && (amount < 0 || amount > 100) ||
          base === 0 && amount !== 0) invalidResult();
    }
  }
  // These imported queries group each valid source row once; authored/weighted
  // results were excluded above. Categorical bases describe the whole column,
  // while numeric bases count valid measurements per cell. Missing answers and
  // filters can reduce totals, so require an upper bound, never equality to N.
  let representedRows = 0;
  if (metric === "count" || percent) {
    for (const id of ids) {
      const base = (value.table[0] as { bases: Record<string, number> } | undefined)?.bases[id];
      if (base === undefined) continue;
      let responses = 0;
      for (const item of value.table as Array<{ bases: Record<string, number>; values: Record<string, number> }>) {
        if (item.bases[id] !== base) invalidResult();
        if (metric === "count") responses += item.values[id];
      }
      if (metric === "count" && (!Number.isSafeInteger(responses) || responses !== base)) invalidResult();
      representedRows += base;
    }
  } else {
    for (const item of value.table as Array<{ bases: Record<string, number> }>) for (const id of ids) representedRows += item.bases[id];
  }
  if (!Number.isSafeInteger(config.dataset.rowCount) || config.dataset.rowCount < 0 || !Number.isSafeInteger(representedRows) || representedRows > config.dataset.rowCount) invalidResult();
  if (!hasValidRecordedCalculations(value as unknown as AnalyticsQueryResponse)) invalidResult();
}
