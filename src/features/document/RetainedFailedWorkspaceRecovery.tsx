import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { failedWorkspaceRecoveryJournal } from "./failedWorkspaceRecoveryJournal";
import type { PendingWorkspaceDraft } from "./durableWorkspaceRepository";
import { decodeDurableWorkspace } from "./durableWorkspaceRecovery";

type Journal = typeof failedWorkspaceRecoveryJournal;
export function RetainedFailedWorkspaceRecovery({ journal = failedWorkspaceRecoveryJournal }: { journal?: Journal }) {
  const status = useSyncExternalStore(journal.subscribe, journal.getSnapshot);
  const [copies, setCopies] = useState<PendingWorkspaceDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = useRef(0);
  async function inspect() {
    const token = ++owner.current; setBusy(true);
    try {
      const next = await journal.inspect();
      if (owner.current === token) { setCopies(next); setError(null); }
    } catch {
      if (owner.current === token) setError("Earlier recovery copies could not be inspected. Their storage has not been changed.");
    } finally { if (owner.current === token) setBusy(false); }
  }
  useEffect(() => { void inspect(); return () => { owner.current++; }; }, [journal, status.status === "retained" ? status : null]);
  function download(copy: PendingWorkspaceDraft) {
    try {
      // Preserve original payload bytes, even if decoding for the label fails.
      const raw = JSON.stringify({ kind: "ecofocus-failed-workspace-recovery", version: 1, draft: copy });
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "ecofocus-unsaved-workspace-recovery.json"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setError(null);
    } catch { setError("The recovery copy could not be downloaded. Keep this browser open and retry."); }
  }
  if (!copies.length && !error) return null;
  return <aside className="workspace-save-recovery" aria-label="Retained failed-save recovery copies">
    <h2>Earlier unsaved recovery copies</h2>
    <p>These browser-local, unencrypted copies are not confirmed main saves. They may be older than your current work or already saved by a later retry. Review and download before closing this browser. Nothing is restored or deleted automatically.</p>
    {error && <p role="status">{error}</p>}
    <button type="button" disabled={busy} onClick={() => void inspect()}>{busy ? "Inspecting recovery copies..." : "Inspect recovery copies again"}</button>
    <ul>{copies.map(copy => {
      let label = copy.workspaceId, capturedAt = "Capture time unavailable";
      try { label = decodeDurableWorkspace(copy.payload, copy.workspaceId).label || label; } catch { label = "Unreadable workspace payload (original copy available)"; }
      try { const value = JSON.parse(copy.payload); if (typeof value.capturedAt === "string") capturedAt = value.capturedAt; } catch { /* Keep opaque bytes downloadable. */ }
      return <li key={JSON.stringify([copy.workspaceId, copy.editorId])}>
        <span>{label} - {capturedAt} - Capture {copy.sequence}</span>
        <button type="button" onClick={() => download(copy)}>Download recovery copy for {label}</button>
      </li>;
    })}</ul>
  </aside>;
}
