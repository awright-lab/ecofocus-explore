import { parseImportedNumber } from "./importedNumericValue";
import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";

export const localRowsLimits = { rows: 50000, columns: 200, cells: 500000, characters: 8 * 1024 * 1024, cellCharacters: 65536 } as const;
export type RawColumn = Readonly<{ key: string; label: string }>;
export type LocalRowsSnapshot = Readonly<{ sourceId: string; title: string; importedAt: string; fileName: string; capturedAt: string; columns: readonly RawColumn[]; rows: readonly Readonly<Record<string, string>>[] }>;
export type RawSearch = { field: string; mode: "contains" | "exact" | "json-exact" | "empty" | "missing" | "blank" | "number" | "not-number"; text: string; matchCase: boolean };
export function rawSearchUsesText(mode: RawSearch["mode"]) { return mode === "contains" || mode === "exact" || mode === "json-exact"; }
export function rawSearchDescription(search: RawSearch) {
  if (search.mode === "contains" && search.text === "") return "All rows (no search text)";
  const label = search.mode === "blank" ? "Blank or whitespace string" : search.mode === "number" ? "Parsed finite number" : search.mode === "not-number" ? "Nonblank value not parsed as a number" : search.mode;
  return `${JSON.stringify(search.field)} - ${label}${rawSearchUsesText(search.mode) ? ` ${JSON.stringify(search.text)}` : ""}${rawSearchUsesText(search.mode) && (search.mode === "json-exact" || search.matchCase) ? " (case-sensitive)" : ""}`;
}

type Progress = { phase: "copying" | "verifying" | "searching"; completed: number; total: number };
type Options = { signal?: AbortSignal; onProgress?: (progress: Progress) => void; yieldControl?: () => Promise<void> };
const accepted = new WeakSet<object>();
const yieldDefault = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function check(signal: AbortSignal | undefined, started: number) {
  if (signal?.aborted) throw Error("Inspection canceled. Your study was not changed.");
  if (Date.now() - started > 30000) throw Error("Inspection took too long. Retry explicitly; your study was not changed.");
}
function data(value: unknown): Record<string, PropertyDescriptor> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![null, Object.prototype].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length) throw Error("This inspector requires plain stored records; unsupported data was not changed.");
  const d = Object.getOwnPropertyDescriptors(value);
  if (Object.values(d).some(p => !("value" in p) || !p.enumerable)) throw Error("This inspector refuses executable or hidden record properties. Your study was not changed.");
  return d;
}
function text(value: unknown, max: number, name: string): string { if (typeof value !== "string" || value.length > max) throw Error(`Unsupported ${name}; your study was not changed.`); return value; }
function arrayItem(array: unknown[], i: number): unknown { const d = Object.getOwnPropertyDescriptor(array, String(i)); if (!d || !("value" in d)) throw Error("Stored arrays must be complete data arrays. Your study was not changed."); return d.value; }
function context(dataset: ImportedDatasetRecord | undefined, expectedId: string) {
  if (!dataset) throw Error("The requested study is unavailable. No partial or alternate study was substituted.");
  const d = data(dataset), get = (key: string) => d[key]?.value;
  const id = text(get("id"), 512, "study identity");
  if (!id || id !== expectedId || get("sourceType") !== "local_file" || get("remote")) throw Error("Inspect complete local-file studies only. Remote, partial and alternate sources are not queried or substituted.");
  const ref = get("sourceRef");
  if (ref !== undefined) { const r = data(ref); if (r.kind?.value !== "imported_file" || r.provider?.value !== "local_file" || r.datasetId?.value !== id) throw Error("The recorded source reference disagrees with this local study. No alternate source was used."); }
  const rows = get("rows"), fields = get("fields"), count = get("rowCount"), fieldCount = get("fieldCount");
  if (!Array.isArray(rows) || !Array.isArray(fields) || !Number.isSafeInteger(count) || count < 0 || count > localRowsLimits.rows || rows.length !== count || !Number.isSafeInteger(fieldCount) || fieldCount < 1 || fieldCount > localRowsLimits.columns || fields.length !== fieldCount) throw Error("This inspector needs complete local rows and fields: up to 50,000 rows and 200 fields. Preview rows are not substituted.");
  const columns: RawColumn[] = [], seen = new Set<string>();
  for (let i = 0; i < fields.length; i++) {
    const f = data(arrayItem(fields, i)), key = text(f.sourceColumn?.value, 2048, "stored column name"), label = text(f.variableLabel?.value ?? f.label?.value, 4096, "field label");
    if (!seen.has(key)) { seen.add(key); columns.push({ key, label }); }
  }
  const meta = { sourceId: id, title: text(get("title"), 4096, "study title"), importedAt: text(get("importedAt"), 128, "import timestamp"), fileName: text(get("fileName"), 4096, "source filename"), columns };
  return { rows, meta, signature: JSON.stringify(meta) };
}
function rowValues(row: unknown) {
  const d = data(row), keys = Object.keys(d);
  if (keys.length > localRowsLimits.columns) throw Error("This row exceeds the 200-column inspection limit. Your study was not changed.");
  return keys.map(key => [text(key, 2048, "stored column name"), text(d[key].value, localRowsLimits.cellCharacters, "stored cell value")] as const);
}
export async function captureLocalRows(expectedId: string, current: () => ImportedDatasetRecord | undefined, options: Options = {}): Promise<LocalRowsSnapshot> {
  const started = Date.now(); check(options.signal, started); const initial = context(current(), expectedId), total = initial.rows.length;
  const rows: Readonly<Record<string, string>>[] = [], columns = [...initial.meta.columns], seen = new Set(columns.map(c => c.key));
  let cells = 0, characters = JSON.stringify(initial.meta).length;
  for (let offset = 0; offset < total; offset += 250) {
    check(options.signal, started);
    for (let i = offset; i < Math.min(offset + 250, total); i++) {
      const values = rowValues(arrayItem(initial.rows, i)), copy = Object.create(null) as Record<string, string>;
      cells += values.length;
      for (const [key, value] of values) {
        characters += key.length + value.length;
        if (cells > localRowsLimits.cells || characters > localRowsLimits.characters) throw Error("This read-only inspection supports at most 500,000 stored cells and 8 Mi characters. Your source remains intact.");
        if (!seen.has(key)) { seen.add(key); columns.push({ key, label: "Stored key outside field metadata" }); }
        if (columns.length > localRowsLimits.columns) throw Error("This source exceeds 200 distinct stored columns. No columns were silently omitted.");
        copy[key] = value;
      }
      rows.push(Object.freeze(copy));
    }
    options.onProgress?.({ phase: "copying", completed: rows.length, total });
    await (options.yieldControl ?? yieldDefault)();
  }
  options.onProgress?.({ phase: "verifying", completed: rows.length, total: rows.length });
  await (options.yieldControl ?? yieldDefault)(); check(options.signal, started);
  // Final synchronous verification prevents a mixed snapshot after yielding.
  // No callbacks or awaits run between this comparison and returning the frozen view.
  const latest = context(current(), expectedId);
  if (latest.signature !== initial.signature || latest.rows.length !== rows.length) throw Error("The study changed during inspection. Refresh explicitly; your study was not changed.");
  for (let i = 0; i < rows.length; i++) {
    const values = rowValues(arrayItem(latest.rows, i)), copy = rows[i];
    if (values.length !== Object.keys(copy).length || values.some(([key, value]) => !Object.hasOwn(copy, key) || copy[key] !== value)) throw Error("Stored values changed during inspection. No mixed snapshot was shown; refresh explicitly.");
  }
  check(options.signal, started);
  const snapshot: LocalRowsSnapshot = Object.freeze({ sourceId: initial.meta.sourceId, title: initial.meta.title, fileName: initial.meta.fileName, importedAt: initial.meta.importedAt, capturedAt: new Date().toISOString(), columns: Object.freeze(columns.map(c => Object.freeze(c))), rows: Object.freeze(rows) });
  accepted.add(snapshot); return snapshot;
}
export async function searchLocalRows(snapshot: LocalRowsSnapshot, search: RawSearch, options: Options = {}): Promise<readonly number[]> {
  if (!accepted.has(snapshot) || !snapshot.columns.some(c => c.key === search.field) || !["contains", "exact", "json-exact", "empty", "missing", "blank", "number", "not-number"].includes(search.mode) || typeof search.text !== "string" || (rawSearchUsesText(search.mode) && search.text.length > (search.mode === "json-exact" ? 6 * localRowsLimits.cellCharacters + 2 : 4096)) || typeof search.matchCase !== "boolean") throw Error("Choose a valid snapshot field. Text searches allow 4,096 characters; escaped JSON allows up to 65,536 decoded code units.");
  let decoded = search.text;
  if (search.mode === "json-exact") {
    try { const value: unknown = JSON.parse(search.text); if (typeof value !== "string" || value.length > localRowsLimits.cellCharacters) throw Error(); decoded = value; }
    catch { throw Error('Enter one valid JSON string, including its double quotes. Use \\r for CR, \\n for LF and \\r\\n for CRLF; no stored data was changed.'); }
  }
  const textual = rawSearchUsesText(search.mode), caseSensitive = search.mode === "json-exact" || search.matchCase;
  const started = Date.now(), positions: number[] = [], needle = textual ? (caseSensitive ? decoded : decoded.toLowerCase()) : "";
  for (let offset = 0; offset < snapshot.rows.length; offset += 250) {
    check(options.signal, started);
    for (let i = offset; i < Math.min(offset + 250, snapshot.rows.length); i++) {
      const row = snapshot.rows[i], own = Object.hasOwn(row, search.field), raw = own ? row[search.field] : "", value = textual && !caseSensitive ? raw.toLowerCase() : raw;
      const match = search.mode === "missing" ? !own : search.mode === "empty" ? own && raw === "" : search.mode === "blank" ? own && !raw.trim() : search.mode === "number" ? own && !!raw.trim() && parseImportedNumber(raw) !== null : search.mode === "not-number" ? own && !!raw.trim() && parseImportedNumber(raw) === null : search.mode === "contains" && search.text === "" ? true : own && ((search.mode === "exact" || search.mode === "json-exact") ? value === needle : value.includes(needle));
      if (match) positions.push(i);
    }
    options.onProgress?.({ phase: "searching", completed: Math.min(offset + 250, snapshot.rows.length), total: snapshot.rows.length }); await (options.yieldControl ?? yieldDefault)();
  }
  check(options.signal, started); return Object.freeze(positions);
}
export type StoredFormatMode = "number" | "not-number" | "blank" | "missing";
export type StoredFieldFormatCounts = Readonly<Record<StoredFormatMode, number> & { total: number; empty: number }>;
export async function summarizeStoredFieldFormats(snapshot: LocalRowsSnapshot, field: string, options: Options = {}): Promise<StoredFieldFormatCounts> {
  if (!accepted.has(snapshot) || !snapshot.columns.some(c => c.key === field)) throw Error("Choose a valid snapshot field for format review. No source data changed.");
  const started = Date.now(), counts = { number: 0, "not-number": 0, blank: 0, missing: 0, empty: 0, total: snapshot.rows.length };
  check(options.signal, started);
  for (let offset = 0; offset < snapshot.rows.length; offset += 250) {
    check(options.signal, started);
    for (let i = offset; i < Math.min(offset + 250, snapshot.rows.length); i++) {
      const row = snapshot.rows[i];
      if (!Object.hasOwn(row, field)) { counts.missing++; continue; }
      const raw = row[field];
      if (!raw.trim()) { counts.blank++; if (raw === "") counts.empty++; }
      else if (parseImportedNumber(raw) === null) counts["not-number"]++;
      else counts.number++;
    }
    options.onProgress?.({ phase: "searching", completed: Math.min(offset + 250, snapshot.rows.length), total: snapshot.rows.length });
    await (options.yieldControl ?? yieldDefault)();
  }
  check(options.signal, started);
  return Object.freeze(counts);
}
export function rawPage(length: number, requested: number, size: number) {
  if (!Number.isSafeInteger(length) || length < 0 || !Number.isSafeInteger(size) || size < 1 || size > 50) throw Error("Invalid inspection page bounds.");
  const pages = Math.max(1, Math.ceil(length / size)), page = Math.min(pages - 1, Math.max(0, Number.isSafeInteger(requested) ? requested : 0));
  return { page, pages, start: length ? page * size + 1 : 0, end: Math.min(length, (page + 1) * size) };
}
