import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { failedWorkspaceRecoveryJournal } from "./failedWorkspaceRecoveryJournal";
import type { PendingWorkspaceDraft } from "./durableWorkspaceRepository";
import { decodeDurableWorkspace } from "./durableWorkspaceRecovery";

type Journal = typeof failedWorkspaceRecoveryJournal;
let downloadSequence = 0;
export function RetainedFailedWorkspaceRecovery({ journal = failedWorkspaceRecoveryJournal }: { journal?: Journal }) {
  const status = useSyncExternalStore(journal.subscribe, journal.getSnapshot);
  const [copies, setCopies] = useState<PendingWorkspaceDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const detailsId = useId();
  const toggleButton = useRef<HTMLButtonElement>(null);
  const owner = useRef(0);
  // Label validation can inspect large embedded studies. Do it once per
  // inventory, not again for each hide, reopen or download-feedback update.
  const rows = useMemo(() => copies.map(copy => {
    let label = copy.workspaceId, capturedAt = "Capture time unavailable";
    try { label = decodeDurableWorkspace(copy.payload, copy.workspaceId).label || label; } catch { label = "Unreadable workspace payload (original copy available)"; }
    try { const value = JSON.parse(copy.payload); if (typeof value.capturedAt === "string") capturedAt = value.capturedAt; } catch { /* Keep opaque bytes downloadable. */ }
    return { copy, label, capturedAt };
  }), [copies]);
  async function inspect(manual = false) {
    const token = ++owner.current; setBusy(true);
    try {
      const next = await journal.inspect();
      if (owner.current === token) {
        setCopies(next); setError(null);
        if (manual) setNotice(`Inspection finished: ${next.length} recovery ${next.length === 1 ? "copy" : "copies"} found. Nothing was restored or deleted.`);
      }
    } catch {
      if (owner.current === token) {
        setError("Earlier recovery copies could not be inspected. Their storage has not been changed.");
        setNotice(null); setExpanded(true);
      }
    } finally { if (owner.current === token) setBusy(false); }
  }
  const retainedStatus = status.status === "retained" ? status : null;
  useEffect(() => {
    // Hiding is only a view preference for this mounted session. A newly
    // retained failed save must become visible again, without moving focus.
    if (retainedStatus) { setExpanded(true); setNotice(null); }
    void inspect(); return () => { owner.current++; };
  }, [journal, retainedStatus]);
  function download(copy: PendingWorkspaceDraft) {
    let url: string | undefined, link: HTMLAnchorElement | undefined;
    try {
      // Preserve original payload bytes, even if decoding for the label fails.
      const raw = JSON.stringify({ kind: "ecofocus-failed-workspace-recovery", version: 1, draft: copy });
      const suffix = globalThis.crypto?.randomUUID?.() ?? "local";
      const filename = `ecofocus-unsaved-workspace-recovery-capture-${copy.sequence}-${Date.now()}-${++downloadSequence}-${suffix}.json`;
      url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      link = document.createElement("a"); link.href = url; link.download = filename;
      link.hidden = true; document.body.append(link); link.click();
      setNotice(`Download requested: ${filename}. Check your browser's Downloads list to confirm it finished. The recovery copy is still retained here.`);
      setError(null);
    } catch {
      setNotice(null); setError("The recovery copy could not be downloaded. Keep this browser open and retry.");
    } finally {
      link?.remove();
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
    }
  }
  if (!copies.length && !error && !notice) return null;
  return <aside className="workspace-save-recovery workspace-retained-recovery" aria-label="Retained failed-save recovery copies" onKeyDown={event => {
    if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); setExpanded(false); toggleButton.current?.focus(); }
  }}>
    <div className="workspace-retained-recovery-heading">
      <h2>{expanded ? "Earlier unsaved recovery copies" : copies.length ? `${copies.length} recovery ${copies.length === 1 ? "copy" : "copies"} retained in this browser` : "Recovery copies"}</h2>
      <button ref={toggleButton} type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>{expanded ? "Hide recovery copies" : "Review recovery copies"}</button>
    </div>
    <div id={detailsId} hidden={!expanded}>
      <p>These browser-local, unencrypted copies are not confirmed main saves. They may be older than your current work or already saved by a later retry. Review and download before closing this browser. Hiding this panel only hides the details; it does not save, restore or delete any copy.</p>
      {error && <p role="status">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button type="button" disabled={busy} onClick={() => void inspect(true)}>{busy ? "Inspecting recovery copies..." : "Inspect recovery copies again"}</button>
      <ul>{rows.map(({ copy, label, capturedAt }) => <li key={JSON.stringify([copy.workspaceId, copy.editorId])}>
        <span>{label} - {capturedAt} - Capture {copy.sequence}</span>
        <button type="button" onClick={() => download(copy)}>Download recovery copy for {label}</button>
      </li>)}</ul>
    </div>
  </aside>;
}
