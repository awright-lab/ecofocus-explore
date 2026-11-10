import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../types/analytics";

export type AnalyticalCell = { status: "available"; value: number } | { status: "no_observations" | "rerun_required" | "invalid"; value: null };
export function analyticalBase(result: AnalyticsQueryResponse, row: AnalyticsTableRow, columnId: string): number | null {
  const base = row.bases && Object.hasOwn(row.bases,columnId) ? row.bases[columnId] : undefined;
  const weighted = result.weighting.applied || Boolean(result.query.weight);
  return typeof base === "number" && Number.isFinite(base) && base >= 0 && (weighted || Number.isSafeInteger(base)) ? base : null;
}
// Transport values remain numeric for stored-document compatibility. Availability
// follows a valid own recorded denominator, never a guess from a zero value.
// This does not authenticate legacy bases. Raw recovery artifacts stay intact.
export function analyticalCell(result: AnalyticsQueryResponse, row: AnalyticsTableRow, columnId: string): AnalyticalCell {
  const source = result.metadataRefs.source;
  if (["average", "percent_selected", "column_percent"].includes(result.metric.id)) {
    if (source?.kind === "imported" && result.metric.id === "average" && source.measureBaseScope !== "cell") return {status:"rerun_required",value:null};
    const base = analyticalBase(result,row,columnId);
    if (base === null) return {status:"invalid",value:null};
    if (base === 0) return {status:"no_observations",value:null};
  }
  const value = row.values && Object.hasOwn(row.values,columnId) ? row.values[columnId] : undefined;
  return typeof value === "number" && Number.isFinite(value) ? {status:"available",value} : {status:"invalid",value:null};
}
export function analyticalRowValues(result: AnalyticsQueryResponse, row: AnalyticsTableRow): Record<string, number | null> {
  return Object.fromEntries(result.columns.map(column=>[column.id,analyticalCell(result,row,column.id).value]));
}
export function analyticalCellStatuses(result: AnalyticsQueryResponse) {
  return result.table.map(row=>({rowId:row.optionId,cells:Object.fromEntries(result.columns.map(column=>[column.id,analyticalCell(result,row,column.id)]))}));
}
