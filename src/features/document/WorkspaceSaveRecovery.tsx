import { useEffect, useState, useSyncExternalStore } from "react";
import { workspaceSaveFailureMessage, workspaceSaveSession } from "./workspaceSaveSession";
import { readStoredWorkspaceCopy } from "./workspacePersistence";

export function WorkspaceLoadRecovery() {
  const [error, setError] = useState<string | null>(null);
  function downloadStoredWorkspace() {
    try {
      const raw = readStoredWorkspaceCopy();
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
  </main>;
}

export function WorkspaceSaveRecovery() {
  const pending = useSyncExternalStore(workspaceSaveSession.subscribe, workspaceSaveSession.getPending);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    function protectUnsavedWork(event: BeforeUnloadEvent) {
      if (!workspaceSaveSession.hasPending()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, []);

  function downloadBackup() {
    const workspace = workspaceSaveSession.getPending();
    if (!workspace) return;
    let url: string | undefined;
    try {
      const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
      url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "insightcanvas-workspace-recovery.json";
      link.click();
      setDownloadError(false);
    } catch {
      setDownloadError(true);
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  }

  if (!pending) return null;
  return (
    <aside className="workspace-save-recovery" role="alert" aria-label="Workspace not saved">
      <div>
        <strong>Changes not saved</strong>
        <p>{workspaceSaveFailureMessage}</p>
        {downloadError && <p>Backup download failed. Keep this tab open and retry.</p>}
      </div>
      <button type="button" onClick={() => workspaceSaveSession.retry()}>Retry saving</button>
      <button type="button" onClick={downloadBackup}>Download workspace backup</button>
    </aside>
  );
}
