import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardDraft, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { PreparationStep } from "../../../shared/types/dataPreparation";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { preparationFieldMappingIssue, preparationFingerprint, preparationSourceIssue, previewPreparation, transformPreparationValue, verifyPreparedStudy, type PreparationPreview } from "./preparationModel";
import "./preparation.css";

type Props = { draft: DashboardDraft; studies: ImportedDatasetRecord[]; onClose: () => void; onSave: (preview: PreparationPreview, signal: AbortSignal) => Promise<string | null> };
const labels: Record<PreparationStep["kind"], string> = { trim: "Trim outside whitespace", lowercase: "Use lowercase", uppercase: "Use uppercase", collapse_spaces: "Combine repeated whitespace", recode: "Recode or combine categories" };
export default function DataPreparation({ studies, onClose, onSave }: Props) {
  const [studyId, setStudyId] = useState(""), [sourceId, setSourceId] = useState(""), [title, setTitle] = useState("Prepared study"), [history, setHistory] = useState<PreparationStep[]>([]), [cursor, setCursor] = useState(0);
  const [fieldId, setFieldId] = useState(""), [kind, setKind] = useState<PreparationStep["kind"]>("trim"), [from, setFrom] = useState<string[]>([]), [to, setTo] = useState(""), [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState<PreparationPreview | null>(null), [pendingStep, setPendingStep] = useState<PreparationStep | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [savedId, setSavedId] = useState("");
  const modal = useRef<HTMLElement | null>(null), abort = useRef<AbortController | null>(null), epoch = useRef(0), source = studies.find(study => study.id === sourceId), current = useRef({ studies }); current.current = { studies };
  useModalAccessibility(modal, onClose); useEffect(() => () => { epoch.current++; abort.current?.abort(); }, []);
  const active = history.slice(0, cursor), field = source?.fields.find(item => item.id === fieldId);
  const fieldMappingIssue = source && field ? preparationFieldMappingIssue(source, field) : null;
  // Choices describe the values after the applied history, before the next step.
  const choices = useMemo(() => field && source && !fieldMappingIssue ? [...new Set(source.rows.map(row => history.slice(0, cursor).filter(step => step.fieldId === field.id).reduce((value, step) => transformPreparationValue(value, step), Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : "")))].sort().slice(0, 500) : [], [source, field, history, cursor, fieldMappingIssue]);
  function invalidate() { epoch.current++; abort.current?.abort(); setBusy(false); setPreview(null); setPendingStep(null); setReviewed(false); setMessage(""); }
  async function choose(id: string) {
    invalidate(); const attempt = epoch.current; setStudyId(id); setSourceId(""); setHistory([]); setCursor(0); setFieldId(""); setFrom([]); setSavedId("");
    const selected = studies.find(study => study.id === id); if (!selected) return;
    if (selected.preparation) {
      const original = studies.find(study => study.id === selected.preparation!.sourceDatasetId); if (!original) { setMessage("The original source is unavailable. This prepared study is preserved; its history was not rebound."); return; }
      setBusy(true);
      try { await verifyPreparedStudy(original, selected); if (attempt !== epoch.current) return; setSourceId(original.id); setHistory(structuredClone(selected.preparation.steps)); setCursor(selected.preparation.steps.length); setTitle(`${selected.title.slice(0, 145)} revision`); setMessage("Saved history verified against the original. Saving creates a separate revision; existing studies and analyses stay intact."); }
      catch (error) { if (attempt === epoch.current) setMessage(String(error instanceof Error ? error.message : error)); }
      finally { if (attempt === epoch.current) setBusy(false); }
    } else { setSourceId(id); setTitle(`${selected.title.slice(0, 145)} prepared`); }
  }
  async function build(add: boolean) {
    if (!source) return; invalidate(); const attempt = epoch.current, controller = new AbortController(); abort.current = controller; setBusy(true);
    const step: PreparationStep | null = add && field ? { id: `step-${Date.now()}-${cursor}`, fieldId, sourceColumn: field.sourceColumn, kind, from: kind === "recode" ? from : [], to: kind === "recode" ? to : "" } : null;
    try {
      if (add && !step) throw Error("Choose a text or categorical field.");
      const result = await previewPreparation(source, [...active, ...(step ? [step] : [])], title, controller.signal);
      const latest = current.current.studies.find(study => study.id === source.id);
      if (!latest || await preparationFingerprint(latest) !== result.sourceFingerprint) throw Error("The source changed while previewing. Review the current study and preview again.");
      if (attempt !== epoch.current) return; setPreview(result); setPendingStep(step);
    } catch (error) { if (attempt === epoch.current) setMessage(error instanceof Error ? error.message : "Preparation failed; original data is preserved."); }
    finally { if (attempt === epoch.current) setBusy(false); }
  }
  function move(next: number) { invalidate(); setCursor(next); setFrom([]); }
  async function save() {
    if (!preview || pendingStep || !reviewed) return; const attempt = ++epoch.current, controller = new AbortController(); abort.current = controller; setBusy(true); setMessage("");
    try {
      const latest = current.current.studies.find(study => study.id === preview.recipe.sourceDatasetId); if (!latest) throw Error("The source is missing. Original and preview are preserved.");
      await verifyPreparedStudy(latest, preview.dataset); if (attempt !== epoch.current) return;
      const issue = await onSave(preview, controller.signal); if (attempt !== epoch.current) return;
      if (issue) setMessage(issue); else { setSavedId(preview.dataset.id); setMessage("Prepared study saved in this browser. Choose it in Create analysis. The original study and existing report analyses are unchanged."); }
    } catch (error) { if (attempt === epoch.current) setMessage(error instanceof Error ? error.message : "Save failed; preview remains available."); }
    finally { if (attempt === epoch.current) setBusy(false); }
  }
  const issue = source ? preparationSourceIssue(source) : "Choose a study to start or inspect a saved prepared copy.";
  return createPortal(<div className="preparation-backdrop"><section ref={modal} className="preparation-dialog" role="dialog" aria-modal="true" aria-labelledby="preparation-title" tabIndex={-1} data-canvas-keyboard-scope="controls">
    <header><div><small>REVERSIBLE DATA PREPARATION</small><h2 id="preparation-title">Prepare a separate study</h2><p>Clean and combine responses with a visible history. Keep your original data intact.</p></div><button onClick={onClose}>Close data preparation</button></header>
    <div className="preparation-scroll"><p className="preparation-note">Complete local studies only: up to 50,000 rows, 200 fields and 20 MiB of source values/metadata. Every row and original column is retained. Numeric/date transformations and remote studies are unsupported. Saving creates a separate study, not a change to existing analyses. Unsaved history is cleared when closed.</p>
    <label>Preparation study<select value={studyId} onChange={event => void choose(event.target.value)}><option value="">Choose an original or prepared study</option>{studies.map(study => <option key={study.id} value={study.id}>{study.title}{study.preparation ? " — saved history" : ""}</option>)}</select></label>
    {issue && <p role="status">{issue}</p>}{source && !issue && <>
      <label>Prepared study name<input maxLength={160} value={title} onChange={event => { invalidate(); setTitle(event.target.value); }} /></label>
      <div className="preparation-columns"><section aria-label="Preparation history"><h3>Applied history ({cursor} steps)</h3><p>Undo/Redo changes this recipe; the original and saved copies remain intact. After Undo, applying a new step replaces the unapplied redo branch.</p><button disabled={busy || cursor === 0} onClick={() => move(cursor - 1)}>Undo preparation step</button><button disabled={busy || cursor === history.length} onClick={() => move(cursor + 1)}>Redo preparation step</button>
      <ol>{history.map((step, index) => <li key={step.id} className={index >= cursor ? "preparation-undone" : ""}>{labels[step.kind]} — {source.fields.find(item => item.id === step.fieldId)?.label ?? step.sourceColumn}{step.kind === "recode" && <small>{step.from.map(value => value || "[blank]").join(" + ")} → {step.to || "[blank]"}</small>}{index >= cursor && <strong> Undone</strong>}</li>)}</ol><button disabled={busy || cursor === 0} onClick={() => void build(false)}>Preview current history</button></section>
      <section aria-label="Next preparation step"><h3>Add a step</h3><label>Preparation field<select value={fieldId} onChange={event => { invalidate(); setFieldId(event.target.value); setFrom([]); }}><option value="">Choose a text or categorical field</option>{source.fields.filter(item => ["text", "categorical"].includes(item.type)).map(item => <option key={item.id} value={item.id}>{item.label} [{item.sourceColumn}]</option>)}</select></label>
      <label>Preparation operation<select value={kind} onChange={event => { invalidate(); setKind(event.target.value as PreparationStep["kind"]); setFrom([]); }} >{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {kind === "recode" && <><p>Choose exact raw codes to combine. Comparisons are case-sensitive, with no numeric coercion. Blank is a deliberate value; recoding to blank makes those responses missing. Altered code labels are removed; the target raw text becomes its displayed category.</p><fieldset><legend>Codes to recode (up to 100)</legend><div className="preparation-choices">{choices.map(value => <label key={value}><input type="checkbox" checked={from.includes(value)} onChange={event => { invalidate(); setFrom(previous => event.target.checked ? [...previous, value] : previous.filter(item => item !== value)); }} />{value || "[blank]"}</label>)}</div><small>First 500 distinct codes. Preview current history to refresh these choices after applied transformations.</small></fieldset><label>Target raw code<input value={to} maxLength={512} onChange={event => { invalidate(); setTo(event.target.value); }} placeholder="Leave blank only to mark selected codes as missing" /></label></>}
      {fieldMappingIssue && <p role="status">{fieldMappingIssue}</p>}
      <button disabled={busy || !field || !!fieldMappingIssue || cursor >= 30} onClick={() => void build(true)}>Preview new step</button><p>Maximum 30 steps. Preview before applying; no original cells are edited.</p></section></div>
      {preview && <section aria-label="Preparation preview"><h3>{pendingStep ? "Review the proposed next step" : "Review the prepared copy"}</h3><p>{preview.dataset.rowCount.toLocaleString()} retained rows · {preview.changedCells.toLocaleString()} distinct cells changed during this recipe · {preview.affectedRespondents.toLocaleString()} rows affected. Individual step counts can overlap or cancel.</p><ol>{preview.steps.map(item => <li key={item.step.id}>{labels[item.step.kind]}: {item.changed.toLocaleString()} cell changes</li>)}</ol><div className="preparation-table"><table><caption>First 25 final differences from the original, using source row positions</caption><thead><tr><th>Row</th><th>Field</th><th>Original raw value</th><th>Prepared raw value</th></tr></thead><tbody>{preview.examples.map((example, index) => <tr key={index}><td>{example.row}</td><td>{example.field}</td><td>{JSON.stringify(example.before)}</td><td>{JSON.stringify(example.after)}</td></tr>)}</tbody></table></div>{!preview.examples.length && <p>No final raw values differ from the original.</p>}
      {pendingStep ? <button onClick={() => { setHistory([...active, pendingStep]); setCursor(cursor + 1); setPendingStep(null); setReviewed(false); setFrom([]); }}>Apply previewed step to history</button> : <label className="preparation-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the transformations and missing-value consequences.</label>}</section>}
    </>}{message && <p role="status" className="preparation-note">{message}</p>}{busy && <p role="status">Checking original source and preparation… <button onClick={() => { invalidate(); setMessage("Preparation canceled. Original data is preserved."); }}>Cancel preparation</button></p>}</div>
    <footer><small>The original source is checked before creation and when reopening history. Existing analyses keep their original source. Ordinary browser-save status remains authoritative.</small><button disabled={busy || !preview || !!pendingStep || !reviewed || preview.dataset.id === savedId} onClick={() => void save()}>Save prepared study copy</button></footer>
  </section></div>, document.body);
}
