import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { assertStudyPreparation, type PreparationStep } from "../../../shared/types/dataPreparation";
import { preparationFingerprint, preparationFieldMappingIssue } from "./preparationModel";

export type PreparationEditorCheckpoint = {
  sourceId: string; title: string; history: PreparationStep[]; cursor: number;
  fieldId: string; kind: PreparationStep["kind"]; from: string[]; to: string;
};
type Checkpoint = { version: 1; id: string; reportId: string; createdAt: string; sourceFingerprint: string; editor: PreparationEditorCheckpoint };
export type CheckpointListing = { items: { key: string; createdAt: string; title: string; steps: number }[]; issue: string };
const prefix = "ecofocus:preparation-checkpoint:v1:", maxLength = 65536;
const fail = () => { throw Error("This preparation checkpoint is damaged or unsupported. Its stored copy was kept."); };
const text = (value: unknown, max: number, empty = false): value is string => typeof value === "string" && value.length <= max && (empty || value.length > 0);
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function reportPrefix(reportId: string) { if (!text(reportId, 256)) throw Error("This report cannot hold preparation checkpoints."); return prefix + encodeURIComponent(reportId) + ":"; }
function decode(raw: string | null, reportId: string, key: string): Checkpoint {
  if (!raw || raw.length > maxLength) return fail();
  let value: unknown; try { value = JSON.parse(raw); } catch { return fail(); }
  if (!exact(value, ["version", "id", "reportId", "createdAt", "sourceFingerprint", "editor"]) || value.version !== 1 || value.reportId !== reportId || !text(value.id, 36) || !/^[0-9a-f-]{36}$/.test(value.id) || key !== reportPrefix(reportId) + value.id || typeof value.createdAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceFingerprint)) return fail();
  const e = value.editor;
  if (!exact(e, ["sourceId", "title", "history", "cursor", "fieldId", "kind", "from", "to"]) || !text(e.sourceId, 256) || !text(e.title, 160, true) || !Array.isArray(e.history) || e.history.length > 30 || !Number.isInteger(e.cursor) || (e.cursor as number) < 0 || (e.cursor as number) > e.history.length || !text(e.fieldId, 256, true) || !["trim", "lowercase", "uppercase", "collapse_spaces", "recode"].includes(e.kind as string) || !Array.isArray(e.from) || e.from.length > 100 || e.from.some(item => !text(item, 512, true)) || new Set(e.from).size !== e.from.length || !text(e.to, 512, true)) return fail();
  if (e.history.length) {
    if (e.history.some(step => !exact(step, ["id", "fieldId", "sourceColumn", "kind", "from", "to"]))) return fail();
    assertStudyPreparation({ version: 1, sourceDatasetId: e.sourceId, sourceImportedAt: value.createdAt, sourceFingerprint: value.sourceFingerprint, steps: e.history });
  }
  return value as unknown as Checkpoint;
}
function keys(storage: Storage, reportId: string) {
  const start = reportPrefix(reportId); if (storage.length > 20000) throw Error("Browser storage has too many entries to inspect safely. No checkpoints were changed.");
  const found: string[] = []; for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(start)) found.push(key); }
  return found;
}
export function listPreparationCheckpoints(storage: Storage, reportId: string): CheckpointListing {
  const items: CheckpointListing["items"] = []; let damaged = 0;
  try {
    const found = keys(storage, reportId); if (found.length > 20) throw Error("Too many recovery records to inspect safely. All stored copies were kept.");
    for (const key of found) { try { const c = decode(storage.getItem(key), reportId, key); items.push({ key, createdAt: c.createdAt, title: c.editor.title, steps: c.editor.cursor }); } catch { damaged++; } }
    return { items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key)), issue: damaged ? `${damaged} unreadable checkpoint(s) were kept in browser storage; they cannot be restored here.` : "" };
  } catch (error) { return { items: [], issue: error instanceof Error ? error.message : "Checkpoint storage is unavailable. Stored studies were not changed." }; }
}
function checkFields(source: ImportedDatasetRecord, e: PreparationEditorCheckpoint) {
  for (const step of e.history) {
    const field = source.fields.find(f => f.id === step.fieldId && f.sourceColumn === step.sourceColumn && ["text", "categorical"].includes(f.type));
    if (!field || preparationFieldMappingIssue(source, field)) throw Error("A recorded field is unavailable or unsafe to replay. Checkpoint and original study were kept.");
  }
  if (e.fieldId && !source.fields.some(f => f.id === e.fieldId && ["text", "categorical"].includes(f.type))) throw Error("The checkpoint editor field is unavailable. Its stored copy was kept.");
}
function uniqueSource(studies: ImportedDatasetRecord[], id: string) { const matches = studies.filter(s => s.id === id); if (matches.length !== 1) throw Error("The checkpoint's original study is missing or ambiguous. Its stored copy was kept."); return matches[0]; }
function sourceSnapshotText(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.keys(item).sort().filter(key => (item as Record<string, unknown>)[key] !== undefined).map(key => [key, canonical((item as Record<string, unknown>)[key])]));
    return item;
  }
  return JSON.stringify(canonical(value));
}
async function checkpointSourceFingerprint(frozen: ImportedDatasetRecord, sourceBytes: string) {
  // Include full source metadata, not only the preparation engine's projection.
  if (sourceBytes.length > 20 * 1024 * 1024) throw Error("Checkpoint source metadata exceeds the 20 MiB checking limit. Your editor was kept.");
  await preparationFingerprint(frozen);
  const bytes = new TextEncoder().encode(sourceBytes);
  if (bytes.length > 20 * 1024 * 1024) throw Error("Checkpoint source metadata exceeds the 20 MiB checking limit. Your editor was kept.");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function savePreparationCheckpoint(storage: Storage, reportId: string, editor: PreparationEditorCheckpoint, currentStudies: () => ImportedDatasetRecord[], signal?: AbortSignal) {
  // Freeze before awaiting; never checkpoint response rows or duplicate a study.
  const e = structuredClone(editor), source = uniqueSource(currentStudies(), e.sourceId), frozen = structuredClone(source), sourceBytes = sourceSnapshotText(frozen);
  const fingerprint = await checkpointSourceFingerprint(frozen, sourceBytes);
  if (signal?.aborted) throw Error("Checkpoint check canceled. Your editor and existing copies were kept.");
  if (sourceSnapshotText(uniqueSource(currentStudies(), e.sourceId)) !== sourceBytes) throw Error("The original changed while checkpointing. Your editor was kept; retry after reviewing it.");
  if (!crypto.randomUUID) throw Error("Checkpoint identities are unavailable in this browser. Your editor was kept.");
  const id = crypto.randomUUID(), key = reportPrefix(reportId) + id;
  const raw = JSON.stringify({ version: 1, id, reportId, createdAt: new Date().toISOString(), sourceFingerprint: fingerprint, editor: e });
  if (raw.length > maxLength) throw Error("This recipe exceeds the 65,536-character checkpoint limit. Your editor and older checkpoints were kept.");
  decode(raw, reportId, key); checkFields(frozen, e);
  if (keys(storage, reportId).length >= 8) throw Error("This report already has eight recovery checkpoints. All were kept; no older copy was replaced.");
  if (storage.getItem(key) !== null) throw Error("A checkpoint identity already exists. No stored copy was replaced.");
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw Error("Checkpoint storage acknowledgement could not be confirmed. Your editor and any stored copy were kept.");
  return key;
}
export async function restorePreparationCheckpoint(storage: Storage, reportId: string, key: string, currentStudies: () => ImportedDatasetRecord[], signal?: AbortSignal) {
  if (!key.startsWith(reportPrefix(reportId))) throw Error("Choose a checkpoint belonging to this report.");
  const raw = storage.getItem(key), c = decode(raw, reportId, key), source = uniqueSource(currentStudies(), c.editor.sourceId), frozen = structuredClone(source), sourceBytes = sourceSnapshotText(frozen);
  const fingerprint = await checkpointSourceFingerprint(frozen, sourceBytes);
  if (signal?.aborted) throw Error("Checkpoint restore canceled. Your stored copy was kept.");
  if (fingerprint !== c.sourceFingerprint) throw Error("The original study changed since this checkpoint. No recipe was rebound; checkpoint and study were kept.");
  if (storage.getItem(key) !== raw || sourceSnapshotText(uniqueSource(currentStudies(), c.editor.sourceId)) !== sourceBytes) throw Error("The checkpoint or original changed during restoration. Nothing was replaced.");
  checkFields(frozen, c.editor);
  return structuredClone(c.editor);
}

export type CheckpointFileInspection = { key: string; title: string; createdAt: string; sourceId: string; appliedSteps: number; totalSteps: number; editorText: string };
const fileFormat = "EcoFocus preparation checkpoint";
function checkpointFile(text: string, reportId: string) {
  if (typeof text !== "string" || text.length > 196608) throw Error("Checkpoint file is too large or unsupported. No stored checkpoint was changed.");
  let value: unknown; try { value = JSON.parse(text); } catch { throw Error("Choose a valid EcoFocus preparation checkpoint JSON file."); }
  if (!exact(value, ["format", "version", "key", "raw"]) || value.format !== fileFormat || value.version !== 1 || typeof value.key !== "string" || typeof value.raw !== "string") throw Error("This is not a supported preparation checkpoint file. No stored checkpoint was changed.");
  return { key: value.key, raw: value.raw, checkpoint: decode(value.raw, reportId, value.key) };
}
export function exportPreparationCheckpointFile(storage: Storage, reportId: string, key: string) {
  const raw = storage.getItem(key); decode(raw, reportId, key);
  return JSON.stringify({ format: fileFormat, version: 1, key, raw }, null, 2);
}
export function inspectPreparationCheckpointFile(text: string, reportId: string): CheckpointFileInspection {
  const { key, checkpoint: c } = checkpointFile(text, reportId);
  return { key, title: c.editor.title, createdAt: c.createdAt, sourceId: c.editor.sourceId, appliedSteps: c.editor.cursor, totalSteps: c.editor.history.length, editorText: JSON.stringify(c.editor, null, 2) };
}
export function importPreparationCheckpointFile(storage: Storage, reportId: string, text: string) {
  const { key, raw, checkpoint } = checkpointFile(text, reportId), existing = storage.getItem(key);
  if (existing !== null) {
    if (existing !== raw) throw Error("A checkpoint with this identity already has different contents. Both your file and stored copy were kept; nothing was overwritten.");
    return { key, alreadyPresent: true };
  }
  const found = keys(storage, reportId);
  if (found.length > 20) throw Error("Too many recovery records to inspect safely. Existing copies were kept.");
  const signature = (c: Checkpoint) => sourceSnapshotText({ version: c.version, reportId: c.reportId, createdAt: c.createdAt, sourceFingerprint: c.sourceFingerprint, editor: c.editor });
  const incoming = signature(checkpoint);
  for (const candidate of found) {
    try { if (signature(decode(storage.getItem(candidate), reportId, candidate)) === incoming) return { key: candidate, alreadyPresent: true }; }
    catch { /* Unreadable records stay in place and still count toward capacity. */ }
  }
  if (found.length >= 8) throw Error("This report already has eight recovery checkpoints. Nothing was replaced or removed; your file remains available.");
  if (!globalThis.crypto?.randomUUID) throw Error("Checkpoint identities are unavailable. Your file and existing browser copies were kept.");
  const id = crypto.randomUUID(), copyKey = reportPrefix(reportId) + id, copyRaw = JSON.stringify({ ...checkpoint, id });
  decode(copyRaw, reportId, copyKey);
  if (storage.getItem(copyKey) !== null) throw Error("The new checkpoint identity is already occupied. No copy was replaced.");
  storage.setItem(copyKey, copyRaw);
  if (storage.getItem(copyKey) !== copyRaw) throw Error("Checkpoint import acknowledgement could not be confirmed. A stored copy may remain; refresh before retrying. No older copy was removed.");
  return { key: copyKey, alreadyPresent: false };
}
