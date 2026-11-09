import { useEffect, useRef, useState } from "react";
import { exportPreparationCheckpointFile, importPreparationCheckpointFile, inspectPreparationCheckpointFile, type CheckpointFileInspection } from "./preparationCheckpoint";

type Props = { reportId: string; selectedKey: string; busy: boolean; onImported: (key: string) => void };
export default function CheckpointFiles({ reportId, selectedKey, busy, onImported }: Props) {
  const input = useRef<HTMLInputElement | null>(null), heading = useRef<HTMLHeadingElement | null>(null), cancel = useRef<HTMLButtonElement | null>(null);
  const sequence = useRef(0), reader = useRef<FileReader | null>(null), currentReport = useRef(reportId); currentReport.current = reportId;
  const [reading, setReading] = useState(false), [message, setMessage] = useState("");
  const [inspection, setInspection] = useState<{ text: string; info: CheckpointFileInspection } | null>(null);
  function returnFromCancel() {
    if (document.activeElement !== cancel.current) return;
    const target = input.current && !input.current.disabled ? input.current : heading.current;
    if (target?.isConnected) target.focus();
  }
  useEffect(() => {
    setReading(false); setInspection(null); setMessage("");
    return () => { sequence.current++; const pending = reader.current; reader.current = null; pending?.abort(); };
  }, [reportId]);
  function inspect(file: File | undefined) {
    sequence.current++; const attempt = sequence.current, boundReport = reportId, pending = reader.current; reader.current = null; pending?.abort();
    setInspection(null); setReading(false); setMessage("");
    if (!file) return;
    if (file.size > 512 * 1024) { setMessage("Checkpoint files must be at most 512 KiB. No file contents were loaded or imported."); return; }
    let next: FileReader; try { next = new FileReader(); } catch { setMessage("Checkpoint file reading is unavailable. Nothing was imported."); return; } reader.current = next; setReading(true);
    const owned = () => sequence.current === attempt && currentReport.current === boundReport && reader.current === next;
    const finish = () => { returnFromCancel(); reader.current = null; setReading(false); };
    next.onload = () => {
      if (!owned()) return;
      try {
        if (next.result === null || typeof next.result === "string") throw Error("This checkpoint file could not be read.");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(next.result), info = inspectPreparationCheckpointFile(text, boundReport);
        setInspection({ text, info }); setMessage("Checkpoint file inspected. Nothing has been imported or applied to your editor.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "The checkpoint file could not be inspected. Nothing was imported."); }
      finish();
    };
    next.onerror = () => { if (owned()) { setMessage("The checkpoint file could not be read. Nothing was imported."); finish(); } };
    next.onabort = () => { if (owned()) { setMessage("Checkpoint file inspection canceled. Nothing was imported."); finish(); } };
    try { next.readAsArrayBuffer(file); } catch { if (owned()) { setMessage("The checkpoint file could not be read. Nothing was imported."); finish(); } }
  }
  function cancelInspection() {
    sequence.current++; const pending = reader.current; reader.current = null; pending?.abort(); returnFromCancel(); setReading(false); setMessage("Checkpoint file inspection canceled. Nothing was imported.");
  }
  function download() {
    if (busy || reading || !selectedKey) return;
    let url: string | null = null;
    try {
      const text = exportPreparationCheckpointFile(window.localStorage, reportId, selectedKey), blob = new Blob([text], { type: "application/json;charset=utf-8" });
      url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `ecofocus-preparation-checkpoint-${selectedKey.slice(-36)}.json`; link.hidden = true; document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      setMessage("Checkpoint download requested. Confirm that the file arrived before relying on it. The browser checkpoint was kept; the file contains unencrypted codes and text.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkpoint download could not be started. Your stored copy was kept."); }
    finally { if (url && typeof URL.revokeObjectURL === "function") { const revoke = URL.revokeObjectURL.bind(URL), completed = url; setTimeout(() => revoke(completed), 1000); } }
  }
  function importFile() {
    if (busy || reading || !inspection) return;
    try {
      const result = importPreparationCheckpointFile(window.localStorage, reportId, inspection.text); onImported(result.key);
      setMessage(result.alreadyPresent ? "This exact checkpoint is already in this browser. No additional slot was used; nothing was applied to your editor." : "A new checkpoint copy was imported for this report. Recipe, source binding and original time were kept; its browser identity is new. Your editor and studies were not changed. Restoration separately verifies the original study.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkpoint import could not be confirmed. Existing copies were kept."); }
  }
  return <section aria-labelledby="checkpoint-files-title"><h4 id="checkpoint-files-title" ref={heading} tabIndex={-1}>Checkpoint backup files</h4>
    <p>Checkpoint codes and editor text are stored and downloaded unencrypted. Keep these files private. They contain no complete study: keep the original workspace backup separately. Import requires the same report identity; Restore still checks the original study.</p>
    <button disabled={busy || reading || !selectedKey} onClick={download}>Download selected checkpoint</button>
    <label>Checkpoint backup file<input ref={input} type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; inspect(file); }}/></label>
    <button ref={cancel} disabled={!reading} onClick={cancelInspection}>Cancel checkpoint file inspection</button>
    {reading && <p role="status">Reading checkpoint file; no checkpoint is imported automatically.</p>}
    {inspection && <div aria-label="Checkpoint file inspection"><p>{inspection.info.title || "Untitled preparation"} — {inspection.info.createdAt}. Original study: {inspection.info.sourceId}. {inspection.info.appliedSteps} applied of {inspection.info.totalSteps} retained steps.</p>
      <label>Checkpoint recipe and editor text (unencrypted)<textarea readOnly rows={6} value={inspection.info.editorText}/></label>
      <button disabled={busy || reading} onClick={importFile}>Import inspected checkpoint</button>
    </div>}
    {message && <p role="status">{message}</p>}
    <p>Imports never replace conflicting records or remove old copies. The eight-checkpoint limit includes unreadable records; an exact existing copy uses no new slot. These controls do not delete checkpoints.</p>
  </section>;
}
