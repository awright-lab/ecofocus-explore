import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { decodeImportedRows } from "./workspaceRowStorage";

// The storage key is the format discriminator. Only pre-v2 saves may omit
// collections or modeling metadata that older versions did not write.
export type SavedWorkspaceFormat = "v1" | "v2";

export function isSavedObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidStudy(): never {
  throw new Error("A saved imported study is incomplete or damaged. Your saved data has not been changed.");
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRows(value: unknown): value is Array<Record<string, string>> {
  return Array.isArray(value) && value.every((row) => isSavedObject(row) && Object.values(row).every((cell) => typeof cell === "string"));
}

function assertField(value: unknown, format: SavedWorkspaceFormat) {
  if (!isSavedObject(value)) invalidStudy();
  // Legacy modeling defaults are safe only when a real source column is known.
  const sourceColumn = format === "v1" && value.sourceColumn === undefined ? value.label : value.sourceColumn;
  if (typeof sourceColumn !== "string" || !sourceColumn) invalidStudy();
  if (value.id !== undefined && (typeof value.id !== "string" || !value.id)) invalidStudy();
  for (const key of ["id", "label", "variableLabel", "sourceFormat"]) {
    if ((format === "v2" && (key === "id" || key === "label") || value[key] !== undefined) && typeof value[key] !== "string") invalidStudy();
  }
  if ((format === "v2" || value.type !== undefined) && !["text", "numeric", "categorical", "date"].includes(value.type as string)) invalidStudy();
  if ((format === "v2" || value.modelingRole !== undefined) && !["raw_variable", "candidate_dimension", "candidate_measure", "candidate_date"].includes(value.modelingRole as string)) invalidStudy();
  for (const key of ["nonEmptyCount", "distinctCount"]) {
    if ((format === "v2" || value[key] !== undefined) && !isCount(value[key])) invalidStudy();
  }
  if ((format === "v2" || value.sampleValues !== undefined) && !isStrings(value.sampleValues)) invalidStudy();
  for (const key of ["eligibleForFilter", "eligibleForSegment", "eligibleForBanner"]) {
    if ((format === "v2" || value[key] !== undefined) && typeof value[key] !== "boolean") invalidStudy();
  }
  if (value.valueLabels !== undefined && (!isSavedObject(value.valueLabels) || !Object.values(value.valueLabels).every((label) => typeof label === "string"))) invalidStudy();
}

function readSavedStudy(value: unknown, format: SavedWorkspaceFormat): ImportedDatasetRecord {
  if (!isSavedObject(value) || typeof value.id !== "string" || !value.id || !isCount(value.rowCount) || !Array.isArray(value.fields)) invalidStudy();
  for (const key of ["title", "fileName", "importedAt"]) {
    if ((format === "v2" || value[key] !== undefined) && typeof value[key] !== "string") invalidStudy();
  }
  if ((format === "v2" || value.fieldCount !== undefined) && (!isCount(value.fieldCount) || value.fields.length > value.fieldCount)) invalidStudy();
  if ((format === "v2" || value.sourceType !== undefined) && !["local_file", "supabase", "netlify"].includes(value.sourceType as string)) invalidStudy();
  if ((format === "v2" || value.fileType !== undefined) && !["csv", "xlsx", "sav", "unknown"].includes(value.fileType as string)) invalidStudy();
  if ((format === "v2" || value.modelingStatus !== undefined) && value.modelingStatus !== "initial_model") invalidStudy();
  if ((format === "v2" || value.notes !== undefined) && !isStrings(value.notes)) invalidStudy();
  value.fields.forEach((field) => assertField(field, format));
  const fieldRecords = value.fields as Array<Record<string, unknown>>;
  if (new Set(fieldRecords.map((field) => field.sourceColumn ?? field.label)).size !== fieldRecords.length ||
      new Set(fieldRecords.map((field, index) => field.id ?? `field_${index + 1}`)).size !== fieldRecords.length) invalidStudy();
  if (value.remote !== undefined) {
    if (!isSavedObject(value.remote) || !["netlify", "supabase"].includes(value.remote.provider as string)) invalidStudy();
    for (const key of ["projectUrl", "bucket", "objectPath", "uploadedAt"]) if (typeof value.remote[key] !== "string") invalidStudy();
    if (value.remote.recordId !== undefined && typeof value.remote.recordId !== "string") invalidStudy();
  }
  if (value.sourceRef !== undefined) {
    if (!isSavedObject(value.sourceRef)) invalidStudy();
    for (const key of ["id", "label", "datasetId", "connectionId", "remoteRecordId", "objectPath"]) {
      const required = format === "v2" && ["id", "label", "datasetId"].includes(key);
      if ((required || value.sourceRef[key] !== undefined) && typeof value.sourceRef[key] !== "string") invalidStudy();
    }
    if ((format === "v2" || value.sourceRef.kind !== undefined) && !["seeded_demo", "imported_file", "workspace_database", "live_connection"].includes(value.sourceRef.kind as string)) invalidStudy();
    if ((format === "v2" || value.sourceRef.provider !== undefined) && !["ecofocus_demo", "local_file", "netlify", "supabase", "snowflake", "postgres"].includes(value.sourceRef.provider as string)) invalidStudy();
  }
  if (value.importStatus !== undefined) {
    if (!isSavedObject(value.importStatus) || !["local_ready", "uploaded", "parsing", "ready", "metadata_only", "failed"].includes(value.importStatus.status as string)) invalidStudy();
    for (const key of ["label", "detail", "updatedAt"]) if (typeof value.importStatus[key] !== "string") invalidStudy();
  }
  if (value.importMetadata !== undefined && (!isSavedObject(value.importMetadata) || typeof value.importMetadata.formatLabel !== "string" ||
      !["raw", "structured", "metadata_rich", "unsupported"].includes(value.importMetadata.metadataQuality as string) || !isStrings(value.importMetadata.parserNotes) ||
      value.importMetadata.sheetName !== undefined && typeof value.importMetadata.sheetName !== "string")) invalidStudy();
  // Do not invent a row payload. v1 explicitly supports preview-only studies,
  // whose declared total remains intact so analysis can reject incomplete data.
  if ((format === "v2" || value.rows !== undefined) && !isRows(value.rows)) invalidStudy();
  if ((format === "v2" || value.previewRows !== undefined) && !isRows(value.previewRows)) invalidStudy();
  if (format === "v1" && value.rows === undefined && value.previewRows === undefined) invalidStudy();
  if (Object.hasOwn(value, "rowStorage") && (!isRows(value.rows) || value.rows.length !== 0)) invalidStudy();
  const decoded = decodeImportedRows(value as unknown as ImportedDatasetRecord);
  const rows = decoded.rows ?? decoded.previewRows ?? [];
  if (rows.length > value.rowCount || (decoded.previewRows?.length ?? 0) > value.rowCount) invalidStudy();
  return { ...decoded, rows, previewRows: decoded.previewRows ?? [] };
}

export function readSavedStudies(value: unknown, format: SavedWorkspaceFormat): ImportedDatasetRecord[] {
  if (value === undefined && format === "v1") return [];
  if (!Array.isArray(value)) invalidStudy();
  const studies = value.map((study) => readSavedStudy(study, format));
  if (new Set(studies.map((study) => study.id)).size !== studies.length) invalidStudy();
  return studies;
}

function sameSavedValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => sameSavedValue(value, right[index]));
  }
  if (!isSavedObject(left) || !isSavedObject(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) =>
    Object.hasOwn(right, key) && sameSavedValue(left[key], right[key]));
}

// Only live workspace/report collections are merged by the loader. Historical
// snapshot studies remain scoped to their own snapshot and may legitimately
// differ. Compare decoded source records before normalization can discard data
// or invent defaults. Exact copies (including different object key ordering or
// row encoding) are safe; uncertain metadata/row differences require recovery.
export function assertConsistentSavedStudies(groups: ImportedDatasetRecord[][]): void {
  const studies = new Map<string, ImportedDatasetRecord>();
  for (const group of groups) {
    for (const study of group) {
      const previous = studies.get(study.id);
      if (previous && !sameSavedValue(previous, study)) {
        throw new Error("Saved imported studies share an ID but contain conflicting data. Your saved data has not been changed.");
      }
      studies.set(study.id, study);
    }
  }
}

// Report updates are keyed by ID. Ambiguous IDs could cause one autosave to
// replace multiple distinct drafts, so reject them before any normalization.
export function assertSavedReportIdentities(reports: Array<{ id?: unknown; draft: { id?: unknown } }>, format: SavedWorkspaceFormat) {
  const seen = new Set<string>();
  for (const [index, report] of reports.entries()) {
    const id = report.id, draftId = report.draft.id;
    if ((id != null && typeof id !== "string") || (draftId != null && typeof draftId !== "string") ||
        (format === "v2" && (typeof id !== "string" || !id || typeof draftId !== "string" || !draftId))) {
      throw new Error("The saved workspace has invalid report IDs. Your saved data has not been changed.");
    }
    // Match normalizeDashboardWorkspace's legacy fallback, including collisions
    // between an explicit ID and an index-generated ID such as report_1.
    const effectiveId = (id as string | null | undefined) || (draftId as string | null | undefined) || `report_${index + 1}`;
    if (seen.has(effectiveId)) throw new Error("The saved workspace has duplicate report IDs. Your saved data has not been changed.");
    seen.add(effectiveId);
  }
}

// Editing and selection use page IDs, then tile/element IDs within that page.
// Copies and snapshot versions intentionally have separate identity scopes.
export function assertSavedCanvasIdentities(pages: Array<Record<string, unknown>>): void {
  const pageIds = new Set<string>();
  for (const page of pages) {
    if (typeof page.id !== "string" || !page.id || pageIds.has(page.id)) {
      throw new Error("The saved report has invalid or duplicate page IDs. Your saved data has not been changed.");
    }
    pageIds.add(page.id);
    const objectIds = new Set<string>();
    for (const item of [...page.tiles as unknown[], ...page.elements as unknown[]]) {
      if (!isSavedObject(item) || typeof item.id !== "string" || !item.id || objectIds.has(item.id)) {
        throw new Error("The saved page has invalid or duplicate object IDs. Your saved data has not been changed.");
      }
      objectIds.add(item.id);
    }
  }
}
