import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { analysisChangeReview, changeReviewColumn, type ChangeAxisEntry } from "./analysisChangeReview";
type Cell = ReturnType<typeof changeReviewColumn> extends Map<string, infer T> ? T : never;
export interface ChangeSummaryEntry { row: ChangeAxisEntry; before: Cell; after: Cell; difference: number | null; identical: boolean; index: number }
const absent = (): Cell => ({ value: null, base: null, status: "Not present in this result" });
/** Descriptive, selected-column arithmetic only. Existing comparison gates apply. */
export function analysisChangeSummary(before: AnalyticsQueryResponse, after: AnalyticsQueryResponse, columnKey = "") {
 const review = analysisChangeReview(before, after), column = review.columns.find(c => c.key === columnKey) ?? review.columns[0];
 const counts = { valueChanges: 0, baseChanges: 0, proposedOnly: 0, currentOnly: 0, unavailable: 0, identical: 0 };
 if (review.issue) return { review, column, entries: [] as ChangeSummaryEntry[], counts };
 const left = changeReviewColumn(before, column?.beforeId), right = changeReviewColumn(after, column?.afterId);
 const entries = review.rows.map((row, index): ChangeSummaryEntry => {
  const a = row.beforeId ? left.get(row.beforeId) ?? absent() : absent(), b = row.afterId ? right.get(row.afterId) ?? absent() : absent();
  const aPresent = a.status !== "Not present in this result", bPresent = b.status !== "Not present in this result";
  if (!aPresent && bPresent) counts.proposedOnly++;
  if (aPresent && !bPresent) counts.currentOnly++;
  const compatible = !review.deltaUnavailable && aPresent && bPresent;
  const comparable = compatible && a.value !== null && b.value !== null;
  const raw = comparable ? b.value! - a.value! : NaN, difference = Number.isFinite(raw) ? raw : null;
  const identical = comparable && difference === 0 && a.base === b.base && a.status === b.status;
  if (comparable && a.value !== b.value) counts.valueChanges++;
  if (compatible && a.base !== null && b.base !== null && a.base !== b.base) counts.baseChanges++;
  if (aPresent === bPresent && difference === null) counts.unavailable++;
  if (identical) counts.identical++;
  return { row, before: a, after: b, difference, identical, index };
 });
 return { review, column, entries, counts };
}
export function orderChangeEntries(entries: readonly ChangeSummaryEntry[], largest: boolean) {
 const ordered = [...entries];
 if (largest) ordered.sort((a, b) => {
  if (a.difference === null) return b.difference === null ? a.index - b.index : 1;
  if (b.difference === null) return -1;
  const x = Math.abs(a.difference), y = Math.abs(b.difference);
  return x > y ? -1 : x < y ? 1 : a.index - b.index;
 });
 return ordered;
}
