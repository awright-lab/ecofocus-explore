import type { AnalyticsQueryResponse, AnalyticsTableRow } from "../types/analytics";

export type AnalyticalCell = { status: "available"; value: number } | { status: "no_observations" | "rerun_required" | "invalid"; value: null };
// Transport values remain numeric for stored-document compatibility. Availability
// is interpreted from verified per-cell valid-observation bases, never guessed
// from a zero value. Raw recovery artifacts preserve their original contents.
export function analyticalCell(result: AnalyticsQueryResponse, row: AnalyticsTableRow, columnId: string): AnalyticalCell {
  const source = result.metadataRefs.source;
  if (source?.kind === "imported" && result.metric.id === "average") {
    if (source.measureBaseScope !== "cell") return {status:"rerun_required",value:null};
    if (row.bases[columnId] === 0) return {status:"no_observations",value:null};
    if (!Number.isFinite(row.bases[columnId]) || row.bases[columnId] < 0) return {status:"invalid",value:null};
  }
  const value = row.values[columnId];
  return typeof value === "number" && Number.isFinite(value) ? {status:"available",value} : {status:"invalid",value:null};
}
export function analyticalRowValues(result: AnalyticsQueryResponse, row: AnalyticsTableRow): Record<string, number | null> {
  return Object.fromEntries(result.columns.map(column=>[column.id,analyticalCell(result,row,column.id).value]));
}
export function analyticalCellStatuses(result: AnalyticsQueryResponse) {
  return result.table.map(row=>({rowId:row.optionId,cells:Object.fromEntries(result.columns.map(column=>[column.id,analyticalCell(result,row,column.id)]))}));
}
