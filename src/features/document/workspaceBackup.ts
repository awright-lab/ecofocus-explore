import type { DashboardWorkspace, ImportedDatasetRecord } from "../../../shared/types/dashboard";

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
export function createWorkspaceBackup(workspace: DashboardWorkspace, pendingImports: ImportedDatasetRecord[] = [], createdAt = new Date().toISOString()) {
  const studies: WorkspaceBackupStudy[] = [];
  function inventory(scope: string, datasets: ImportedDatasetRecord[]) {
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
  return { kind: "ecofocus-workspace-backup" as const, version: 1 as const, format: "workspace-v2" as const, createdAt,
    payload: JSON.stringify(workspace), pendingImportsPayload: JSON.stringify(pendingImports),
    inventory: { reports: workspace.reports.length, snapshots: workspace.publishedSnapshots.length, pendingImports: pendingImports.length, studies,
      requiresSourceData: studies.some(study => study.rowCoverage !== "complete" || !study.hasCompleteFields),
      requiresRemoteAccess: workspace.datasetConnections.length > 0 || workspace.liveDatasetSources.length > 0 || studies.some(study => study.remoteProvider !== null) } };
}
