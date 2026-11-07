import { storageKey } from "../builder/builderConstants";
import { decodeStoredWorkspaceSource, legacyWorkspaceStorageKey, workspaceStorageKey, type StoredWorkspaceSource } from "./workspacePersistence";

const sources = [
  { key: workspaceStorageKey, label: "Current workspace", fileStem: "workspace-v2" },
  { key: legacyWorkspaceStorageKey, label: "Legacy workspace", fileStem: "workspace-v1" },
  { key: storageKey, label: "Legacy report", fileStem: "report-v1" },
] as const;
export interface StoredRecoveryCopy {
  key: StoredWorkspaceSource["key"];
  label: string;
  fileStem: string;
  status: "readable" | "damaged" | "missing" | "unavailable";
  raw: string | null;
  summary: { reports: number; pages: number; snapshots: number; currentStudies: number; needsSourceData: boolean; needsRemoteAccess: boolean } | null;
}

// Inspect each format independently. A damaged preferred copy must not hide an
// older copy, or cause that older copy to become the active workspace.
export function inspectStoredWorkspaceCopies(storage?: Pick<Storage, "getItem">): StoredRecoveryCopy[] {
  return sources.map(source => {
    let raw: string | null;
    try { raw = (storage ?? window.localStorage).getItem(source.key); }
    catch { return { ...source, status: "unavailable", raw: null, summary: null }; }
    if (raw === null) return { ...source, status: "missing", raw, summary: null };
    try {
      const workspace = decodeStoredWorkspaceSource({ key: source.key, raw });
      const studies = [...workspace.importedDatasets, ...workspace.reports.flatMap(report => report.draft.importedDatasets), ...workspace.publishedSnapshots.flatMap(snapshot => snapshot.dashboard.importedDatasets)];
      return { ...source, status: "readable", raw, summary: {
        reports: workspace.reports.length, pages: workspace.reports.reduce((sum, report) => sum + report.draft.pages.length, 0),
        snapshots: workspace.publishedSnapshots.length, currentStudies: workspace.importedDatasets.length,
        needsSourceData: studies.some(study => Math.max(study.rows.length, study.previewRows.length) !== study.rowCount || study.fields.length !== study.fieldCount),
        needsRemoteAccess: workspace.datasetConnections.length > 0 || workspace.liveDatasetSources.length > 0 || studies.some(study => Boolean(study.remote)),
      } };
    } catch { return { ...source, status: "damaged", raw, summary: null }; }
  });
}

// JSON escaping retains every original UTF-16 code unit, including unpaired
// surrogates. The source key disambiguates legacy and current recovery formats.
export function createStoredRecoveryDownload(copy: StoredRecoveryCopy) {
  if (copy.raw === null) throw new Error("This saved copy is unavailable for download.");
  return JSON.stringify({ kind: "ecofocus-saved-copy-recovery", version: 1, sourceKey: copy.key, raw: copy.raw });
}
