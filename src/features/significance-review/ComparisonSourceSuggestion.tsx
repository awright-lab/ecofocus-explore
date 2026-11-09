import { useRef, useState } from "react";
import type { ComparisonReviewPlan } from "../../../shared/types/reportInsights";
import { acceptComparisonSourceFields, suggestComparisonSourceFields, type SuggestionContext } from "./comparisonSourceSuggestionModel";
export function ComparisonSourceSuggestion({ draft, studies, hasWork, onStart }: SuggestionContext & { hasWork: boolean; onStart: (plan: ComparisonReviewPlan) => boolean }) {
 const [selected, setSelected] = useState(""), [search, setSearch] = useState(""), [message, setMessage] = useState("");
 const latest = useRef({ draft, studies, hasWork, onStart }); latest.current = { draft, studies, hasWork, onStart };
 const all = draft.pages.flatMap(page => page.tiles.filter(tile => !tile.hidden).map(tile => ({ key: JSON.stringify([page.id, tile.id]), label: `${page.title} / ${tile.title || tile.name}` })));
 const query = search.trim().toLocaleLowerCase(), matching = all.filter(item => !query || item.label.toLocaleLowerCase().includes(query)), keys = new Set(matching.slice(0, 100).map(item => item.key)); if (selected) keys.add(selected);
 const options = all.filter(item => keys.has(item.key)), suggestion = selected ? suggestComparisonSourceFields({ draft, studies }, selected) : null;
 function apply() {
  if (latest.current.hasWork) { setMessage("Your current working plan was retained. Source suggestions only start an empty review; continue editing or close and start a new review."); return; }
  if (!suggestion?.available) { setMessage("Choose an available source-field suggestion first."); return; }
  try { const plan = acceptComparisonSourceFields(suggestion, latest.current); if (!latest.current.onStart(plan)) { setMessage("Your current working plan was retained. Source suggestions cannot replace pending edits."); return; } setMessage("Current source fields added to an unreviewed plan. Choose the respondent ID, event codes, comparison family and sampling assumptions before running."); }
  catch (error) { setMessage(error instanceof Error ? error.message : "The source changed. Review its current fields before starting."); }
 }
 return <details className="comparison-source-suggestion"><summary>Start from fields used in a report analysis</summary>
  <p>Optional shortcut for unfiltered, unweighted original local response analyses. It suggests current field roles, not a replay of recorded numeric results. Identifying these fields does not run a statistical analysis. Applying them loads the comparison editor's existing source checks and code choices.</p>
  <label>Find a report analysis<input type="search" value={search} onChange={e => setSearch(e.target.value)}/></label>
  <label>Report analysis<select value={selected} onChange={e => { setSelected(e.target.value); setMessage(""); }}><option value="">Choose a report analysis</option>{selected && !all.some(item => item.key === selected) && <option value={selected}>Analysis unavailable</option>}{options.map((item, index) => <option key={index} value={item.key}>{item.label}</option>)}</select></label>
  <small>First 100 matching analyses; the selected entry stays visible. Manual study and field selection below remains available.</small>
  {suggestion && (suggestion.available ? <dl><dt>Current study</dt><dd>{suggestion.sourceTitle}</dd><dt>Outcome field</dt><dd>{suggestion.outcome.label} — <code>{suggestion.outcome.column}</code></dd><dt>Group field</dt><dd>{suggestion.group ? <>{suggestion.group.label} — <code>{suggestion.group.column}</code></> : "Choose a grouping field below"}</dd></dl> : <p role="alert">{suggestion.issue}</p>)}
  <p>These current source columns still need your review. IDs, research question, event/reference codes and sampling design are deliberately left for you.</p>
  <button type="button" aria-disabled={hasWork || !suggestion?.available} onClick={apply}>Use source-field suggestions</button>
  {hasWork && <p>A working plan is already open. Suggestions will not replace it.</p>}{message && <p role="status">{message}</p>}
 </details>;
}
