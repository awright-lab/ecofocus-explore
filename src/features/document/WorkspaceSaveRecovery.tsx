import { WorkspaceBackupButton } from "./WorkspaceBackupButton";
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
  const failure = useSyncExternalStore(workspaceSaveSession.subscribe, workspaceSaveSession.getFailure);

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
      {failure !== "conflict" && <button type="button" onClick={() => workspaceSaveSession.retry()}>Retry saving</button>}
      <WorkspaceBackupButton getWorkspace={workspaceSaveSession.getPending} />
    </aside>
  );
}
