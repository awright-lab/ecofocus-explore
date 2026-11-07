import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { deferredWorkspaceHistory, type DeferredHistoryEntry, type WorkspaceHistoryStore } from "./deferredWorkspaceHistory";
import { decodeStoredWorkspaceSource, workspaceStorageKey } from "./workspacePersistence";
import { reconcileAcknowledgedHistory } from "./acknowledgedWorkspaceHistory";
import { workspaceSaveSession } from "./workspaceSaveSession";
import { RetainedWorkspaceHistoryReview } from "./RetainedWorkspaceHistoryReview";

function proposal(entry: DeferredHistoryEntry, workspace: DashboardWorkspace) {
  const acknowledged = decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: entry.payload });
  if (acknowledged.id !== entry.workspaceId || !acknowledged.publishedSnapshots.some(snapshot => snapshot.id === entry.snapshotId)) throw new Error("The saved history candidate is inconsistent.");
  return reconcileAcknowledgedHistory(workspace, acknowledged);
}
export function DeferredWorkspaceHistoryRecovery({ workspace, onWorkspaceChange, getWorkspaceRevision, history = deferredWorkspaceHistory }: {
  workspace: DashboardWorkspace | null;
  onWorkspaceChange: (workspace: DashboardWorkspace) => number | void;
  getWorkspaceRevision?: () => number;
  history?: WorkspaceHistoryStore;
}) {
  const pending = useSyncExternalStore(history.subscribe, history.getPending);
  const storage = useSyncExternalStore(history.subscribe, history.getStorageState);
  const needsCloseProtection = pending.some(entry => history.getDurability(entry.id) !== "stored");
  useEffect(() => { void history.initialize().catch(() => {}); }, [history]);
  const [working, setWorking] = useState<number | null>(null), [error, setError] = useState<string | null>(null);
  const latest = useRef(workspace), mounted = useRef(true), owner = useRef<{ token: symbol; workspace: DashboardWorkspace; revision?: number } | null>(null);
  const latestHistory = useRef(history); latestHistory.current = history;
  const archiveOwner = useRef<symbol | null>(null);
  useEffect(() => { setError(null); setWorking(null); return () => { archiveOwner.current = null; owner.current = null; }; }, [history]);
  useEffect(() => { latest.current = workspace; if (owner.current && owner.current.workspace !== workspace) { owner.current = null; setWorking(null); } }, [workspace]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; owner.current = null; }; }, []);
  useEffect(() => {
    if (!needsCloseProtection) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect);
  }, [needsCloseProtection]);
  if (!pending.length && storage.phase !== "opening" && storage.phase !== "failed" && storage.unreadableRecords === 0 && !history.inspectRetained) return null;
  function download(entry: DeferredHistoryEntry) {
    try {
      const text = JSON.stringify({ kind: "ecofocus-acknowledged-history-recovery", version: 1, workspaceId: entry.workspaceId, snapshotId: entry.snapshotId, payload: entry.payload });
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `insightcanvas-saved-history-${entry.id}-recovery.json`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setError(null);
    } catch { setError("The saved history copy could not be downloaded. Keep this tab open and retry."); }
  }
  async function downloadStorageArchive() {
    const source = history, token = Symbol("history-archive"); archiveOwner.current = token;
    try {
      const text = await source.exportRecoveryArchive!();
      if (!mounted.current || latestHistory.current !== source || archiveOwner.current !== token) return;
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      try {
        const link = document.createElement("a"); link.href = url; link.download = "insightcanvas-history-storage-archive.json"; link.click();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setError(null);
    } catch { if (mounted.current && latestHistory.current === source && archiveOwner.current === token) setError("The recovery storage archive could not be downloaded completely. The original records have not been changed. Keep this tab open and retry."); }
    finally { if (archiveOwner.current === token) archiveOwner.current = null; }
  }
  async function keep(entry: DeferredHistoryEntry) {
    if (!latest.current || owner.current) return;
    const sourceHistory = history;
    let next: DashboardWorkspace;
    try {
      const current = workspaceSaveSession.getPending() ?? latest.current;
      const result = proposal(entry, current);
      if (result.kind === "needs_review") { setError("These copies need separate review. Download the saved history copy; your current work has not been replaced."); return; }
      next = result.workspace;
    } catch { setError("This saved history copy could not be reconciled safely. Download it for recovery."); return; }
    const token = Symbol("history-recovery"); owner.current = { token, workspace: next }; latest.current = next; setWorking(entry.id); setError(null);
    const committedRevision = onWorkspaceChange(next);
    if (owner.current?.token === token) owner.current.revision = typeof committedRevision === "number" ? committedRevision : getWorkspaceRevision?.();
    const ownsSave = () => mounted.current && latestHistory.current === sourceHistory && owner.current?.token === token && (getWorkspaceRevision === undefined || getWorkspaceRevision() === owner.current.revision);
    try {
      const saved = await workspaceSaveSession.saveAsync(next);
      if (!ownsSave()) return;
      if (saved) {
        try { await sourceHistory.acknowledge(entry.id); }
        catch { if (ownsSave()) setError("The workspace was saved, but the recovery copy could not be cleared. It remains available for retry or download."); }
      } else setError("The combined workspace could not be saved. Your edits and the saved history copy remain available. Keep this tab open and retry.");
    } catch {
      if (ownsSave()) { workspaceSaveSession.remember(next); setError("The combined save could not be confirmed. Your edits and the saved history copy remain available."); }
    } finally {
      if (owner.current?.token === token) { owner.current = null; if (mounted.current) setWorking(null); }
    }
  }
  return <aside className="workspace-history-recovery" role={pending.length || storage.phase === "failed" || storage.unreadableRecords ? "alert" : undefined} aria-label="Saved history awaiting review">
    <strong>{pending.length ? "A saved snapshot finished after you left its save." : storage.phase === "opening" ? "Checking browser recovery storage..." : storage.phase === "failed" || storage.unreadableRecords ? "Browser recovery storage needs attention." : "Browser recovery copies"}</strong>
    {pending.length > 0 && <p>{pending.length} saved history {pending.length === 1 ? "copy is" : "copies are"} available for review. {needsCloseProtection ? "Keep this tab open or download a recovery copy before closing." : "Recovery copies are stored in this browser."} Adding history keeps your current drafts and studies.</p>}
    {storage.error && <p>{storage.error}</p>}
    {storage.unreadableRecords > 0 && <p>{storage.unreadableRecords} recovery {storage.unreadableRecords === 1 ? "record could" : "records could"} not be read safely. The original records have not been changed.</p>}
    {storage.unreadableRecords > 0 && history.exportRecoveryArchive && <><p>The storage archive includes original journal records and receipts for manual recovery review. It does not restore a workspace.</p><button type="button" onClick={() => { void downloadStorageArchive(); }}>Download recovery storage archive</button></>}
    {(storage.phase === "failed" || storage.unreadableRecords > 0) && <button type="button" onClick={() => { void history.retryStorage().catch(() => {}); }}>Retry recovery storage</button>}
    {error && <p>{error}</p>}
    {!workspace && <a href="#/">Review in workspace</a>}
    {pending.map(entry => <div key={entry.id} className="workspace-history-actions">
      <span>Saved history copy {entry.id} · {history.getDurability(entry.id) === "stored" ? "Stored in browser recovery" : history.getDurability(entry.id) === "writing" ? "Writing recovery copy..." : history.getDurability(entry.id) === "failed" ? "Recovery storage unconfirmed" : "Kept in this tab"}</span>
      <button type="button" onClick={() => download(entry)}>Download saved history copy {entry.id}</button>
      {workspace && <button type="button" disabled={working !== null} onClick={() => { void keep(entry); }}>{working === entry.id ? "Saving combined workspace..." : `Keep saved history copy ${entry.id}`}</button>}
    </div>)}
    {history.inspectRetained && <RetainedWorkspaceHistoryReview history={history} workspace={workspace} onDownloadArchive={() => { void downloadStorageArchive(); }} />}
  </aside>;
}
