import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardDraft, DashboardTile, SavedDerivedDefinition } from "../../../shared/types/dashboard";
import type { CellFormulaSpec } from "../../../shared/types/calculatedMetric";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { formulaCacheIssue, formulaSourceIssue } from "./cellFormulaModel";
import { commitCellFormula, definitionForFormulaResult, planFromFormula, previewCellFormula, type CellFormulaPlan } from "./cellFormulaCommands";
import "./calculated-metric.css";

type Props = { draft: DashboardDraft; selectedTileId?: string | null; onClose: () => void; onChange: (update: (current: DashboardDraft) => DashboardDraft) => boolean; onNavigate: (pageId: string, tileId: string) => void; onCreateAnalysis: () => void };
function id() { return `formula_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`; }
export default function CalculatedMetricBuilder({ draft, selectedTileId, onClose, onChange, onNavigate, onCreateAnalysis }: Props) {
  const sources = draft.pages.flatMap(page => page.tiles.filter(tile => !tile.derivedOutput).map(tile => ({ page, tile })));
  const initial = sources.find(item => item.tile.id === selectedTileId) ?? sources[0];
  const [initialResult] = useState(() => { const tile = draft.pages.flatMap(page => page.tiles).find(item => item.id === selectedTileId && item.derivedOutput?.kind === "cell_formula"); try { return tile ? { tile, definition: definitionForFormulaResult(draft, tile, id()) } : null; } catch { return null; } });
  const [plan, setPlan] = useState<CellFormulaPlan>(() => initialResult ? planFromFormula(draft, initialResult.definition, initialResult.tile.id) : ({ reportId: draft.id, sourceId: initial?.tile.id ?? "", definitionId: id(), rowId: "", comparedRowId: "", columnId: "", expression: "A / B", label: "New calculated metric", targetId: "", expectedBinding: "" }));
  const [previewToken, setPreviewToken] = useState(""), [reviewed, setReviewed] = useState(false), [message, setMessage] = useState(""), [search, setSearch] = useState(""), [libraryId, setLibraryId] = useState(initialResult?.definition.id ?? "");
  const [bindingSnapshot, setBindingSnapshot] = useState<CellFormulaSpec | null>(() => initialResult ? structuredClone(initialResult.definition.spec.formula!) : null);
  const modal = useRef<HTMLElement | null>(null), committing = useRef(false); useModalAccessibility(modal, onClose);
  const source = sources.find(item => item.tile.id === plan.sourceId), library = draft.analysisLibrary.derivedDefinitions.filter(item => item.outputKind === "cell_formula");
  const loaded = library.find(item => item.id === libraryId), outputs = draft.pages.flatMap(page => page.tiles.filter(tile => tile.derivedOutput?.kind === "cell_formula").map(tile => ({ page, tile })));
  let preview: ReturnType<typeof previewCellFormula> | null = null, issue = "";
  try { preview = previewCellFormula(draft, plan); } catch (problem) { issue = problem instanceof Error ? problem.message : "Review the source and formula."; }
  const fresh = preview && preview.token === previewToken ? preview : null;
  const query = search.trim().toLocaleLowerCase(), matches = (source?.tile.result.table ?? []).filter(row => `${row.label} ${row.sourceCategoryKey ?? ""}`.toLocaleLowerCase().includes(query)).slice(0, 200);
  const rows = (source?.tile.result.table ?? []).filter(row => row.optionId === plan.rowId || row.optionId === plan.comparedRowId || matches.includes(row));
  function update(change: Partial<CellFormulaPlan>) { setPlan(previous => ({ ...previous, ...change })); setPreviewToken(""); setReviewed(false); setMessage(""); }
  function reset(sourceId = plan.sourceId) { setLibraryId(""); setBindingSnapshot(null); update({ sourceId, definitionId: id(), rowId: "", comparedRowId: "", columnId: "", targetId: "", expectedBinding: "", label: "New calculated metric", expression: "A / B" }); }
  function load(definition: SavedDerivedDefinition, targetId = "") { try { setPlan(planFromFormula(draft, definition, targetId)); setBindingSnapshot(structuredClone(definition.spec.formula!)); setLibraryId(definition.id); setPreviewToken(""); setReviewed(false); setMessage(""); setSearch(""); } catch (problem) { setMessage(problem instanceof Error ? problem.message : "The definition is unavailable."); } }
  function loadResult(tile: DashboardTile) {
    try { load(definitionForFormulaResult(draft, tile, id()), tile.id); } catch (problem) { setMessage(problem instanceof Error ? problem.message : "The formula result is unavailable."); }
  }
  function calculate() { if (preview) { setPreviewToken(preview.token); setReviewed(false); setMessage("Preview ready. Review the input cells, response base and formula before saving."); } else setMessage(issue); }
  function commit(mode: "save" | "create" | "refresh") {
    if (!fresh || !reviewed || committing.current) return;
    committing.current = true;
    try {
      let result: ReturnType<typeof commitCellFormula> | undefined;
      const changed = onChange(current => { result = commitCellFormula(current, plan, previewToken, mode); return result.draft; });
      if (!changed || !result) throw Error("The report could not accept this change. Your original results were preserved; preview again.");
      const saved = result.draft.analysisLibrary.derivedDefinitions.find(item => item.id === plan.definitionId)!;
      const savedPlan = { ...plan, expectedBinding: saved.spec.formula!.binding };
      setPlan(savedPlan); setBindingSnapshot(structuredClone(saved.spec.formula!)); setPreviewToken(previewCellFormula(result.draft, savedPlan).token);
      setLibraryId(plan.definitionId); setMessage(mode === "save" ? "Formula saved in the report. Check the editor's save status after closing." : mode === "refresh" ? "Formula and selected result refreshed. Existing layout and other results were preserved." : "Formula saved and a new result page added. Original pages were preserved.");
      if (result.pageId && result.tileId) { onNavigate(result.pageId, result.tileId); onClose(); }
    } catch (problem) { setMessage(problem instanceof Error ? problem.message : "The formula was not saved."); } finally { committing.current = false; }
  }
  function remove() {
    if (!loaded || committing.current) return;
    try {
      if (!onChange(current => current.id !== plan.reportId ? current : { ...current, status: "draft", analysisLibrary: { ...current.analysisLibrary, derivedDefinitions: current.analysisLibrary.derivedDefinitions.filter(item => item.id !== loaded.id) } })) throw Error("The definition could not be removed from this report.");
      reset(); setMessage("Saved definition removed. Existing result pages remain; Undo can restore the definition.");
    } catch (problem) { setMessage(problem instanceof Error ? problem.message : "The definition was preserved."); }
  }
  function rowOptions() { return rows.map(row => <option key={row.optionId} value={row.optionId}>{row.label}{row.sourceCategoryKey ? ` [raw answer: ${row.sourceCategoryKey}]` : ""}</option>); }
  return createPortal(<div className="calculated-metric-backdrop"><section ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="calculated-metric-title" className="calculated-metric-dialog" data-canvas-keyboard-scope="controls">
    <header><div><span>REUSABLE CALCULATIONS</span><h2 id="calculated-metric-title">Calculated metrics</h2><p>Turn two recorded response cells into an editable formula, ratio or index.</p></div><button type="button" onClick={onClose}>Close calculated metrics</button></header>
    <div className="calculated-metric-scroll">
      <p className="calculated-metric-notice">This bounded workflow uses two cells from one original, unweighted local categorical result and one shared response universe. Counts and full-precision response percentages are supported. Cross-study arithmetic, weights, numeric means, authored nets and statistical inference are not supported.</p>
      <div className="calculated-metric-setup"><div>
        <label>Saved formula<select value={loaded ? loaded.id : ""} onChange={event => { const found = library.find(item => item.id === event.target.value); if (found) load(found); else reset(); }}><option value="">New formula</option>{library.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {bindingSnapshot && <div className="calculated-metric-notice"><strong>Saved bindings</strong><p>A: {bindingSnapshot.input.a.label} · B: {bindingSnapshot.input.b.label} · Column: {bindingSnapshot.input.column.label}. Source/import meaning is protected when loading this definition.</p><button type="button" onClick={() => update({ expectedBinding: "" })}>Review current cell bindings explicitly</button>{loaded && <><p>Saving updates the saved definition “{loaded.label}”. Existing result pages keep their recorded calculations until explicitly refreshed.</p><button type="button" onClick={() => { setLibraryId(""); update({ definitionId: id(), label: `${plan.label.slice(0, 74)} copy`, targetId: "" }); }}>Make a new formula from these choices</button><button type="button" onClick={remove}>Remove saved definition</button></>}</div>}
        <label>Source analysis<select value={plan.sourceId} onChange={event => reset(event.target.value)}><option value="">Choose an original analysis</option>{plan.sourceId && !source && <option value={plan.sourceId} disabled>Missing source - choose again</option>}{sources.map(item => <option key={`${item.page.id}:${item.tile.id}`} value={item.tile.id}>{item.page.title} / {item.tile.title || item.tile.name}</option>)}</select></label>
        {!sources.length && <button type="button" onClick={onCreateAnalysis}>Create an original response analysis</button>}
        {source && <p>{source.tile.result.metadataRefs.source?.kind === "imported" ? `${source.tile.result.metadataRefs.source.datasetLabel} · Imported ${source.tile.result.metadataRefs.source.datasetImportedAt ?? "unrecorded"}` : "Illustrative or remote source: create a local imported response analysis first."}<br />Recorded metric: {source.tile.result.metric.label}. The source's recorded audience and filters stay in effect.</p>}
        <label>Find source answers<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Answer label or raw value" /></label><small>Up to 200 matches; selected cells stay available. At most 5,000 source result cells are supported.</small>
        <label>Source column<select value={plan.columnId} onChange={event => update({ columnId: event.target.value, expectedBinding: "" })}><option value="">Choose a column</option>{plan.columnId && !source?.tile.result.columns.some(column => column.id === plan.columnId) && <option value={plan.columnId} disabled>Unavailable column</option>}{source?.tile.result.columns.map(column => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
        <label>A: first input<select value={plan.rowId} onChange={event => update({ rowId: event.target.value, expectedBinding: "" })}><option value="">Choose an answer</option>{plan.rowId && !rows.some(row => row.optionId === plan.rowId) && <option value={plan.rowId} disabled>Unavailable input A</option>}{rowOptions()}</select></label>
        <label>B: second input<select value={plan.comparedRowId} onChange={event => update({ comparedRowId: event.target.value, expectedBinding: "" })}><option value="">Choose a different answer</option>{plan.comparedRowId && !rows.some(row => row.optionId === plan.comparedRowId) && <option value={plan.comparedRowId} disabled>Unavailable input B</option>}{rowOptions()}</select></label>
      </div><div>
        <label>Metric name<input maxLength={80} value={plan.label} onChange={event => update({ label: event.target.value })} /></label>
        <div className="calculated-metric-presets" aria-label="Formula starting points">{[["Ratio", "A / B"], ["Index (B = 100)", "A / B * 100"], ["Relative difference (%)", "(A - B) / B * 100"], ["Pair average", "(A + B) / 2"]].map(([label, expression]) => <button key={label} type="button" onClick={() => update({ expression })}>{label}</button>)}</div>
        <label>Formula expression<input maxLength={256} value={plan.expression} onChange={event => update({ expression: event.target.value })} spellCheck={false} /></label>
        <p>Use A, B, numbers, +, −, *, / and parentheses. Both inputs must appear. Results are numbers in the units implied by your formula. For percentage inputs, A − B is a percentage-point difference; relative difference divides that difference by B. An average of two response percentages is not a combined-response net.</p>
        <p>Binary64 arithmetic, up to 64 tokens and 12 nested levels. Constants must be zero or have magnitude 1e-150–1e12; input magnitudes are at most 1e12 and intermediate results at most 1e15. Division by zero, unsupported underflow and nonfinite results are refused.</p>
        <button type="button" disabled={!preview} onClick={calculate}>Preview formula</button>
        {issue && <p role="status" className="calculated-metric-notice">{issue}</p>}
        {previewToken && !fresh && <p role="alert">The source or formula changed. Previous preview was withheld; review current bindings and preview again.</p>}
        {fresh && <section aria-label="Calculated metric preview" className="calculated-metric-preview"><h3>{fresh.metadata.formula!.label}</h3><p className="calculated-metric-value" title={String(fresh.response.table[0].values[plan.columnId])}>{new Intl.NumberFormat("en-US", { maximumSignificantDigits: 10 }).format(fresh.response.table[0].values[plan.columnId])}</p><dl><dt>Formula</dt><dd>{fresh.metadata.formula!.expression}</dd><dt>A: {fresh.metadata.rowLabel}</dt><dd>{String(fresh.metadata.formula!.input.a.value)}</dd><dt>B: {fresh.metadata.comparedRowLabel}</dt><dd>{String(fresh.metadata.formula!.input.b.value)}</dd><dt>Source response universe</dt><dd>n={fresh.metadata.formula!.input.base}; no pooled sample size or statistical precision is inferred.</dd></dl><p>The full input values are used, including unrounded numerator/denominator values for supported percentages. No report page or formula has changed yet.</p><label className="calculated-metric-consent"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the exact inputs, response base, units and formula.</label></section>}
      </div></div>
      {message && <p role="alert">{message}</p>}
      {outputs.length > 0 && <section aria-label="Recorded formula results"><h3>Recorded result pages</h3>{outputs.map(({ page, tile }) => { const matches = draft.pages.flatMap(item => item.tiles).filter(item => item.id === tile.derivedOutput!.sourceTileId); const problem = formulaCacheIssue(tile) ?? formulaSourceIssue(tile.derivedOutput!, matches.length === 1 ? matches[0] : undefined); return <article key={tile.id}><div><strong>{tile.title}</strong><small>{page.title} · {tile.derivedOutput!.formula?.expression}</small><p>{problem ?? "Matches the current recorded source cells."}</p></div><button type="button" onClick={() => loadResult(tile)}>Edit or refresh this result</button><button type="button" onClick={() => { onNavigate(page.id, tile.id); onClose(); }}>Open result page</button></article>; })}</section>}
    </div><footer><small>Save and report creation are undoable. Check the editor's browser-save status after closing. Existing source pages remain unchanged.</small><div><button type="button" disabled={!fresh || !reviewed} onClick={() => commit("save")}>Save definition only</button>{plan.targetId && <button type="button" disabled={!fresh || !reviewed} onClick={() => commit("refresh")}>Save and refresh selected result</button>}<button type="button" disabled={!fresh || !reviewed} onClick={() => commit("create")}>Save formula and add result page</button></div></footer>
  </section></div>, document.body);
}
