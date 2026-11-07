import type { DashboardWorkspace, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { isSavedObject, readSavedStudies, assertConsistentSavedStudies } from "./workspaceStorageValidation";
import { decodeStoredWorkspaceSource, workspaceStorageKey } from "./workspacePersistence";

export const maximumBackupInspectionBytes = 10 * 1024 * 1024;
const maximumDepth = 64, maximumStructuralTokens = 500_000;
export interface BackupInspectionIssue { scope: string; message: string; }
export interface InspectedBackupStudy {
  scope: string; id: string | null; title: string | null;
  declaredRows: number | null; storedRows: number | null; previewRows: number | null;
  declaredFields: number | null; storedFields: number | null;
  coverage: "full_rows" | "preview_only" | "partial" | "unreadable";
  remoteProvider: string | null;
}
export interface WorkspaceBackupInspection {
  format: "workspace-v2"; createdAt: string; workspaceId: string; workspaceLabel: string;
  reports: Array<{ id: string | null; title: string | null; pages: number | null }>;
  snapshots: Array<{ id: string | null; title: string | null; version: string | null }>;
  pendingImports: number; studies: InspectedBackupStudy[]; issues: BackupInspectionIssue[];
  requiresSourceData: boolean; requiresRemoteAccess: boolean;
  currentOverlap: { sameWorkspaceId: boolean; reportIds: string[]; studyIds: string[]; differentStudyIds: string[] } | null;
}
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException("Backup inspection canceled.", "AbortError"); }
function parseBounded(text: string, signal?: AbortSignal): unknown {
  let depth = 0, tokens = 0, quoted = false, escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    if ((index & 4095) === 0) aborted(signal);
    const char = text[index];
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === "{" || char === "[") { depth += 1; tokens += 1; }
    else if (char === "}" || char === "]") depth -= 1;
    else if (char === "," || char === ":") tokens += 1;
    if (depth > maximumDepth || tokens > maximumStructuralTokens) throw new Error("This backup exceeds the inspector's nesting or record budget. Keep the original file; no data was changed.");
  }
  aborted(signal); return JSON.parse(text);
}
function text(value: unknown) { return typeof value === "string" ? value : null; }
function objects(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`The backup's ${label} collection is missing or unsupported. Keep the original file.`);
  return value;
}

// Read-only evidence, never a restore candidate. Inventory comes from the raw
// scoped payload, not from its supplied inventory or a normalized merged copy.
export function inspectWorkspaceBackupText(input: string, current: DashboardWorkspace | null = null, signal?: AbortSignal): WorkspaceBackupInspection {
  aborted(signal);
  if (input.length > maximumBackupInspectionBytes || new TextEncoder().encode(input).byteLength > maximumBackupInspectionBytes) throw new Error("Choose a backup no larger than 10 MiB.");
  const envelope = parseBounded(input.replace(/^\uFEFF/, ""), signal);
  if (!isSavedObject(envelope) || envelope.kind !== "ecofocus-workspace-backup" || envelope.version !== 1 || envelope.format !== "workspace-v2" ||
      typeof envelope.createdAt !== "string" || !Number.isFinite(Date.parse(envelope.createdAt)) || typeof envelope.payload !== "string" || typeof envelope.pendingImportsPayload !== "string") {
    throw new Error("Choose a version-1 EcoFocus workspace backup with an explicit workspace-v2 format. Untagged and legacy files are not guessed or converted.");
  }
  const payload = parseBounded(envelope.payload, signal), pending = parseBounded(envelope.pendingImportsPayload, signal);
  if (!isSavedObject(payload) || typeof payload.id !== "string" || !payload.id.trim() || typeof payload.label !== "string" || typeof payload.activeReportId !== "string") throw new Error("The backup workspace identity is missing or unsupported. Keep the original file.");
  const reportRecords = objects(payload.reports, "reports"), snapshotRecords = objects(payload.publishedSnapshots, "snapshots");
  const workspaceStudies = objects(payload.importedDatasets, "studies"), connections = objects(payload.datasetConnections, "connections"), liveSources = objects(payload.liveDatasetSources, "live sources");
  const pendingRecords = objects(pending, "pending imports");
  let unreadableRemoteDependency = false;
  const studies: InspectedBackupStudy[] = [], issues: BackupInspectionIssue[] = [], liveGroups: ImportedDatasetRecord[][] = [];
  function inspectStudies(scope: string, values: unknown[]) {
    const records: ImportedDatasetRecord[] = [], ids = new Set<string>();
    for (const raw of values) {
      aborted(signal);
      try {
        const study = readSavedStudies([raw], "v2")[0];
        if (ids.has(study.id)) issues.push({ scope, message: `Duplicate study ID ${study.id}; copies have been kept separate for inspection.` });
        ids.add(study.id); records.push(study);
        studies.push({ scope, id: study.id, title: study.title, declaredRows: study.rowCount, storedRows: study.rows.length, previewRows: study.previewRows.length,
          declaredFields: study.fieldCount, storedFields: study.fields.length,
          coverage: study.rows.length === study.rowCount ? "full_rows" : study.previewRows.length === study.rowCount ? "preview_only" : "partial", remoteProvider: study.remote?.provider ?? null });
      } catch {
        if (isSavedObject(raw) && raw.remote != null) unreadableRemoteDependency = true;
        issues.push({ scope, message: "A study cannot be read safely. Its original file content has not been changed." });
        studies.push({ scope, id: isSavedObject(raw) ? text(raw.id) : null, title: isSavedObject(raw) ? text(raw.title) : null, declaredRows: null, storedRows: null, previewRows: null, declaredFields: null, storedFields: null, coverage: "unreadable", remoteProvider: null });
      }
    }
    return records;
  }
  liveGroups.push(inspectStudies("workspace", workspaceStudies));
  const reportIds = new Set<string>();
  const reports = reportRecords.map((raw, index) => {
    const record = isSavedObject(raw) ? raw : {}, id = text(record.id), draft = isSavedObject(record.draft) ? record.draft : null;
    if (!id || reportIds.has(id)) issues.push({ scope: `report:${index + 1}`, message: "A report ID is missing or duplicated." });
    if (id) reportIds.add(id);
    if (!draft || !Array.isArray(draft.importedDatasets)) issues.push({ scope: `report:${index + 1}`, message: "The report or its scoped study collection is incomplete." });
    else liveGroups.push(inspectStudies(`report:${id ?? index + 1}`, draft.importedDatasets));
    return { id, title: text(record.title), pages: draft && Array.isArray(draft.pages) ? draft.pages.length : null };
  });
  const snapshotIds = new Set<string>();
  const snapshots = snapshotRecords.map((raw, index) => {
    const record = isSavedObject(raw) ? raw : {}, id = text(record.id), dashboard = isSavedObject(record.dashboard) ? record.dashboard : null;
    if (!id || snapshotIds.has(id)) issues.push({ scope: `snapshot:${index + 1}`, message: "A snapshot ID is missing or duplicated." });
    if (id) snapshotIds.add(id);
    if (typeof record.reportId !== "string" || !reportIds.has(record.reportId)) issues.push({ scope: `snapshot:${id ?? index + 1}`, message: "This snapshot has no matching report in the backup." });
    if (!dashboard || !Array.isArray(dashboard.importedDatasets)) issues.push({ scope: `snapshot:${id ?? index + 1}`, message: "The snapshot or its historical study collection is incomplete." });
    else inspectStudies(`snapshot:${id ?? index + 1}`, dashboard.importedDatasets);
    return { id, title: text(record.title), version: text(record.versionLabel) };
  });
  const pendingStudies = inspectStudies("pending-imports", pendingRecords);
  try { assertConsistentSavedStudies(liveGroups); }
  catch { issues.push({ scope: "workspace/reports", message: "Live study copies share IDs but contain different data or metadata. No copies were merged." }); }
  for (const pendingStudy of pendingStudies) if (liveGroups.some(group => group.some(study => study.id === pendingStudy.id))) issues.push({ scope: "pending-imports", message: `Pending study ${pendingStudy.id} shares an ID with the captured workspace. It remains a separate copy.` });
  try { decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: envelope.payload }); }
  catch { issues.push({ scope: "workspace", message: "The current workspace decoder cannot read this payload without an error. Inspection does not repair or replace it." }); }
  const supplied = isSavedObject(envelope.inventory) ? envelope.inventory : null;
  if (!supplied || supplied.reports !== reports.length || supplied.snapshots !== snapshots.length || supplied.pendingImports !== pendingRecords.length) issues.push({ scope: "inventory", message: "The supplied inventory is missing or differs from the payload. Displayed counts were recomputed." });
  let currentOverlap: WorkspaceBackupInspection["currentOverlap"] = null;
  if (current) {
    const existing = [...current.importedDatasets, ...current.reports.flatMap(report => report.draft.importedDatasets)], shared = new Set<string>(), different = new Set<string>();
    for (const study of liveGroups.flat()) for (const prior of existing) if (study.id === prior.id) {
      shared.add(study.id);
      try { assertConsistentSavedStudies([[study], readSavedStudies(JSON.parse(JSON.stringify([prior])), "v2")]); } catch { different.add(study.id); }
    }
    currentOverlap = { sameWorkspaceId: current.id === payload.id, reportIds: [...reportIds].filter(id => current.reports.some(report => report.id === id)), studyIds: [...shared], differentStudyIds: [...different] };
  }
  aborted(signal);
  return { format: "workspace-v2", createdAt: envelope.createdAt, workspaceId: payload.id, workspaceLabel: payload.label, reports, snapshots, pendingImports: pendingRecords.length, studies, issues,
    requiresSourceData: studies.some(study => study.coverage !== "full_rows" || study.storedFields !== study.declaredFields),
    requiresRemoteAccess: unreadableRemoteDependency || connections.length > 0 || liveSources.length > 0 || studies.some(study => study.remoteProvider !== null), currentOverlap };
}

export async function inspectWorkspaceBackupFile(file: Pick<File, "size" | "arrayBuffer">, current: DashboardWorkspace | null = null, signal?: AbortSignal) {
  aborted(signal);
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > maximumBackupInspectionBytes) throw new Error("Choose a backup no larger than 10 MiB. Oversized files are not read; the original stays untouched.");
  const originalBytes = (await file.arrayBuffer()).slice(0); aborted(signal);
  if (originalBytes.byteLength !== file.size || originalBytes.byteLength > maximumBackupInspectionBytes) throw new Error("The backup read was incomplete or exceeded its declared size. Keep the original file.");
  let decoded: string;
  try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(originalBytes); }
  catch { throw new Error("The backup is not valid UTF-8. Keep its original bytes; no conversion or restore was attempted."); }
  return { inspection: inspectWorkspaceBackupText(decoded, current, signal), originalBytes };
}
