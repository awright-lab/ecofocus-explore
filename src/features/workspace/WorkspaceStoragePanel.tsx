import { useState } from "react";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { measureWorkspaceStorage, readStoredWorkspaceCopy } from "../document/workspacePersistence";

function size(bytes: number) {
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function WorkspaceStoragePanel({ workspace }: { workspace: DashboardWorkspace }) {
  const [result, setResult] = useState<{ workspace: DashboardWorkspace; summary: ReturnType<typeof measureWorkspaceStorage>; savedReadFailed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
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
