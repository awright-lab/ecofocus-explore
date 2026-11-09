import { formatReviewNumber, type ReviewNumberPrecision } from "../../analytics/reviewNumberFormat";
import { useState } from "react";
import { AnalysisChangeDialog } from "./AnalysisChangeExplorer";
import { resultIdentityIssue } from "../../../../shared/analytics/resultIdentities";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";
import { analyticalBase, analyticalCell } from "../../../../shared/analytics/resultCells";
import { buildImportedResultProvenance } from "../../data/importedDatasetAnalytics";
function ResultSample({ result, label, precision }: { result: AnalyticsQueryResponse; label: string; precision: ReviewNumberPrecision }) {
  const issue = resultIdentityIssue(result);
  if (issue) return <section aria-label={label}><h5>{label}</h5><p role="alert">{issue}</p></section>;
  const provenance = buildImportedResultProvenance(result), columns = result.columns.slice(0, 3), rows = result.table.slice(0, 6);
  const baseKind = result.weighting.applied ? "weighted total" : result.query.weight ? "recorded base (weighting unverified)" : "n";
  return <section aria-label={label}><h5>{label}</h5>
    <p>{result.metric.label}</p>
    {provenance && <ul>{provenance.chips.map((chip, index) => <li key={index}>{chip}</li>)}</ul>}
    <div className="analysis-preview-scroll"><table><caption>{label} sample</caption><thead><tr><th scope="col">Answer</th>{columns.map(column => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.optionId}><th scope="row">{row.label}</th>{columns.map(column => {
      const cell = analyticalCell(result, row, column.id), base = analyticalBase(result, row, column.id);
      const validBase = cell.status !== "rerun_required" && base !== null;
      return <td key={column.id}>{formatReviewNumber(cell.value, result.metric.valueFormat, precision)}<small>{validBase ? ` (${baseKind}=${formatReviewNumber(base, "number", "full")})` : " (base unavailable)"}</small></td>;
    })}</tr>)}</tbody></table></div>
    <p>Showing {rows.length} of {result.table.length} answer rows and {columns.length} of {result.columns.length} result columns.</p>
    {result.warnings.length > 0 && <ul aria-label={`${label} data quality notices`}>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
  </section>;
}
export function AnalysisEditPreview({ before, after, onDismiss, id, onDialogUnmount, applyActionLabel = "Update imported result" }: { before: AnalyticsQueryResponse; after: AnalyticsQueryResponse; onDismiss: () => void; id?: string; applyActionLabel?: string; onDialogUnmount?: (ownedFocus:boolean)=>void }) {
  const [expanded, setExpanded] = useState(false);
  const [fullPrecision, setFullPrecision] = useState(false);
  const precision = fullPrecision ? "full" : "compact";
  return <section id={id} className="analysis-result-preview analysis-edit-preview" aria-label="Proposed analysis change preview" data-canvas-keyboard-scope="controls" onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); onDismiss(); }
  }}>
    <h4>Review the proposed change</h4><p role="status">Preview loaded. The canvas is unchanged.</p><p>These are two separate query results, not a statistical test of their difference. {applyActionLabel} runs a fresh query before replacing the current result.</p>
    <button type="button" className="secondary" aria-pressed={fullPrecision} onClick={() => setFullPrecision(value => !value)}>Full numeric precision</button><small>{fullPrecision ? "Full numeric display; stored rounding remains." : "Compact numbers; small nonzero values use scientific notation."}</small>
    <ResultSample label="Current result" result={before} precision={precision}/><ResultSample label="Proposed result (not applied)" result={after} precision={precision}/>
    <button type="button" className="secondary" aria-expanded={expanded} onClick={event => { event.currentTarget.focus(); setExpanded(true); }}>Review settings and all results</button>
    {expanded && <AnalysisChangeDialog before={before} after={after} onClose={() => setExpanded(false)} onAfterUnmount={onDialogUnmount}/>}
    <button type="button" className="secondary" onClick={onDismiss}>Dismiss preview</button>
  </section>;
}
