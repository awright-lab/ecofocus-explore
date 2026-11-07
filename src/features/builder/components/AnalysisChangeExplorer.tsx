import { formatReviewNumber, formatReviewChange } from "../../analytics/reviewNumberFormat";
import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";
import { analysisChangeReview, changeReviewCell } from "../../analytics/analysisChangeReview";
import { useModalAccessibility } from "../hooks/useModalAccessibility";

export function AnalysisChangeDialog({ before, after, onClose }: { before: AnalyticsQueryResponse; after: AnalyticsQueryResponse; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null), titleId = useId();
  useModalAccessibility(ref, onClose);
  return createPortal(<div className="analysis-change-backdrop" data-canvas-keyboard-scope="controls"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="analysis-change-dialog">
    <header><div><h2 id={titleId}>Review the analysis change</h2><p>The report stays unchanged. Close this review to return to the query controls.</p></div><button type="button" onClick={onClose}>Close change review</button></header>
    <div className="analysis-change-scroll"><AnalysisChangeExplorer before={before} after={after} /></div>
  </div></div>, document.body);
}

export function AnalysisChangeExplorer({ before, after }: { before: AnalyticsQueryResponse; after: AnalyticsQueryResponse }) {
  const review = useMemo(() => analysisChangeReview(before, after), [before, after]);
  const [search, setSearch] = useState("");
  const [columnKey, setColumnKey] = useState("");
  const [page, setPage] = useState(0);
  const [fullPrecision, setFullPrecision] = useState(false);
  const precision = fullPrecision ? "full" : "compact";
  const rows = review.rows.filter(row => row.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const lastPage = Math.max(0, Math.ceil(rows.length / 25) - 1), currentPage = Math.min(page, lastPage);
  const column = review.columns.find(item => item.key === columnKey) ?? review.columns[0];
  const format = (value: number | null, result: AnalyticsQueryResponse) => formatReviewNumber(value, result.metric.valueFormat, precision);
  return <section aria-label="Complete analysis change review" className="analysis-change-explorer">
    <h5>Settings and complete results</h5>
    <button type="button" className="secondary" aria-pressed={fullPrecision} onClick={() => setFullPrecision(value => !value)}>Full numeric precision</button><small>{fullPrecision ? "Full numeric display; stored rounding remains." : "Compact numbers; small nonzero values use scientific notation."}</small>
    <details><summary>Recorded settings before and after — {review.changedSettings.length} changed</summary><div className="analysis-preview-scroll"><table><caption>Recorded settings before and after</caption><thead><tr><th scope="col">Setting</th><th scope="col">Current</th><th scope="col">Proposed</th></tr></thead><tbody>{Object.keys(review.before).map(key => <tr key={key}><th scope="row">{key}{review.changedSettings.includes(key) || review.before[key] !== review.after[key] ? " (changed)" : ""}</th><td>{review.before[key]}</td><td>{review.after[key]}</td></tr>)}</tbody></table></div><p>Different recorded fields can have identical display labels; the changed marker also checks their identities.</p></details>
    <p role="status">Changed settings: {review.changedSettings.length ? review.changedSettings.join(", ") : "None"}.</p>
    <p>Search all {review.rows.length} answer entries and choose any of {review.columns.length} result columns. Missing categories remain absent; they are never replaced with zero.</p>
    {review.issue ? <p role="alert">{review.issue}</p> : <>
      <label>Search comparison answers<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      <label>Compare result column<select value={column?.key ?? ""} onChange={event => setColumnKey(event.target.value)}>{review.columns.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      {review.deltaUnavailable && <p>{review.deltaUnavailable}</p>}
      <p>Changes below are descriptive arithmetic, not statistical significance, causal effects or matched-person changes. Filtering or changing an audience changes the population and its bases.</p>
      <div className="analysis-preview-scroll"><table><caption>Complete results, selected column: {column?.label ?? "No columns"}</caption><thead><tr><th scope="col">Answer</th><th scope="col">Current value and base</th><th scope="col">Proposed value and base</th><th scope="col">Arithmetic change</th></tr></thead><tbody>{rows.slice(currentPage * 25, (currentPage + 1) * 25).map(row => {
        const a = changeReviewCell(before, row.beforeId, column?.beforeId), b = changeReviewCell(after, row.afterId, column?.afterId);
        const difference = review.deltaUnavailable ? "Not comparable" : formatReviewChange(a.value, b.value, after.metric.valueFormat, precision);
        const baseLabel = (result: AnalyticsQueryResponse) => result.weighting.applied ? "weighted total" : result.query.weight ? "recorded base (weighting unverified)" : "n";
        return <tr key={row.key}><th scope="row">{row.label}</th><td>{a.status === "Not present in this result" ? a.status : format(a.value, before)}<small> ({a.base === null ? "base unavailable" : `${baseLabel(before)}=${formatReviewNumber(a.base, "number", "full")}`})</small></td><td>{b.status === "Not present in this result" ? b.status : format(b.value, after)}<small> ({b.base === null ? "base unavailable" : `${baseLabel(after)}=${formatReviewNumber(b.base, "number", "full")}`})</small></td><td>{difference}</td></tr>;
      })}</tbody></table></div>
      <p role="status">Showing {rows.length ? currentPage * 25 + 1 : 0}–{Math.min((currentPage + 1) * 25, rows.length)} of {rows.length} matching answers.</p>
      <button type="button" className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous answers</button>
      <button type="button" className="secondary" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Next answers</button>
    </>}
  </section>;
}
