import { parseWorkspaceRoute } from "../document/workspacePersistence";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardDraft, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { PreparationStep } from "../../../shared/types/dataPreparation";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { preparationFieldMappingIssue, preparationFingerprint, preparationSourceIssue, previewPreparation, transformPreparationValue, verifyPreparedStudy, type PreparationPreview } from "./preparationModel";
import "./preparation.css";
import CheckpointFiles from "./CheckpointFiles";
import PreparationCodePicker from "./PreparationCodePicker";
import PreparedValues from "./PreparedValues";

import { listPreparationCheckpoints, restorePreparationCheckpoint, savePreparationCheckpoint, type CheckpointListing } from "./preparationCheckpoint";

type Props = { draft: DashboardDraft; studies: ImportedDatasetRecord[]; onClose: () => void; onSave: (preview: PreparationPreview, signal: AbortSignal) => Promise<string | null> };
const labels: Record<PreparationStep["kind"], string> = { trim: "Trim outside whitespace", lowercase: "Use lowercase", uppercase: "Use uppercase", collapse_spaces: "Combine repeated whitespace", recode: "Recode or combine categories" };
function preparationRecipeKey(studyId: string, sourceId: string, title: string, history: PreparationStep[], cursor: number) {
  return JSON.stringify([studyId, sourceId, title, history.slice(0, cursor)]);
}
function preparationChoiceKey(fieldId: string, kind: PreparationStep["kind"], from: string[], to: string) {
  return JSON.stringify([fieldId, kind, from, to]);
}
type PreparationNavigation = { kind: "close" } | { kind: "study"; id: string } | { kind: "route"; hash: string };
export default function DataPreparation({ draft, studies, onClose, onSave }: Props) {
  const [studyId, setStudyId] = useState(""), [sourceId, setSourceId] = useState(""), [title, setTitle] = useState("Prepared study"), [history, setHistory] = useState<PreparationStep[]>([]), [cursor, setCursor] = useState(0);
  const [fieldId, setFieldId] = useState(""), [kind, setKind] = useState<PreparationStep["kind"]>("trim"), [from, setFrom] = useState<string[]>([]), [to, setTo] = useState(""), [reviewed, setReviewed] = useState(false);
  const [preview, setPreview] = useState<PreparationPreview | null>(null), [pendingStep, setPendingStep] = useState<PreparationStep | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [savedId, setSavedId] = useState("");
  function readCheckpoints(): CheckpointListing { try { return listPreparationCheckpoints(window.localStorage, draft.id); } catch { return { items: [], issue: "Browser checkpoint storage is unavailable. Your editor and studies are kept." }; } }
  const [checkpoints, setCheckpoints] = useState(readCheckpoints), [checkpointKey, setCheckpointKey] = useState("");
  const checkpointSelection = useRef(""), restoringCheckpoint = useRef<{ key: string; attempt: number } | null>(null);
  const modal = useRef<HTMLElement | null>(null), abort = useRef<AbortController | null>(null), epoch = useRef(0), source = studies.find(study => study.id === sourceId), current = useRef({ studies, reportId: draft.id }); current.current = { studies, reportId: draft.id };
  const [recipeBaseline, setRecipeBaseline] = useState(() => preparationRecipeKey("", "", "Prepared study", [], 0));
  const [choiceBaseline, setChoiceBaseline] = useState(() => preparationChoiceKey("", "trim", [], ""));
  const [navigation, setNavigation] = useState<PreparationNavigation | null>(null);
  const keepControl = useRef<HTMLButtonElement | null>(null), studyControl = useRef<HTMLSelectElement | null>(null), warning = useRef<HTMLElement | null>(null), returnTo = useRef<HTMLElement | null>(null);
  const restoration = useRef<{ target: HTMLElement | null; owner: HTMLElement | null } | null>(null);
  const recipeKey = preparationRecipeKey(studyId, sourceId, title, history, cursor);
  const hasUnappliedEditor = preparationChoiceKey(fieldId, kind, from, to) !== choiceBaseline;
  const hasUnsaved = recipeKey !== recipeBaseline || hasUnappliedEditor || cursor < history.length || pendingStep !== null || !!preview && preview.dataset.id !== savedId;
  const initialRoute = parseWorkspaceRoute();
  const editingRoute = useRef({ hash: window.location.hash, href: window.location.href, state: window.history.state as unknown, key: `${initialRoute.mode}:${initialRoute.reportId ?? "active"}` });
  const pendingRoute = useRef<string | null>(null), replayRoute = useRef<string | null>(null);
  const routeContext = useRef({ blocked: hasUnsaved || busy, busy, navigation }); routeContext.current = { blocked: hasUnsaved || busy, busy, navigation };
  const [navigationIssue, setNavigationIssue] = useState("");
  function keepEditing() {
    if (pendingRoute.current !== null) {
      try { if (window.location.href !== editingRoute.current.href) window.history.pushState(editingRoute.current.state, "", editingRoute.current.href); }
      catch { setNavigationIssue("Could not return to the report address. Your preparation is still open; nothing was discarded."); return; }
      pendingRoute.current = null; replayRoute.current = null;
    }
    setNavigationIssue("");
    const owner = document.activeElement instanceof HTMLElement && warning.current?.contains(document.activeElement) ? document.activeElement : null;
    restoration.current = { target: returnTo.current, owner }; setNavigation(null);
  }
  function requestNavigation(next: Exclude<PreparationNavigation, { kind: "route" }>) {
    if (next.kind === "study" && studies.filter(study => study.id === next.id).length !== 1) { setMessage("That study is unavailable or ambiguous. Your current preparation was kept."); return; }
    if (busy) { setMessage("A preparation check or save is still running. Cancel it before closing or choosing another study."); return; }
    if (!hasUnsaved) { if (next.kind === "close") onClose(); else void choose(next.id); return; }
    returnTo.current = document.activeElement instanceof HTMLElement && modal.current?.contains(document.activeElement) ? document.activeElement : null;
    setNavigation(next);
  }
  function requestClose() { if (navigation) keepEditing(); else requestNavigation({ kind: "close" }); }
  function discardAndContinue() {
    if (!navigation) return;
    const next = navigation;
    if (next.kind === "route") {
      if (pendingRoute.current !== next.hash || window.location.hash !== next.hash) { setNavigationIssue("The destination changed. Your preparation is kept; use Keep editing before navigating again."); return; }
      replayRoute.current = next.hash; pendingRoute.current = null;
      onClose(); queueMicrotask(() => window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }))); return;
    }
    if (next.kind === "study" && studies.filter(study => study.id === next.id).length !== 1) { keepEditing(); setMessage("That study is unavailable or ambiguous. Your current preparation was kept."); return; }
    if (next.kind === "close") { onClose(); return; }
    const owner = document.activeElement instanceof HTMLElement && warning.current?.contains(document.activeElement) ? document.activeElement : null;
    restoration.current = { target: studyControl.current, owner }; setNavigation(null); void choose(next.id);
  }
  useModalAccessibility(modal, requestClose); useEffect(() => () => { epoch.current++; abort.current?.abort(); }, []);
  useLayoutEffect(() => {
    function holdRoute(event: Event) {
      const hash = window.location.hash, context = routeContext.current;
      if (replayRoute.current === hash || !context.blocked && pendingRoute.current === null) return;
      // Window target capture runs before App/Builder's ordinary route listeners.
      // Do not cancel browser history itself: hold the mounted editor until consent.
      event.stopImmediatePropagation();
      const next = parseWorkspaceRoute(), key = `${next.mode}:${next.reportId ?? "active"}`;
      if (context.busy && window.location.href !== editingRoute.current.href) {
        epoch.current++; abort.current?.abort(); setBusy(false); setReviewed(false);
        setMessage("Navigation interrupted a preparation check or save. Your recipe and choices were kept. Review and retry interrupted work; any completed workspace copy is retained.");
      }
      if (key === editingRoute.current.key) {
        editingRoute.current = { ...editingRoute.current, hash, href: window.location.href, state: window.history.state as unknown };
        if (pendingRoute.current !== null) keepEditing(); return;
      }
      if (pendingRoute.current === hash) return;
      if (pendingRoute.current === null && !context.navigation) returnTo.current = document.activeElement instanceof HTMLElement && modal.current?.contains(document.activeElement) ? document.activeElement : null;
      pendingRoute.current = hash; setNavigationIssue(""); setNavigation({ kind: "route", hash });
    }
    window.addEventListener("hashchange", holdRoute, true); window.addEventListener("popstate", holdRoute, true);
    return () => { window.removeEventListener("hashchange", holdRoute, true); window.removeEventListener("popstate", holdRoute, true); };
  }, []);

  useEffect(() => {
    if (!hasUnsaved && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved, busy]);
  useLayoutEffect(() => {
    if (navigation) { keepControl.current?.focus(); return; }
    const restore = restoration.current; restoration.current = null;
    if (restore?.owner && !restore.owner.isConnected && (!document.activeElement || document.activeElement === document.body) && restore.target?.isConnected && !restore.target.closest("[hidden], [inert]")) restore.target.focus();
  }, [navigation]);
  const active = history.slice(0, cursor), field = source?.fields.find(item => item.id === fieldId);
  const fieldMappingIssue = source && field ? preparationFieldMappingIssue(source, field) : null;
  // Choices describe the values after the applied history, before the next step.
  const choices = useMemo(() => field && source && !fieldMappingIssue ? [...new Set(source.rows.map(row => history.slice(0, cursor).filter(step => step.fieldId === field.id).reduce((value, step) => transformPreparationValue(value, step), Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : "")))].sort() : [], [source, field, history, cursor, fieldMappingIssue]);
  function invalidate() { epoch.current++; abort.current?.abort(); setBusy(false); setPreview(null); setPendingStep(null); setReviewed(false); setMessage(""); }
  async function choose(id: string) {
    invalidate(); const attempt = epoch.current; setStudyId(id); setSourceId(""); setHistory([]); setCursor(0); setFieldId(""); setKind("trim"); setFrom([]); setTo(""); setTitle("Prepared study"); setSavedId("");
    setRecipeBaseline(preparationRecipeKey(id, "", "Prepared study", [], 0)); setChoiceBaseline(preparationChoiceKey("", "trim", [], ""));
    const selected = studies.find(study => study.id === id); if (!selected) return;
    if (selected.preparation) {
      const original = studies.find(study => study.id === selected.preparation!.sourceDatasetId); if (!original) { setMessage("The original source is unavailable. This prepared study is preserved; its history was not rebound."); return; }
      setBusy(true);
      try {
        await verifyPreparedStudy(original, selected); if (attempt !== epoch.current) return;
        const loaded = structuredClone(selected.preparation.steps), nextTitle = `${selected.title.slice(0, 145)} revision`;
        setSourceId(original.id); setHistory(loaded); setCursor(loaded.length); setTitle(nextTitle);
        setRecipeBaseline(preparationRecipeKey(id, original.id, nextTitle, loaded, loaded.length));
        setMessage("Saved history verified against the original. Saving creates a separate revision; existing studies and analyses stay intact.");
      } catch (error) { if (attempt === epoch.current) setMessage(String(error instanceof Error ? error.message : error)); }
      finally { if (attempt === epoch.current) setBusy(false); }
    } else {
      const nextTitle = `${selected.title.slice(0, 145)} prepared`; setSourceId(id); setTitle(nextTitle);
      setRecipeBaseline(preparationRecipeKey(id, id, nextTitle, [], 0));
    }
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
      if (issue) setMessage(issue); else { setSavedId(preview.dataset.id); setRecipeBaseline(recipeKey); setMessage("Prepared study saved in this browser. Choose it in Create analysis. The original study and existing report analyses are unchanged."); }
    } catch (error) { if (attempt === epoch.current) setMessage(error instanceof Error ? error.message : "Save failed; preview remains available."); }
    finally { if (attempt === epoch.current) setBusy(false); }
  }
  function selectCheckpoint(key: string) {
    if (key === checkpointSelection.current) return;
    checkpointSelection.current = key; setCheckpointKey(key);
    const pending = restoringCheckpoint.current;
    if (pending && pending.attempt === epoch.current) {
      epoch.current++; abort.current?.abort(); restoringCheckpoint.current = null; setBusy(false);
      setMessage("Checkpoint selection changed. The previous restore was canceled; use Restore recovery checkpoint to open the selected checkpoint. Your editor and stored copies were kept.");
    }
  }
  async function checkpoint(restore: boolean) {
    if (busy || navigation || restore && hasUnsaved || !restore && (!source || !hasUnsaved)) return;
    epoch.current++; abort.current?.abort(); const attempt = epoch.current, controller = new AbortController(), reportId = draft.id, selectedKey = checkpointSelection.current; abort.current = controller; setBusy(true); setMessage("");
    const latestStudies = () => { if (current.current.reportId !== reportId) throw Error("The report changed. Checkpoint work was kept separate."); return current.current.studies; };
    try {
      if (restore) {
        restoringCheckpoint.current = { key: selectedKey, attempt };
        const e = await restorePreparationCheckpoint(window.localStorage, reportId, selectedKey, latestStudies, controller.signal);
        if (attempt !== epoch.current || checkpointSelection.current !== selectedKey) return;
        setPreview(null); setPendingStep(null); setReviewed(false);
        setStudyId(e.sourceId); setSourceId(e.sourceId); setTitle(e.title); setHistory(e.history); setCursor(e.cursor); setFieldId(e.fieldId); setKind(e.kind); setFrom(e.from); setTo(e.to); setSavedId("");
        setRecipeBaseline(preparationRecipeKey("", "", "Prepared study", [], 0)); setChoiceBaseline(preparationChoiceKey("", "trim", [], ""));
        setMessage("Checkpoint restored against the unchanged original study. History, redo steps and editor choices are back. Preview and review again before creating a study; no source or saved report was changed.");
      } else {
        const key = await savePreparationCheckpoint(window.localStorage, reportId, { sourceId, title, history, cursor, fieldId, kind, from, to }, latestStudies, controller.signal);
        if (attempt !== epoch.current) return;
        checkpointSelection.current = key; setCheckpointKey(key); setCheckpoints(readCheckpoints());
        setMessage("Recovery checkpoint saved in this browser. Applied and redo history plus current editor choices are retained separately. Preview output and review approval are not saved; this does not create a prepared study or mark your editor saved.");
      }
    } catch (error) { if (attempt === epoch.current) setMessage(error instanceof Error ? error.message : "Checkpoint storage could not be confirmed. Your editor and studies were kept."); }
    finally { if (restoringCheckpoint.current?.attempt === attempt) restoringCheckpoint.current = null; if (attempt === epoch.current) setBusy(false); }
  }
  const issue = source ? preparationSourceIssue(source) : "Choose a study to start or inspect a saved prepared copy.";
  return createPortal(<div className="preparation-backdrop"><section ref={modal} className="preparation-dialog" role="dialog" aria-modal="true" aria-labelledby={navigation ? "preparation-discard-title" : "preparation-title"} aria-describedby={navigation ? "preparation-discard-description" : undefined} tabIndex={-1} data-canvas-keyboard-scope="controls" onBlurCapture={event => { if (restoration.current?.owner === event.target) restoration.current.owner = null; }}>
    {navigation && <section ref={warning} className="preparation-discard"><h2 id="preparation-discard-title">Discard unsaved preparation?</h2><p id="preparation-discard-description">{navigation.kind === "close" ? "Closing" : navigation.kind === "route" ? "Leaving this report" : "Choosing another study"} discards this unsaved recipe, redo steps, previews and editor choices. Original studies, previously saved copies and workspace recovery copies are kept.</p>{navigation.kind === "route" && <p>Your preparation is still open. Keep editing returns to this report; leaving discards only unfinished preparation.</p>}{navigationIssue && <p role="alert">{navigationIssue}</p>}<div><button ref={keepControl} type="button" onClick={keepEditing}>Keep editing preparation</button><button type="button" onClick={discardAndContinue}>{navigation.kind === "close" ? "Discard and close preparation" : navigation.kind === "route" ? "Discard and leave report" : "Discard and switch study"}</button></div></section>}
    <header hidden={!!navigation} inert={!!navigation}><div><small>REVERSIBLE DATA PREPARATION</small><h2 id="preparation-title">Prepare a separate study</h2><p>Clean and combine responses with a visible history. Keep your original data intact.</p></div><button onClick={requestClose}>Close data preparation</button></header>
    <div className="preparation-scroll" hidden={!!navigation} inert={!!navigation}><p className="preparation-note">Complete local studies only: up to 50,000 rows, 200 fields and 20 MiB of source values/metadata. Every row and original column is retained. Numeric/date transformations and remote studies are unsupported. Saving creates a separate study, not a change to existing analyses. Leaving unsaved work requires a discard choice. Browser reload or closing the tab may show a browser warning; unfinished recipes are not saved automatically. Use Save recovery checkpoint to retain the current recipe and editor choices in this browser.</p>
    <section aria-label="Unfinished preparation recovery"><h3>Recovery checkpoints</h3><p>Explicit checkpoints stay in this browser when you reopen this tool. Their codes and editor text are stored unencrypted; keep downloaded copies private. They do not contain complete response-row tables. Keep your original study: restoration requires its exact source. Up to eight separate checkpoints per report; older copies are never replaced or removed automatically.</p>
      <button disabled={busy || !source || !hasUnsaved} onClick={() => void checkpoint(false)}>Save recovery checkpoint</button>
      <button disabled={busy} onClick={() => setCheckpoints(readCheckpoints())}>Refresh recovery checkpoints</button>
      <label>Recovery checkpoint<select value={checkpointKey} onChange={event => selectCheckpoint(event.target.value)}><option value="">Choose a saved checkpoint</option>{checkpoints.items.map(item => <option key={item.key} value={item.key}>{item.createdAt} — {item.title || "Untitled preparation"} ({item.steps} applied steps)</option>)}</select></label>
      <button disabled={busy || hasUnsaved || !checkpoints.items.some(item => item.key === checkpointKey)} onClick={() => void checkpoint(true)}>Restore recovery checkpoint</button>
      {hasUnsaved && checkpoints.items.length > 0 && <p>To restore, close and discard the current unfinished editor, then reopen preparation. Existing checkpoints remain available.</p>}
      {checkpoints.issue && <p role="status">{checkpoints.issue}</p>}
      <CheckpointFiles reportId={draft.id} selectedKey={checkpointKey} busy={busy} onImported={key => { selectCheckpoint(key); setCheckpoints(readCheckpoints()); }} onRemoved={() => { selectCheckpoint(""); setCheckpoints(readCheckpoints()); setMessage("Selected browser checkpoint removed. Your current editor was kept; this action did not save it. Keep its verified backup file."); }}/>
    </section>
    <label>Preparation study<select ref={studyControl} value={studyId} onChange={event => { if (event.target.value !== studyId) requestNavigation({ kind: "study", id: event.target.value }); }}><option value="">Choose an original or prepared study</option>{studies.map(study => <option key={study.id} value={study.id}>{study.title}{study.preparation ? " — saved history" : ""}</option>)}</select></label>
    {issue && <p role="status">{issue}</p>}{source && !issue && <>
      <label>Prepared study name<input maxLength={160} value={title} onChange={event => { invalidate(); setTitle(event.target.value); }} /></label>
      <div className="preparation-columns"><section aria-label="Preparation history"><h3>Applied history ({cursor} steps)</h3><p>Undo/Redo changes this recipe; the original and saved copies remain intact. After Undo, applying a new step replaces the unapplied redo branch.</p><button disabled={busy || cursor === 0} onClick={() => move(cursor - 1)}>Undo preparation step</button><button disabled={busy || cursor === history.length} onClick={() => move(cursor + 1)}>Redo preparation step</button>
      <ol>{history.map((step, index) => <li key={step.id} className={index >= cursor ? "preparation-undone" : ""}>{labels[step.kind]} — {source.fields.find(item => item.id === step.fieldId)?.label ?? step.sourceColumn}{step.kind === "recode" && <small>{step.from.map(value => value || "[blank]").join(" + ")} → {step.to || "[blank]"}</small>}{index >= cursor && <strong> Undone</strong>}</li>)}</ol><button disabled={busy || cursor === 0} onClick={() => void build(false)}>Preview current history</button></section>
      <section aria-label="Next preparation step"><h3>Add a step</h3>{hasUnappliedEditor && <p className="preparation-note" role="status">These next-step editor choices have not been applied. Saving a copy saves only applied history.</p>}<label>Preparation field<select value={fieldId} onChange={event => { invalidate(); setFieldId(event.target.value); setFrom([]); }}><option value="">Choose a text or categorical field</option>{source.fields.filter(item => ["text", "categorical"].includes(item.type)).map(item => <option key={item.id} value={item.id}>{item.label} [{item.sourceColumn}]</option>)}</select></label>
      <label>Preparation operation<select value={kind} onChange={event => { invalidate(); setKind(event.target.value as PreparationStep["kind"]); setFrom([]); }} >{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {kind === "recode" && <><p>Choose exact raw codes to combine. Comparisons are case-sensitive, with no numeric coercion. Blank is a deliberate value; recoding to blank makes those responses missing. Altered code labels are removed; the target raw text becomes its displayed category.</p><PreparationCodePicker values={choices} selected={from} fallback={modal} onSelected={values => { invalidate(); setFrom(values); }}/><label>Target raw code<input value={to} maxLength={512} onChange={event => { invalidate(); setTo(event.target.value); }} placeholder="Leave blank only to mark selected codes as missing" /></label></>}
      {fieldMappingIssue && <p role="status">{fieldMappingIssue}</p>}
      <button disabled={busy || !field || !!fieldMappingIssue || cursor >= 30} onClick={() => void build(true)}>Preview new step</button><p>Maximum 30 steps. Preview before applying; no original cells are edited.</p></section></div>
      {preview && <section aria-label="Preparation preview"><h3>{pendingStep ? "Review the proposed next step" : "Review the prepared copy"}</h3><p>{preview.dataset.rowCount.toLocaleString()} retained rows · {preview.changedCells.toLocaleString()} distinct cells changed during this recipe · {preview.affectedRespondents.toLocaleString()} rows affected. Individual step counts can overlap or cancel.</p><ol>{preview.steps.map(item => <li key={item.step.id}>{labels[item.step.kind]}: {item.changed.toLocaleString()} cell changes</li>)}</ol><div className="preparation-table"><table><caption>First 25 final differences from the original, using source row positions</caption><thead><tr><th>Row</th><th>Field</th><th>Original raw value</th><th>Prepared raw value</th></tr></thead><tbody>{preview.examples.map((example, index) => <tr key={index}><td>{example.row}</td><td>{example.field}</td><td>{JSON.stringify(example.before)}</td><td>{JSON.stringify(example.after)}</td></tr>)}</tbody></table></div>{!preview.examples.length && <p>No final raw values differ from the original.</p>}
      <PreparedValues dataset={preview.dataset} fallback={modal}/>{pendingStep ? <button onClick={() => { setHistory([...active, pendingStep]); setCursor(cursor + 1); setChoiceBaseline(preparationChoiceKey(pendingStep.fieldId, pendingStep.kind, [], pendingStep.kind === "recode" ? pendingStep.to : "")); setPendingStep(null); setReviewed(false); setFrom([]); }}>Apply previewed step to history</button> : <label className="preparation-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the transformations and missing-value consequences.</label>}</section>}
    </>}{message && <p role="status" className="preparation-note">{message}</p>}{busy && <p role="status">Checking original source and preparation… <button onClick={() => { invalidate(); setMessage("Preparation canceled. Original data is preserved."); }}>Cancel preparation</button></p>}</div>
    <footer hidden={!!navigation} inert={!!navigation}><small>The original source is checked before creation and when reopening history. Existing analyses keep their original source. Ordinary browser-save status remains authoritative.</small><button disabled={busy || !preview || !!pendingStep || !reviewed || preview.dataset.id === savedId} onClick={() => void save()}>Save prepared study copy</button></footer>
  </section></div>, document.body);
}
