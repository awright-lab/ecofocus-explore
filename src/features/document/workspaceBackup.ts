import type { DashboardWorkspace, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { assertJsonSize } from "../../../shared/jsonSizeBudget";

export const workspaceBackupRawChars = 16 * 1024 * 1024;
export const workspaceBackupEnvelopeChars = 32 * 1024 * 1024;
const backupTraversalLimits = { maxNodes: 2_000_000, maxDepth: 96 };
function checkBackupSize(value: unknown, maximum: number) {
  try { assertJsonSize(value, { ...backupTraversalLimits, maxChars: maximum }); }
  catch (error) { throw new Error(`Workspace backup exceeds its supported serialization limits or contains unsupported data. No backup was generated and stored data is unchanged. Keep this tab open and the original study files. ${error instanceof Error ? error.message : ""}`); }
}

export interface WorkspaceBackupStudy {
  scope: string;
  id: string;
  title: string;
  declaredRows: number;
  storedRows: number;
  previewRows: number;
  declaredFields: number;
  storedFields: number;
  rowCoverage: "complete" | "partial" | "inconsistent";
  hasCompleteFields: boolean;
  remoteProvider: string | null;
}

// Portable recovery artifact only. Do not normalize, merge, compact, fetch remote
// rows or write active storage when creating it. Raw damaged saves use the
// separate byte-preserving recovery download.
export function createWorkspaceBackup(workspace: DashboardWorkspace, pendingImports: readonly ImportedDatasetRecord[] = [], createdAt = new Date().toISOString()) {
  // Count all copies and previews before JSON.stringify can repeat large keys
  // into an enormous string. Never truncate, compact or silently omit a scope.
  checkBackupSize([workspace, pendingImports], workspaceBackupRawChars);
  const studies: WorkspaceBackupStudy[] = [];
  function inventory(scope: string, datasets: readonly ImportedDatasetRecord[]) {
    for (const dataset of datasets) {
      const storedRows = dataset.rows.length, previewRows = dataset.previewRows.length;
      const availableRows = Math.max(storedRows, previewRows);
      studies.push({ scope, id: dataset.id, title: dataset.title, declaredRows: dataset.rowCount, storedRows, previewRows,
        declaredFields: dataset.fieldCount, storedFields: dataset.fields.length,
        rowCoverage: availableRows === dataset.rowCount ? "complete" : availableRows < dataset.rowCount ? "partial" : "inconsistent",
        hasCompleteFields: dataset.fields.length === dataset.fieldCount, remoteProvider: dataset.remote?.provider ?? null });
    }
  }
  inventory("workspace", workspace.importedDatasets);
  workspace.reports.forEach(report => inventory(`report:${report.id}`, report.draft.importedDatasets));
  workspace.publishedSnapshots.forEach(snapshot => inventory(`snapshot:${snapshot.id}`, snapshot.dashboard.importedDatasets));
  inventory("pending-imports", pendingImports);
  const backup = { kind: "ecofocus-workspace-backup" as const, version: 1 as const, format: "workspace-v2" as const, createdAt,
    payload: JSON.stringify(workspace), pendingImportsPayload: JSON.stringify(pendingImports),
    inventory: { reports: workspace.reports.length, snapshots: workspace.publishedSnapshots.length, pendingImports: pendingImports.length, studies,
      requiresSourceData: studies.some(study => study.rowCoverage !== "complete" || !study.hasCompleteFields),
      requiresRemoteAccess: workspace.datasetConnections.length > 0 || workspace.liveDatasetSources.length > 0 || studies.some(study => study.remoteProvider !== null) } };
  checkBackupSize(backup, workspaceBackupEnvelopeChars);
  return backup;
}
