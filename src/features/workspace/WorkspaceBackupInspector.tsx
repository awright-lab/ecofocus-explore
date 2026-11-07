import { useEffect, useRef, useState } from "react";
import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { inspectWorkspaceBackupFile } from "../document/workspaceBackupInspection";

type Inspection = Awaited<ReturnType<typeof inspectWorkspaceBackupFile>>;
export function WorkspaceBackupInspector({ workspace }: { workspace: DashboardWorkspace }) {
  const [result, setResult] = useState<{ value: Inspection; workspace: DashboardWorkspace } | null>(null);
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const owner = useRef<AbortController | null>(null);
  useEffect(() => () => owner.current?.abort(), []);
  useEffect(() => { owner.current?.abort(); setBusy(false); }, [workspace]);
  async function inspect(file: File | undefined) {
    owner.current?.abort(); setResult(null); setError(null); if (!file) { setBusy(false); return; }
    const controller = new AbortController(); owner.current = controller; setBusy(true);
    try {
      const value = await inspectWorkspaceBackupFile(file, workspace, controller.signal);
      if (!controller.signal.aborted && owner.current === controller) setResult({ value, workspace });
    } catch (failure) {
      if (!controller.signal.aborted && owner.current === controller) setError(failure instanceof Error ? failure.message : "This backup could not be inspected. Keep the original file.");
    } finally { if (owner.current === controller) setBusy(false); }
  }
  const summary = result?.value.inspection;
  return <details className="workspace-storage-panel" onToggle={event => { if (!event.currentTarget.open) { owner.current?.abort(); setBusy(false); } }}>
    <summary>Inspect a workspace backup</summary>
    <p>Check a downloaded EcoFocus backup before planning recovery. Inspection stays in this browser and does not save, restore or merge its contents. Restore is not available yet.</p>
    <label>Choose a version-1 workspace backup (JSON, up to 10 MiB)<input type="file" accept=".json,application/json" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void inspect(file); }} /></label>
    {busy && <p role="status">Reading backup… <button type="button" onClick={() => { owner.current?.abort(); setBusy(false); }}>Cancel inspection</button></p>}
    {error && <p role="alert">{error}</p>}
    {result && summary && <div className="workspace-storage-panel__result">
      <h3>{summary.workspaceLabel || "Untitled workspace"}</h3>
      <p>Backup created {summary.createdAt}. {summary.reports.length} reports, {summary.snapshots.length} snapshots, {summary.pendingImports} pending imports. Scoped study copies: {summary.studies.length}.</p>
      <p>These are contents and compatibility checks, not a guarantee that a backup can be restored.</p>
      {result.workspace !== workspace && <p role="status">The current workspace changed. Select the file again to refresh the overlap comparison.</p>}
      {summary.requiresSourceData && <p role="alert">Some study data or fields are incomplete or unreadable. Keep the original source files.</p>}
      {summary.requiresRemoteAccess && <p role="status">This backup contains remote dependencies. No service connection was tested.</p>}
      {summary.currentOverlap && <p>At inspection time: {summary.currentOverlap.sameWorkspaceId ? "same workspace ID" : "different workspace ID"}; {summary.currentOverlap.reportIds.length} matching report IDs; {summary.currentOverlap.studyIds.length} matching live study IDs; {summary.currentOverlap.differentStudyIds.length} study IDs with differing content. Matching IDs do not authorize replacement.</p>}
      {summary.issues.length ? <ul aria-label="Backup inspection warnings">{summary.issues.map((issue, index) => <li key={index}><strong>{issue.scope}:</strong> {issue.message}</li>)}</ul> : <p>No additional structural or identity issues found by these checks. Keep the original backup.</p>}
      {summary.studies.length > 0 && <div className="workspace-storage-panel__table"><table><caption>Study copies remain separate by scope</caption><thead><tr><th scope="col">Study and scope</th><th scope="col">Stored data</th><th scope="col">Coverage</th></tr></thead><tbody>{summary.studies.map((study, index) => <tr key={index}><th scope="row">{study.title ?? "Unreadable study"}<small>{study.scope}</small></th><td>{study.storedRows ?? "Unknown"} / {study.declaredRows ?? "Unknown"} rows; {study.storedFields ?? "Unknown"} / {study.declaredFields ?? "Unknown"} fields</td><td>{study.coverage.replaceAll("_", " ")}</td></tr>)}</tbody></table></div>}
    </div>}
  </details>;
}
