import { resultIdentityIssue } from "../../../../shared/analytics/resultIdentities";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";
import { analyticalCell } from "../../../../shared/analytics/resultCells";
import { buildImportedResultProvenance } from "../../data/importedDatasetAnalytics";
function ResultSample({ result, label }: { result: AnalyticsQueryResponse; label: string }) {
  const issue = resultIdentityIssue(result);
  if (issue) return <section aria-label={label}><h5>{label}</h5><p role="alert">{issue}</p></section>;
  const provenance = buildImportedResultProvenance(result), columns = result.columns.slice(0, 3), rows = result.table.slice(0, 6);
  const weighted = result.weighting.applied || Boolean(result.query.weight);
  const baseKind = result.weighting.applied ? "weighted total" : result.query.weight ? "recorded base (weighting unverified)" : "n";
  return <section aria-label={label}><h5>{label}</h5>
    <p>{result.metric.label}</p>
    {provenance && <ul>{provenance.chips.map((chip, index) => <li key={index}>{chip}</li>)}</ul>}
    <div className="analysis-preview-scroll"><table><caption>{label} sample</caption><thead><tr><th scope="col">Answer</th>{columns.map(column => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.optionId}><th scope="row">{row.label}</th>{columns.map(column => {
      const cell = analyticalCell(result, row, column.id), base = row.bases[column.id];
      const validBase = cell.status !== "rerun_required" && Number.isFinite(base) && base >= 0 && (weighted || Number.isSafeInteger(base));
      return <td key={column.id}>{cell.value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { maximumFractionDigits: result.metric.valueFormat === "percent" ? 1 : 4 }).format(cell.value) + (result.metric.valueFormat === "percent" ? "%" : "")}<small>{validBase ? ` (${baseKind}=${base.toLocaleString()})` : " (base unavailable)"}</small></td>;
    })}</tr>)}</tbody></table></div>
    <p>Showing {rows.length} of {result.table.length} answer rows and {columns.length} of {result.columns.length} result columns.</p>
    {result.warnings.length > 0 && <ul aria-label={`${label} data quality notices`}>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
  </section>;
}
export function AnalysisEditPreview({ before, after, onDismiss, id }: { before: AnalyticsQueryResponse; after: AnalyticsQueryResponse; onDismiss: () => void; id?: string }) {
  return <section id={id} className="analysis-result-preview analysis-edit-preview" aria-label="Proposed analysis change preview" data-canvas-keyboard-scope="controls" onKeyDown={event => {
    if (event.key === "Escape" && !event.defaultPrevented && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); onDismiss(); }
  }}>
    <h4>Review the proposed change</h4><p role="status">Preview loaded. The canvas is unchanged.</p><p>These are two separate query results, not a statistical test of their difference. Update imported result runs a fresh query before replacing the current result.</p>
    <ResultSample label="Current result" result={before}/><ResultSample label="Proposed result (not applied)" result={after}/>
    <button type="button" className="secondary" onClick={onDismiss}>Dismiss preview</button>
  </section>;
}
