import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardDraft, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { importedFieldDisplayLabel } from "../data/datasetModelingModel";
import { eligibleModelFields, resolveLinearModelContext, type LinearModelPlan, type ModelSourceContext } from "./linearModelContext";
import { runLinearModelJob, type LinearModelRun, type ModelProgress } from "./linearModelJob";
import { LinearModelDiagnostics } from "./LinearModelDiagnostics";
import { CorrelationExplorer } from "./CorrelationExplorer";
import "./correlation.css";
import "./linear-model.css";

export default function LinearModelExplorer({ draft, studies, onClose }: { draft: DashboardDraft; studies: ImportedDatasetRecord[]; onClose: () => void }) {
  const local = studies.filter(study => !study.remote && study.sourceType === "local_file");
  const first = local.find(study => draft.pages.some(page => page.tiles.some(tile => tile.result.query.sourceIdentity?.kind === "imported" && tile.result.query.sourceIdentity.datasetId === study.id))) ?? local[0];
  const [plan, setPlan] = useState<LinearModelPlan>(() => ({ reportId: draft.id, datasetId: first?.id ?? "", importedAt: first?.importedAt ?? "", outcomeId: "", predictorIds: [], audienceId: "", seed: 12345 }));
  const [search, setSearch] = useState(""), [run, setRun] = useState<LinearModelRun | null>(null), [error, setError] = useState(""), [progress, setProgress] = useState<ModelProgress | null>(null);
  const modal = useRef<HTMLElement | null>(null), abort = useRef<AbortController | null>(null), generation = useRef(0);
  const current = useRef<ModelSourceContext>({ draft, studies, plan }); current.current = { draft, studies, plan };
  useModalAccessibility(modal, onClose);
  useEffect(() => () => { generation.current++; abort.current?.abort(); }, []);
  useEffect(() => { generation.current++; abort.current?.abort(); setProgress(null); }, [plan, draft, studies]);
  const dataset = studies.find(study => study.id === plan.datasetId), fields = eligibleModelFields(dataset);
  const query = search.trim().toLocaleLowerCase(), matches = fields.filter(field => !query || `${field.label} ${field.variableLabel ?? ""} ${field.sourceColumn}`.toLocaleLowerCase().includes(query));
  const visible = fields.filter(field => field.id === plan.outcomeId || plan.predictorIds.includes(field.id) || matches.slice(0, 200).includes(field));
  let issue = ""; try { resolveLinearModelContext(current.current); } catch (problem) { issue = problem instanceof Error ? problem.message : "Review the model settings."; }
  let correlationIssue = ""; try { resolveLinearModelContext({ ...current.current, plan: { ...plan, seed: 12345 } }); } catch (problem) { correlationIssue = problem instanceof Error ? problem.message : "Review the measurement selections."; }
  const activeRun = run && run.sourceStillCurrent() ? run : null;
  function update(change: Partial<LinearModelPlan>) { generation.current++; abort.current?.abort(); setProgress(null); setError(""); setPlan(previous => ({ ...previous, ...change })); }
  function chooseStudy(id: string) { const chosen = studies.find(study => study.id === id); update({ datasetId: id, importedAt: chosen?.importedAt ?? "", outcomeId: "", predictorIds: [], audienceId: "" }); setSearch(""); }
  async function fit() {
    abort.current?.abort(); const controller = new AbortController(), attempt = ++generation.current; abort.current = controller; setError(""); setRun(null);
    setProgress({ phase: "preparing", prepared: 0, total: dataset?.rowCount ?? 0 });
    try {
      const result = await runLinearModelJob(current.current, { signal: controller.signal, getCurrentContext: () => current.current, onProgress: value => { if (generation.current === attempt) setProgress(value); } });
      if (generation.current === attempt && !controller.signal.aborted) { setRun(result); setProgress(null); }
    } catch (problem) { if (generation.current === attempt) { setProgress(null); setError(problem instanceof Error ? problem.message : "Model fitting failed. Your data is preserved."); } }
  }
  function cancel() { generation.current++; abort.current?.abort(); setProgress(null); setError("Model fitting canceled. Your study and report are preserved."); }
  return createPortal(<div className="model-backdrop"><section className="model-explorer" ref={modal} role="dialog" aria-modal="true" aria-labelledby="linear-model-title" tabIndex={-1} data-canvas-keyboard-scope="controls">
    <header><div><span>NUMERIC RELATIONSHIPS</span><h2 id="linear-model-title">Explore a linear model</h2><p>Examine conditional associations and prediction errors before interpreting a relationship.</p></div><button type="button" onClick={onClose}>Close model exploration</button></header>
    <div className="model-scroll">
      <p className="model-notice">Temporary, unweighted exploration. Closing or reloading clears this model; it does not add or change report pages, studies or saved analyses. It is not a causal analysis or a validated survey inference tool.</p>
      <div className="model-setup"><div>
        <label>Model study<select value={plan.datasetId} onChange={event => chooseStudy(event.target.value)}><option value="">Choose a study</option>{plan.datasetId && !dataset && <option value={plan.datasetId} disabled>Missing study - choose again</option>}{studies.map(study => <option key={study.id} value={study.id}>{study.title}{study.remote ? " (remote, unavailable)" : ""}</option>)}</select></label>
        {dataset && <p>{dataset.rowCount.toLocaleString()} source rows · Imported {dataset.importedAt} · Complete local-file studies up to 25,000 rows.</p>}
        {dataset && dataset.importedAt !== plan.importedAt && <button type="button" onClick={() => chooseStudy(dataset.id)}>Review this replacement import and reset choices</button>}
        <label>Find numeric measurements<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Label or raw column" /></label><small>Up to 200 matches; selected fields stay visible. Identifier and system columns are excluded. Search uses metadata, not respondent answers.</small>
        <label>Numeric outcome<select value={plan.outcomeId} onChange={event => update({ outcomeId: event.target.value, predictorIds: plan.predictorIds.filter(id => id !== event.target.value) })}><option value="">Choose an outcome</option>{plan.outcomeId && !fields.some(field => field.id === plan.outcomeId) && <option value={plan.outcomeId} disabled>Unavailable outcome</option>}{visible.map(field => <option key={field.id} value={field.id}>{importedFieldDisplayLabel(field)} [column: {field.sourceColumn}]</option>)}</select></label>
        <fieldset><legend>Predictors ({plan.predictorIds.length}/6)</legend><small>Select quantitative measurements with meaningful units. Numeric category codes are not automatically quantitative. No automatic variable selection is performed.</small><div className="model-fields">{visible.filter(field => field.id !== plan.outcomeId).map(field => <label key={field.id} className="model-inline"><input type="checkbox" checked={plan.predictorIds.includes(field.id)} disabled={!plan.predictorIds.includes(field.id) && plan.predictorIds.length >= 6} onChange={event => update({ predictorIds: event.target.checked ? [...plan.predictorIds, field.id] : plan.predictorIds.filter(id => id !== field.id) })} /><span>{importedFieldDisplayLabel(field)}<small>Raw column: {field.sourceColumn}</small></span></label>)}</div></fieldset>
      </div><div>
        <label>Model audience<select value={plan.audienceId} onChange={event => update({ audienceId: event.target.value })}><option value="">All respondents</option>{plan.audienceId && !(draft.savedAudiences ?? []).some(audience => audience.id === plan.audienceId && audience.datasetId === plan.datasetId) && <option value={plan.audienceId} disabled>Unavailable audience - choose again</option>}{(draft.savedAudiences ?? []).filter(audience => audience.datasetId === plan.datasetId).map(audience => <option key={audience.id} value={audience.id}>{audience.label}</option>)}</select></label>
        <label>Reproducible split seed<input type="number" min="1" max="4294967295" step="1" value={Number.isFinite(plan.seed) ? plan.seed : ""} onChange={event => update({ seed: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>
        <details open><summary>Method and limitations</summary><p>Ordinary least squares with an intercept, centered and scaled predictors, and QR factorization. A reproducible shuffle reserves approximately 20% of complete rows for holdout evaluation; the rest fit the model. At least 50 complete audience rows and three distinct outcome values are required. These product guards do not establish statistical reliability.</p><p>Only rows with all selected numeric values are used. Missing values are not replaced with zero. Currency, thousands separators and percentages follow import parsing; percentages are percentage points. Review units first. Magnitudes above 1e12, training standard deviations below 1e-150, constant predictors and near-singular designs are refused. Rescale unsupported units before fitting.</p><p>Weights, complex sampling, clustering, repeated observations, time-based splits, confidence intervals and significance tests are not supported. Repeatedly tuning against the same holdout can overfit it; use fresh external validation before decisions. Association does not establish causation.</p></details>
      </div></div>
      <CorrelationExplorer context={current.current} issue={correlationIssue} getCurrentContext={() => current.current}/>
      {issue && <p role="status" className="model-notice">{issue}</p>}{error && <p role="alert">{error}</p>}
      {progress && <div role="status"><p>{progress.phase === "preparing" ? "Preparing complete cases" : "Fitting in a background worker"}: {progress.prepared.toLocaleString()} / {progress.total.toLocaleString()} source rows</p><progress max={Math.max(1, progress.total)} value={progress.prepared} /><button type="button" onClick={cancel}>Cancel model fitting</button></div>}
      {run && !activeRun && <p role="alert">The source, audience or settings changed. Previous diagnostics are hidden. Review the current choices and fit again.</p>}
      {activeRun && <section aria-label="Model population"><h3>What entered this model</h3><p>{activeRun.context.dataset.title} · {activeRun.context.audience?.label ?? "All respondents"} · Unweighted · Split seed {activeRun.seed}</p><p>{activeRun.coverage.total.toLocaleString()} source rows; {activeRun.coverage.included.toLocaleString()} audience rows; {activeRun.coverage.excluded.toLocaleString()} excluded by audience; {activeRun.coverage.unknownAudience.toLocaleString()} unknown audience memberships; {activeRun.coverage.incomplete.toLocaleString()} incomplete audience rows excluded; {activeRun.coverage.complete.toLocaleString()} complete cases.</p><div className="model-table"><table><caption>Complete-case exclusions by selected field (a row may appear in multiple fields)</caption><thead><tr><th scope="col">Field / raw column</th><th scope="col">Blank</th><th scope="col">Non-numeric</th></tr></thead><tbody>{[activeRun.context.outcome, ...activeRun.context.predictors].map((field, index) => <tr key={field.id}><th scope="row">{importedFieldDisplayLabel(field)} / {field.sourceColumn}</th><td>{activeRun.coverage.fields[index].blank}</td><td>{activeRun.coverage.fields[index].invalid}</td></tr>)}</tbody></table></div><LinearModelDiagnostics run={activeRun} /></section>}
    </div><footer><small>Exact selected raw values, mappings and audience membership are rechecked before accepting results.</small><button type="button" disabled={Boolean(issue) || Boolean(progress)} onClick={fit}>Fit exploratory model</button></footer>
  </section></div>, document.body);
}
