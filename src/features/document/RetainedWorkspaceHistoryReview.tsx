import { useEffect, useId, useRef, useState } from "react";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import type { RetainedHistoryInspection, WorkspaceHistoryStore } from "./deferredWorkspaceHistory";
import { reviewRetainedHistory } from "./retainedHistoryReview";

export function RetainedWorkspaceHistoryReview({ history, workspace, onDownloadArchive }: { history: WorkspaceHistoryStore; workspace: DashboardWorkspace | null; onDownloadArchive: () => void }) {
  const prefix = useId(), owner = useRef<{ history: WorkspaceHistoryStore; token: symbol } | null>(null), currentHistory = useRef(history);
  currentHistory.current = history;
  const [loaded, setLoaded] = useState<{ history: WorkspaceHistoryStore; scan: RetainedHistoryInspection } | null>(null);
  const [working, setWorking] = useState<WorkspaceHistoryStore | null>(null), [failure, setFailure] = useState<{ history: WorkspaceHistoryStore; text: string } | null>(null);
  const [selection, setSelection] = useState(""), [search, setSearch] = useState("");
  const [review, setReview] = useState<{ record: object; workspace: DashboardWorkspace | null; value: ReturnType<typeof reviewRetainedHistory> | null } | null>(null);
  useEffect(() => { owner.current = null; setWorking(null); return () => { owner.current = null; }; }, [history]);
  const scan = loaded?.history === history ? loaded.scan : null;
  const selected = scan?.candidates.find(item => item.id === selection);
  const matching = scan?.candidates.filter(item => `${item.id} ${item.workspaceId} ${item.snapshotId} ${item.capturedAt}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) ?? [];
  const visible = matching.slice(0, 200);
  if (selected && !visible.some(item => item.id === selected.id)) visible.push(selected);
  async function inspect() {
    const source = history, token = Symbol("retained-inspection"); owner.current = { history: source, token }; setWorking(source); setFailure(null);
    try {
      const result = await source.inspectRetained!();
      if (owner.current?.token !== token || currentHistory.current !== source) return;
      setLoaded({ history: source, scan: result }); setSelection(""); setSearch(""); setReview(null);
    } catch {
      if (owner.current?.token === token && currentHistory.current === source) setFailure({ history: source, text: "Retained recovery copies could not be inspected. Original storage has not been changed. Retry or download the storage archive." });
    } finally { if (owner.current?.token === token) { owner.current = null; setWorking(null); } }
  }
  function downloadSelected() {
    if (!selected) return;
    try {
      const text = JSON.stringify({ kind: "ecofocus-acknowledged-history-recovery", version: 1, workspaceId: selected.workspaceId, snapshotId: selected.snapshotId, payload: selected.payload });
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      try { const link = document.createElement("a"); link.href = url; link.download = "insightcanvas-retained-history-recovery.json"; link.click(); }
      finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setFailure(null);
    } catch { setFailure({ history, text: "This retained copy could not be downloaded. Original storage has not been changed. Retry the download." }); }
  }
  return <section className="retained-history-review" aria-label="Retained recovery copies" aria-busy={working === history}>
    <p>Inspect copies retained after earlier saves. Inspection and downloads do not replace current work or restore snapshots.</p>
    <button type="button" disabled={working === history} onClick={() => { void inspect(); }}>{working === history ? "Inspecting retained copies..." : scan ? "Refresh retained copies" : "Inspect retained recovery copies"}</button>
    {history.exportRecoveryArchive && <button type="button" onClick={onDownloadArchive}>Download complete recovery storage archive</button>}
    {failure?.history === history && <p role="status">{failure.text}</p>}
    {scan && <>
      <p role="status">{scan.candidates.length} verified retained {scan.candidates.length === 1 ? "copy" : "copies"}. This is a point-in-time inspection; refresh to see later writes.</p>
      {scan.legacyReceipts > 0 && <p>{scan.legacyReceipts} older {scan.legacyReceipts === 1 ? "receipt contains" : "receipts contain"} only a digest. They cannot reconstruct a missing payload.</p>}
      {scan.unreadableRecords > 0 && <p>{scan.unreadableRecords} retained {scan.unreadableRecords === 1 ? "record needs" : "records need"} separate review. Originals have not been changed; use the storage archive.</p>}
      {scan.candidates.length > 20 && <label htmlFor={`${prefix}-search`}>Find a retained copy<input id={`${prefix}-search`} value={search} onChange={event => setSearch(event.target.value)} /></label>}
      {scan.candidates.length > 0 && <>
        <label htmlFor={`${prefix}-copy`}>Retained copy<select id={`${prefix}-copy`} value={selected?.id ?? ""} onChange={event => { setSelection(event.target.value); setReview(null); }}><option value="">Choose a retained copy</option>{visible.map(item => <option key={item.id} value={item.id}>{item.capturedAt} / {item.workspaceId} / {item.snapshotId} / {item.id}</option>)}</select></label>
        {matching.length > 200 && <p>Showing the first 200 matching copies. Search to narrow the list.</p>}
        {selected && <>
          <button type="button" onClick={() => { try { setReview({ record: selected, workspace, value: reviewRetainedHistory(selected, workspace) }); } catch { setReview({ record: selected, workspace, value: null }); } }}>Review selected copy</button>
          <button type="button" onClick={downloadSelected}>Download selected retained copy</button>
          <p>The download contains the exact retained payload, which may include cached or partial study rows. It does not fetch remote data.</p>
          {review?.record === selected && (review.workspace !== workspace ? <p role="status">The current workspace changed. Review the selected copy again to update the comparison.</p> : review.value ? <div aria-label="Retained copy comparison"><strong>{review.value.title} / {review.value.versionLabel}</strong><p>{review.value.workspaceLabel}: {review.value.reports} {review.value.reports === 1 ? "report" : "reports"}, {review.value.snapshots} {review.value.snapshots === 1 ? "snapshot" : "snapshots"}, {review.value.studies} current study {review.value.studies === 1 ? "copy" : "copies"}.</p><p>{review.value.status} Nothing has been restored.</p></div> : <p>This retained payload is not a supported workspace copy. Download it for separate recovery review.</p>)}
        </>}
      </>}
    </>}
  </section>;
}
