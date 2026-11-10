import { formatReviewNumber, formatReviewChange } from "../../analytics/reviewNumberFormat";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";
import { analysisChangeSummary, orderChangeEntries } from "../../analytics/analysisChangeSummary";
import { useModalAccessibility } from "../hooks/useModalAccessibility";

export function AnalysisChangeDialog({ before, after, onClose, onAfterUnmount }: { before: AnalyticsQueryResponse; after: AnalyticsQueryResponse; onClose: () => void; onAfterUnmount?: (ownedFocus:boolean)=>void }) {
  const ref = useRef<HTMLDivElement>(null), titleId = useId();
  const ownedBeforeDetach=useRef<boolean|undefined>(undefined),afterUnmount=useRef(onAfterUnmount);afterUnmount.current=onAfterUnmount;
  const bindRef=useCallback((node:HTMLDivElement|null)=>{ownedBeforeDetach.current=node?undefined:!!ref.current?.contains(document.activeElement);ref.current=node;},[]);
  useModalAccessibility(ref, onClose,()=>ownedBeforeDetach.current??!!ref.current?.contains(document.activeElement));
  // Runs after the modal hook restores inert/scroll state. A disappeared parent
  // preview can then return focus to its still-connected controls.
  useEffect(()=>()=>{afterUnmount.current?.(ownedBeforeDetach.current??false);},[]);
  return createPortal(<div className="analysis-change-backdrop" data-canvas-keyboard-scope="controls"><div ref={bindRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="analysis-change-dialog">
    <header><div><h2 id={titleId}>Review the analysis change</h2><p>The report stays unchanged. Close this review to return to the query controls.</p></div><button type="button" onClick={onClose}>Close change review</button></header>
    <div className="analysis-change-scroll"><AnalysisChangeExplorer before={before} after={after} /></div>
  </div></div>, document.body);
}

export function AnalysisChangeExplorer({ before, after }: { before: AnalyticsQueryResponse; after: AnalyticsQueryResponse }) {
  const [search, setSearch] = useState("");
  const [columnKey, setColumnKey] = useState("");
  const [page, setPage] = useState(0);
  const [hideIdentical, setHideIdentical] = useState(false);
  const [preferredOrder, setPreferredOrder] = useState("source");
  const view = analysisChangeSummary(before, after, columnKey), { review, column, counts } = view;
  const [fullPrecision, setFullPrecision] = useState(false);
  const precision = fullPrecision ? "full" : "compact";
  const rows = orderChangeEntries(view.entries, preferredOrder === "largest" && !review.deltaUnavailable).filter(entry => (!hideIdentical || !entry.identical) && entry.row.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const lastPage = Math.max(0, Math.ceil(rows.length / 25) - 1), currentPage = Math.min(page, lastPage);
  const format = (value: number | null, result: AnalyticsQueryResponse) => formatReviewNumber(value, result.metric.valueFormat, precision);
  return <section aria-label="Complete analysis change review" data-canvas-keyboard-scope="controls" className="analysis-change-explorer">
    <h5>Settings and complete results</h5>
    <button type="button" className="secondary" aria-pressed={fullPrecision} onClick={() => setFullPrecision(value => !value)}>Full numeric precision</button><small>{fullPrecision ? "Full numeric display; stored rounding remains." : "Compact numbers; small nonzero values use scientific notation."}</small>
    <details><summary>Recorded settings before and after — {review.changedSettings.length} changed</summary><div className="analysis-preview-scroll"><table><caption>Recorded settings before and after</caption><thead><tr><th scope="col">Setting</th><th scope="col">Current</th><th scope="col">Proposed</th></tr></thead><tbody>{Object.keys(review.before).map(key => <tr key={key}><th scope="row">{key}{review.changedSettings.includes(key) || review.before[key] !== review.after[key] ? " (changed)" : ""}</th><td>{review.before[key]}</td><td>{review.after[key]}</td></tr>)}</tbody></table></div><p>Different recorded fields can have identical display labels; the changed marker also checks their identities.</p></details>
    <p role="status">Changed settings: {review.changedSettings.length ? review.changedSettings.join(", ") : "None"}.</p>
    <p>Search all {review.rows.length} answer entries and choose any of {review.columns.length} result columns. Missing categories remain absent; they are never replaced with zero.</p>
    {review.issue && <p role="alert">{review.issue}</p>}
      <label>Search comparison answers<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>
      <label>Compare result column<select value={column?.key ?? ""} onChange={event => { setColumnKey(event.target.value); setPage(0); }}>{!review.columns.length && <option value="">No result columns</option>}{review.columns.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <label>Preferred answer order<select value={preferredOrder} onChange={event => { setPreferredOrder(event.target.value); setPage(0); }}><option value="source">Source order</option><option value="largest">Largest arithmetic change</option></select></label>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8 }}><input type="checkbox" style={{ width: "auto", flex: "0 0 auto", marginTop: 3 }} checked={hideIdentical} onChange={event => { setHideIdentical(event.target.checked); setPage(0); }}/> Hide entries with identical comparable values and bases</label>
      {!review.issue && <p role="status">Across the complete selected column, before search: {counts.valueChanges} changed values; {counts.baseChanges} changed bases; {counts.proposedOnly} entries only proposed; {counts.currentOnly} only current; {counts.unavailable} unavailable or incomparable; {counts.identical} identical comparable entries. These checks can overlap.</p>}
      <p>Unknown or incomparable entries stay visible when identical entries are hidden. Ordering uses stored numeric precision, with tied changes in source order.</p>
      {preferredOrder === "largest" && (review.deltaUnavailable || review.issue) && <p>Arithmetic ranking is unavailable for these results. Source order is shown.</p>}
      {review.deltaUnavailable && <p>{review.deltaUnavailable}</p>}
      <p>Changes below are descriptive arithmetic, not statistical significance, causal effects or matched-person changes. Filtering or changing an audience changes the population and its bases.</p>
      {!review.issue && <div className="analysis-preview-scroll"><table><caption>Complete results, selected column: {column?.label ?? "No columns"}</caption><thead><tr><th scope="col">Answer</th><th scope="col">Current value and base</th><th scope="col">Proposed value and base</th><th scope="col">Arithmetic change</th></tr></thead><tbody>{rows.slice(currentPage * 25, (currentPage + 1) * 25).map(entry => {
        const { row, before: a, after: b } = entry;
        const difference = review.deltaUnavailable ? "Not comparable" : formatReviewChange(a.value, b.value, after.metric.valueFormat, precision);
        const baseLabel = (result: AnalyticsQueryResponse) => result.weighting.applied ? "weighted total" : result.query.weight ? "recorded base (weighting unverified)" : "n";
        return <tr key={row.key}><th scope="row">{row.label}</th><td>{a.status === "Not present in this result" ? a.status : format(a.value, before)}<small> ({a.base === null ? "base unavailable" : `${baseLabel(before)}=${formatReviewNumber(a.base, "number", "full")}`})</small></td><td>{b.status === "Not present in this result" ? b.status : format(b.value, after)}<small> ({b.base === null ? "base unavailable" : `${baseLabel(after)}=${formatReviewNumber(b.base, "number", "full")}`})</small></td><td>{difference}</td></tr>;
      })}</tbody></table></div>}
      <p role="status">Showing {rows.length ? currentPage * 25 + 1 : 0}–{Math.min((currentPage + 1) * 25, rows.length)} of {rows.length} matching answers.</p>
      <button type="button" className="secondary" aria-disabled={currentPage === 0} onClick={() => { if (currentPage > 0) setPage(currentPage - 1); }}>Previous answers</button>
      <button type="button" className="secondary" aria-disabled={currentPage === lastPage} onClick={() => { if (currentPage < lastPage) setPage(currentPage + 1); }}>Next answers</button>
  </section>;
}
