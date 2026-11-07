import { checkLocalStudyDuplicate, type LocalDuplicateResult } from "../data/localStudyDuplicate";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { runLocalCsvImport, type LocalCsvProgress } from "../data/localCsvImportJob";
import "../significance-review/comparison-review.css";

export function LocalCsvImportDialog({ onAdd, onClose, studies = [], onShowExisting }: {
  onAdd: (dataset: ImportedDatasetRecord) => Promise<boolean>;
  onClose: () => void;
  studies?: readonly ImportedDatasetRecord[];
  onShowExisting?: (id: string) => boolean;
}) {
  const modal = useRef<HTMLElement | null>(null);
  const warning = useRef<HTMLElement | null>(null);
  const owner = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const adding = useRef(false), actionFocus = useRef<HTMLElement | null>(null), parsedPanel = useRef<HTMLElement | null>(null), fileInput = useRef<HTMLInputElement | null>(null), restoreFile = useRef(false);
  const [duplicate, setDuplicate] = useState<LocalDuplicateResult | null>(null);
  const [dataset, setDataset] = useState<ImportedDatasetRecord | null>(null);
  const [progress, setProgress] = useState<LocalCsvProgress | null>(null);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<"saved" | "pending" | "reused" | null>(null);
  const busy = progress !== null;
  const hasWork = busy || (!!dataset && !added);
  const cancelImport = useRef<HTMLButtonElement | null>(null);
  const departingCancel = useRef<HTMLButtonElement | null>(null);
  const bindCancelImport = useCallback((node: HTMLButtonElement | null) => {
    if (!node && cancelImport.current === document.activeElement) departingCancel.current = cancelImport.current;
    cancelImport.current = node;
  }, []);
  useLayoutEffect(() => {
    const departing = departingCancel.current;
    if (!busy && departing) {
      departingCancel.current = null;
      if (!departing.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        (dataset ? parsedPanel.current : fileInput.current)?.focus();
      }
    }
    if (restoreFile.current && !dataset) { restoreFile.current = false; if (!document.activeElement || document.activeElement === document.body) fileInput.current?.focus(); }
    const previous = actionFocus.current;
    if (!previous || saving || (!duplicate && !added && !error)) return;
    actionFocus.current = null;
    if (!previous.isConnected && (!document.activeElement || document.activeElement === document.body)) parsedPanel.current?.focus();
  });
  function requestClose() { if (saving || adding.current) return; if (hasWork) setClosing(true); else onClose(); }
  useModalAccessibility(modal, requestClose);
  useEffect(() => { alive.current = true; return () => { alive.current = false; owner.current?.abort(); }; }, []);
  useEffect(() => { if (closing) warning.current?.focus(); }, [closing]);
  useEffect(() => {
    if (!hasWork && !saving) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [hasWork, saving]);
  async function read(file: File | undefined) {
    if (!file || saving || adding.current) return;
    owner.current?.abort();
    const controller = new AbortController(); owner.current = controller;
    setDataset(null); setDuplicate(null); setAdded(null); setClosing(false); setError(""); setProgress({ phase: "reading" });
    try {
      const parsed = await runLocalCsvImport(file, { signal: controller.signal, onProgress: next => {
        if (alive.current && owner.current === controller && !controller.signal.aborted) setProgress(next);
      } });
      if (alive.current && owner.current === controller && !controller.signal.aborted) setDataset(parsed);
    } catch (failure) {
      if (alive.current && owner.current === controller && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Local import failed. Keep the source file.");
    } finally { if (alive.current && owner.current === controller) setProgress(null); }
  }
  async function add(separate = false, control?: HTMLElement) {
    if (!dataset || busy || saving || added || adding.current) return;
    adding.current = true;
    actionFocus.current = control && document.activeElement === control ? control : null;
    setSaving(true); setError("");
    try {
      if (!separate) {
        const checked = checkLocalStudyDuplicate(dataset, studies);
        if (checked.status !== "no_match") { setDuplicate(checked); return; }
      }
      const saved = await onAdd(dataset);
      if (alive.current) setAdded(saved ? "saved" : "pending");
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : "The study could not be added.");
    } finally { adding.current = false; if (alive.current) setSaving(false); }
  }
  function showExisting(control?: HTMLElement) {
    if (!dataset || duplicate?.status !== "match" || saving || adding.current || !onShowExisting) return;
    actionFocus.current = control && document.activeElement === control ? control : null;
    const fresh = checkLocalStudyDuplicate(dataset, studies);
    if (fresh.status !== "match" || fresh.study.id !== duplicate.study.id || fresh.study.importedAt !== duplicate.study.importedAt) {
      setDuplicate(null); setError("That existing copy changed or is no longer available. Review the import again before choosing a study."); return;
    }
    try {
      if (onShowExisting(fresh.study.id)) setAdded("reused");
      else { setDuplicate(null); setError("The existing study is no longer available. The parsed import was retained."); }
    } catch { setError("The existing study could not be shown. The parsed import was retained."); }
  }
  return createPortal(<div className="comparison-review-backdrop"><section ref={modal} role="dialog" aria-modal="true" aria-labelledby="local-csv-title" tabIndex={-1} className="comparison-review-dialog" data-canvas-keyboard-scope="controls">
    <header><div><small>LOCAL STUDY</small><h2 id="local-csv-title">Import a CSV in this browser</h2><p>Read and review the complete study before adding it to your workspace.</p></div><button onClick={requestClose} disabled={saving}>Close local import</button></header>
    <div className="comparison-review-scroll">
      <p>No file is uploaded by this import. The study uses this browser's workspace storage; it will not be available on another device. Keep the original file and download workspace backups.</p>
      <p>CSV up to 16 MiB, 1 million rows, 5,000 fields and 2 million cells. Very long field names can exceed the expanded-data limit even in a small file. Workspace storage can fill before these limits. Excel and SPSS remain available through Import data.</p>
      {!added && <label>CSV file<input ref={fileInput} type="file" accept=".csv,text/csv" disabled={busy || saving || !!dataset} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void read(file); }} /></label>}
      {busy && <div role="status"><p>{progress.phase === "reading" ? "Reading the local file…" : progress.phase === "parsing" ? "Reading fields and responses…" : `Receiving ${progress.received.toLocaleString()} of ${progress.total.toLocaleString()} rows…`}</p>
        {progress.phase === "receiving" && <progress aria-label="Rows received" value={progress.received} max={progress.total} />}
        <button ref={bindCancelImport} onClick={() => { owner.current?.abort(); setProgress(null); setError("Import canceled. No study was added."); }}>Cancel import</button></div>}
      {error && <p role="alert">{error}</p>}
      {dataset && <section ref={parsedPanel} tabIndex={-1} aria-label="Parsed study"><h3>{dataset.title}</h3><p>{dataset.rowCount.toLocaleString()} rows · {dataset.fieldCount.toLocaleString()} fields</p><p>Fields: {dataset.fields.slice(0, 8).map(field => field.label).join(", ")}{dataset.fields.length > 8 ? ", …" : ""}</p>
        {!added && <>
          {duplicate && duplicate.status !== "no_match" ? <section aria-label="Existing-copy review"><h4>{duplicate.status === "match" ? "An identical local study is already in this workspace" : "The existing-copy check could not finish"}</h4>
            {duplicate.status === "match" ? <p>{duplicate.study.title} — {duplicate.study.rowCount.toLocaleString()} rows, {duplicate.study.fieldCount.toLocaleString()} fields. Imported {duplicate.study.importedAt}. The complete rows, field metadata, title and file name matched at the last check. Existing reports and study IDs will stay as they are.</p> : <p>{duplicate.reason}</p>}
            {duplicate.status === "match" && onShowExisting && <button disabled={saving} onClick={event => showExisting(event.currentTarget)}>Show existing study</button>}
            <button aria-disabled={saving} onClick={event => void add(true, event.currentTarget)}>{saving ? "Saving separate study." : "Import as a separate study"}</button>
            <p>Nothing was added by this check. Choosing a separate study keeps both copies and uses additional browser storage. Keep a separate study for a distinct wave or source, even when its values match.</p>
          </section> : <button aria-disabled={saving} onClick={event => void add(false, event.currentTarget)}>{saving ? "Saving study." : "Add study to workspace"}</button>}
          <button disabled={saving} onClick={event => { if (adding.current) return; restoreFile.current = document.activeElement === event.currentTarget; setDataset(null); setDuplicate(null); setError(""); }}>Discard preview and choose another file</button>
        </>}
      </section>}
      {added && <p role={added === "pending" ? "alert" : "status"}>{added === "reused" ? "The existing study was selected. No additional study was added or saved." : added === "saved" ? "The complete study was added and saved in this browser." : "The complete study was added, but workspace saving failed. It remains pending in this session. Close this dialog and use the workspace save recovery controls before leaving or reloading."}</p>}
      {closing && <section ref={warning} tabIndex={-1} role="alert" aria-label="Discard local import"><h3>Discard this local import?</h3><p>No study will be added. Keep the source CSV to try again.</p><button onClick={() => { setClosing(false); modal.current?.focus(); }}>Keep reviewing import</button> <button onClick={() => { owner.current?.abort(); onClose(); }}>Discard import and close</button></section>}
    </div>
  </section></div>, document.body);
}
