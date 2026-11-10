import { useState } from "react";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { deferredWorkspaceImports } from "./deferredWorkspaceImports";
import { workspaceSaveSession } from "./workspaceSaveSession";
import { createWorkspaceBackup } from "./workspaceBackup";

export function WorkspaceBackupButton({ getWorkspace, className, onFeedback }: { getWorkspace: () => DashboardWorkspace | null; className?: string; onFeedback?: (text: string, failed: boolean) => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  function feedback(text: string, error: boolean) { setFailed(error); setStatus(text); onFeedback?.(text, error); }
  function download() {
    let url: string | undefined;
    try {
      const workspace = workspaceSaveSession.getPending() ?? getWorkspace();
      if (!workspace) throw new Error("The workspace is unavailable. Keep this tab open and retry.");
      const backup = createWorkspaceBackup(workspace, deferredWorkspaceImports.getPending());
      // createWorkspaceBackup checks this compact envelope's aggregate size.
      url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type: "application/json"}));
      const link = document.createElement("a"); link.href = url; link.download = "ecofocus-workspace-backup.json"; link.click();
      feedback(`Backup prepared. Check your browser's downloads. Includes reports, snapshots and stored study data.${backup.inventory.requiresSourceData ? " Some study rows or fields are missing; keep the original source files." : ""}${backup.inventory.requiresRemoteAccess ? " Connected studies still depend on their configured services." : ""} Backup restoration is not available in this app yet. Imports still in progress are not included.`, false);
    } catch (error) { feedback(`Backup download failed. ${error instanceof Error ? error.message : ""} Keep this tab open and retry.`, true); }
    finally { if (url) window.setTimeout(() => URL.revokeObjectURL(url!), 1000); }
  }
  return <div className="workspace-backup-control">
    <button className={className} type="button" onClick={download} title="Download reports, snapshots and stored study data for recovery. Restore is not yet available.">Download workspace backup</button>
    {status && !onFeedback && <small role={failed ? "alert" : "status"}>{status}</small>}
  </div>;
}
