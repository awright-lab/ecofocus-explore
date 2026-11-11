import { failedWorkspaceRecoveryJournal } from "./failedWorkspaceRecoveryJournal";
import { createStoredRecoveryDownload, inspectStoredWorkspaceCopies, type StoredRecoveryCopy } from "./storedWorkspaceRecovery";
import { WorkspaceBackupButton } from "./WorkspaceBackupButton";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { workspaceSaveFailureMessage, workspaceSaveSession } from "./workspaceSaveSession";

export function WorkspaceLoadRecovery({ inspectCopies = inspectStoredWorkspaceCopies }: { inspectCopies?: () => StoredRecoveryCopy[] } = {}) {
  const [error, setError] = useState<string | null>(null);
  const [copies, setCopies] = useState<StoredRecoveryCopy[] | null>(null);
  function downloadRecoveryCopy(copy: StoredRecoveryCopy) {
    try {
      const url = URL.createObjectURL(new Blob([createStoredRecoveryDownload(copy)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `insightcanvas-${copy.fileStem}-recovery.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(null);
    } catch { setError("The recovery copy could not be downloaded. Keep this browser open and retry."); }
  }
  async function downloadStoredWorkspace() {
    try {
      const raw = await workspaceSaveSession.readSavedWorkspaceCopy();
      if (raw === null) throw new Error("The saved workspace is unavailable. Keep this browser open for recovery.");
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "insightcanvas-saved-workspace-recovery.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Backup download failed."); }
  }
  return <main className="workspace-load-recovery" role="alert">
    <span className="studio-eyebrow">WORKSPACE RECOVERY</span>
    <h1>Your saved workspace needs attention.</h1>
    <p>We could not safely read this workspace. Your saved data has not been replaced or deleted.</p>
    <p>Download the saved copy for recovery before making any changes.</p>
    {error && <p>{error}</p>}
    <button type="button" onClick={downloadStoredWorkspace}>Download saved workspace</button>
    <button type="button" onClick={() => window.location.reload()}>Retry opening</button>
    <button type="button" onClick={() => { setCopies(inspectCopies()); setError(null); }}>Inspect saved copies</button>
    {copies && <section className="workspace-recovery-copies" aria-label="Saved browser copies">
      <h2>Saved browser copies</h2>
      <p>Inspection leaves every saved copy unchanged. Recovery downloads preserve the original text and its format. Restoring a copy is not yet available.</p>
      <ul>{copies.map(copy => <li key={copy.key}>
        <h3>{copy.label}</h3>
        <p>{copy.status === "readable" ? "Readable copy" : copy.status === "damaged" ? "This copy could not be read safely. Its original text is available for recovery." : copy.status === "missing" ? "No saved copy found." : "Browser storage could not be accessed. Retry inspection when access is available."}</p>
        {copy.summary && <>
          <p>Reports: {copy.summary.reports} · Draft pages: {copy.summary.pages} · Snapshots: {copy.summary.snapshots} · Current studies: {copy.summary.currentStudies}</p>
          {copy.summary.needsSourceData && <p>Some study rows or fields are incomplete in this copy.</p>}
          {copy.summary.needsRemoteAccess && <p>This copy references remote data or connections. Their availability has not been verified.</p>}
        </>}
        {copy.raw !== null && <button type="button" onClick={() => downloadRecoveryCopy(copy)}>Download {copy.label.toLowerCase()} recovery copy</button>}
      </li>)}</ul>
    </section>}
  </main>;
}

export function WorkspaceSaveRecovery() {
  const pending = useSyncExternalStore(workspaceSaveSession.subscribe, workspaceSaveSession.getPending);
  const failure = useSyncExternalStore(workspaceSaveSession.subscribe, workspaceSaveSession.getFailure);
  const recovery = useSyncExternalStore(failedWorkspaceRecoveryJournal.subscribe, failedWorkspaceRecoveryJournal.getSnapshot);
  const retryOwner = useRef<symbol | null>(null), retryMounted = useRef(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  useEffect(() => { retryMounted.current = true; return () => { retryMounted.current = false; }; }, []);
  async function retrySave() {
    if (retryOwner.current) return;
    const owner = Symbol("retry");
    retryOwner.current = owner;
    setRetrying(true); setRetryError(null);
    try { await workspaceSaveSession.retryAsync(); }
    catch {
      if (retryMounted.current && retryOwner.current === owner && workspaceSaveSession.getPending() === pending)
        setRetryError("The save could not be confirmed. Your recovery copy remains available.");
    } finally {
      if (retryOwner.current === owner) { retryOwner.current = null; if (retryMounted.current) setRetrying(false); }
    }
  }

  useEffect(() => {
    function protectUnsavedWork(event: BeforeUnloadEvent) {
      if (!workspaceSaveSession.hasPending()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, []);

  if (!pending) return null;
  return (
    <aside className="workspace-save-recovery" role="alert" aria-label="Workspace not saved">
      <div>
        <strong>{failure === "conflict" ? "Another tab changed this workspace" : "Changes not saved"}</strong>
        <p>{failure === "conflict"
          ? "Saving is paused to protect the newer saved workspace. Your edits remain in this tab. Download a backup of these edits before reopening the latest saved workspace; retrying will not overwrite it."
          : workspaceSaveFailureMessage}</p>
      </div>
      {recovery.source === pending && <div role="status">
        <p>{recovery.status === "retained" ? "A separate recovery copy was retained in this browser. The main save still failed. This copy is local and unencrypted; it is not a cloud backup."
          : recovery.status === "saving" ? "Retaining a separate recovery copy. Keep this tab open until it is confirmed."
          : "A recovery copy could not be confirmed. Storage may be unavailable, full, or at its retention limit. Your edits remain in this tab; download a backup."}</p>
        {recovery.status === "failed" && <button type="button" onClick={() => failedWorkspaceRecoveryJournal.retry()}>Retry retaining recovery copy</button>}
      </div>}
      {retryError && <p role="alert">{retryError}</p>}
      {failure !== "conflict" && <button type="button" disabled={retrying} onClick={() => void retrySave()}>{retrying ? "Retrying save..." : "Retry saving"}</button>}
      <WorkspaceBackupButton getWorkspace={workspaceSaveSession.getPending} />
    </aside>
  );
}
