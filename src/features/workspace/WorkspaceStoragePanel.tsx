import { useEffect, useRef, useState } from "react";
import { readOriginStorageEstimate, type OriginStorageEstimate } from "./originStorageEstimate";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { measureWorkspaceStorage, readStoredWorkspaceCopy } from "../document/workspacePersistence";

function size(bytes: number) {
  if (bytes >= 1024 ** 4) return `${(bytes / (1024 ** 4)).toFixed(2)} TiB`;
  if (bytes >= 1024 ** 3) return `${(bytes / (1024 ** 3)).toFixed(2)} GiB`;
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function WorkspaceStoragePanel({ workspace }: { workspace: DashboardWorkspace }) {
  const [result, setResult] = useState<{ workspace: DashboardWorkspace; summary: ReturnType<typeof measureWorkspaceStorage>; savedReadFailed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<OriginStorageEstimate | null>(null), [readingCapacity, setReadingCapacity] = useState(false);
  const requestOwner = useRef(0);
  useEffect(() => () => { requestOwner.current += 1; }, []);
  async function checkCapacity() {
    const owner = ++requestOwner.current; setCapacity(null); setReadingCapacity(true);
    const result = await readOriginStorageEstimate();
    if (owner !== requestOwner.current) return;
    setCapacity(result); setReadingCapacity(false);
  }
  function measure() {
    try {
      let saved: string | null = null, savedReadFailed = false;
      try { saved = readStoredWorkspaceCopy(); } catch { savedReadFailed = true; }
      setResult({ workspace, summary: measureWorkspaceStorage(workspace, saved), savedReadFailed }); setError(null);
    } catch { setResult(null); setError("Storage details could not be measured. Your data has not been changed."); }
  }
  const summary = result?.summary;
  return <details className="workspace-storage-panel">
    <summary>Workspace storage</summary>
    <p>See how current studies and historical snapshots contribute to your browser save.</p>
    <button type="button" className="workspace-home-secondary" onClick={measure}>{result ? "Refresh storage details" : "Measure storage details"}</button>
    <button type="button" className="workspace-home-secondary" onClick={() => void checkCapacity()}>Check browser storage estimate</button>
    {readingCapacity && <p role="status">Reading browser storage estimate…</p>}
    {capacity && <div className="workspace-storage-panel__result" aria-label="Browser storage estimate">
      <p>Browser estimate at the time of this check, shared by storage on this website origin. This is separate from the workspace text estimate.</p>
      {capacity.status === "unavailable" ? <p role="status">{capacity.reason}</p> : <>
        <dl><div><dt>Estimated origin usage</dt><dd>{size(capacity.usage)}</dd></div><div><dt>Reported origin quota</dt><dd>{size(capacity.quota)}</dd></div><div><dt>Estimated quota used</dt><dd>{new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(capacity.fraction)}</dd></div></dl>
        {capacity.nearQuota && <p role="alert">The origin's estimated managed storage is at least 85% of its reported quota. Download a workspace backup and keep original study files.</p>}
      </>}
      <p>The browser may omit or estimate storage. Its managed-storage quota does not establish the separate localStorage limit used by current workspace saves. A low estimate does not guarantee that your next save will succeed. No test data was written and no persistence permission was requested.</p>
    </div>}
    {error && <p role="alert">{error}</p>}
    {result && summary && <div className="workspace-storage-panel__result">
      {result.workspace !== workspace && <p role="status">The workspace changed. Refresh these details to measure the latest edits.</p>}
      <dl><div><dt>Current save text</dt><dd>{size(summary.projectedTextBytes)}</dd></div>
        <div><dt>Last saved text</dt><dd>{result.savedReadFailed ? "Unavailable" : summary.savedTextBytes === null ? "No saved copy" : size(summary.savedTextBytes)}</dd></div>
        <div><dt>Report content and metadata</dt><dd>{size(summary.otherTextBytes)}</dd></div>
        <div><dt>Historical snapshots</dt><dd>{summary.snapshotCount.toLocaleString()}</dd></div></dl>
      <p className="workspace-storage-panel__note">Text estimates use two bytes per character. Browser overhead, compression and save limits vary; these figures do not show remaining capacity.</p>
      {result.savedReadFailed && <p role="alert">Browser storage could not be read. Keep this tab open and download a workspace backup.</p>}
      {summary.studies.length ? <div className="workspace-storage-panel__table"><table>
        <caption>Study copies included in the current save</caption><thead><tr><th scope="col">Study and version</th><th scope="col">Stored coverage</th><th scope="col">Text estimate</th></tr></thead>
        <tbody>{summary.studies.map(study => <tr key={study.key}><th scope="row">{study.title}<small>{study.scope}</small></th>
          <td>{study.storedRows.toLocaleString()} / {study.declaredRows.toLocaleString()} rows<br />{study.storedFields.toLocaleString()} / {study.declaredFields.toLocaleString()} fields</td><td>{size(study.textBytes)}</td></tr>)}</tbody>
      </table></div> : <p>No imported study copies are stored in this workspace.</p>}
      <p>Snapshots keep historical study versions separately. Their data is included in the estimate above; removing a current study does not remove its historical versions.</p>
    </div>}
  </details>;
}
