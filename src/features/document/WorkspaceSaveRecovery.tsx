import { useEffect, useState, useSyncExternalStore } from "react";
import { workspaceSaveFailureMessage, workspaceSaveSession } from "./workspaceSaveSession";

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
