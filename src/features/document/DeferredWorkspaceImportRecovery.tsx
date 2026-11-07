import { useEffect, useSyncExternalStore } from "react";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { deferredWorkspaceImports } from "./deferredWorkspaceImports";
import { upsertWorkspaceImportedDataset } from "./workspacePersistence";
import { workspaceSaveSession } from "./workspaceSaveSession";

export function DeferredWorkspaceImportRecovery({ workspace, onWorkspaceChange }: {
  workspace: DashboardWorkspace | null;
  onWorkspaceChange: (workspace: DashboardWorkspace) => void;
}) {
  const pending = useSyncExternalStore(deferredWorkspaceImports.subscribe, deferredWorkspaceImports.getPending);
  useEffect(() => {
    if (!pending.length) return;
    function protectImport(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    window.addEventListener("beforeunload", protectImport);
    return () => window.removeEventListener("beforeunload", protectImport);
  }, [pending.length]);
  if (!pending.length) return null;
  function addStudies() {
    if (!workspace) return;
    const imports = deferredWorkspaceImports.getPending();
    if (!imports.length) return;
    const next = imports.reduce(upsertWorkspaceImportedDataset, workspace);
    onWorkspaceChange(next);
    workspaceSaveSession.save(next);
    // Failed writes are retained by the shared workspace recovery buffer.
    deferredWorkspaceImports.clear();
  }
  return <aside className="workspace-import-recovery" role="alert" aria-label="Import ready to recover">
    <div><strong>Your imported study is ready to recover.</strong>
      <p>An import finished after you left its screen. {pending.map((item) => item.title).join(", ")} is kept in this tab. Keep this tab open until you add it.</p></div>
    {workspace ? <button type="button" onClick={addStudies}>Add recovered studies</button> : <a href="#/">Return to workspace</a>}
  </aside>;
}
