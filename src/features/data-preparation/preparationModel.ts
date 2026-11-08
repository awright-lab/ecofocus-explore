import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { assertStudyPreparation, type PreparationStep, type StudyPreparation } from "../../../shared/types/dataPreparation";
import { createImportedStudyId } from "../../../shared/importedStudyId";
import { normalizeImportedDataset } from "../document/documentModel";

export function preparationSourceIssue(source: ImportedDatasetRecord | undefined): string | null {
  if (!source) return "Choose an original imported study.";
  if (source.preparation) return "Choose the original study to create another preparation; select a prepared study to review its saved history.";
  if (source.remote || source.sourceType !== "local_file" || source.rows.length !== source.rowCount || source.fields.length !== source.fieldCount) return "Preparation requires complete local-file rows and fields. Remote and partial studies are not changed.";
  if (!Number.isSafeInteger(source.rowCount) || source.rowCount < 1 || source.rowCount > 50000 || source.fieldCount > 200 || new Set(source.fields.map(field => field.id)).size !== source.fields.length || new Set(source.fields.map(field => field.sourceColumn)).size !== source.fields.length) return "Use an unambiguous complete study with 1–50,000 rows and up to 200 fields.";
  return null;
}
// Version-1 recipes address exact stored keys. Reading an absent key as blank
// would let a deliberate blank recode shadow a real case-fallback value.
// Refuse that mapping rather than silently change historical replay semantics.
export function preparationFieldMappingIssue(source: ImportedDatasetRecord, field: ImportedDatasetRecord['fields'][number]): string | null {
  const column = field.sourceColumn, lower = column.toLowerCase();
  if (source.rows.some(row => !Object.hasOwn(row, column) && Object.keys(row).some(key => key.toLowerCase() === lower))) {
    return `Preparation needs an exact stored source column for ${JSON.stringify(column.slice(0, 120))}. A row uses a differently cased key. Keep this source and re-import with matching headers before preparing a copy.`;
  }
  return null;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => [key, canonical((value as Record<string, unknown>)[key])]));
  return value;
}
export async function preparationFingerprint(source: ImportedDatasetRecord): Promise<string> {
  const issue = preparationSourceIssue(source); if (issue) throw Error(issue);
  const bytes = new TextEncoder().encode(JSON.stringify(canonical({ id: source.id, title: source.title, importedAt: source.importedAt, fileName: source.fileName, fileType: source.fileType, rowCount: source.rowCount, fieldCount: source.fieldCount, fields: source.fields, rows: source.rows })));
  if (bytes.length > 20 * 1024 * 1024) throw Error("This preparation supports at most 20 MiB of source values and metadata. Original data is preserved.");
  if (!globalThis.crypto?.subtle) throw Error("Source checking is unavailable in this browser. No prepared study was created.");
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export function transformPreparationValue(value: string, step: PreparationStep): string {
  if (step.kind === "trim") return value.trim();
  if (step.kind === "lowercase") return value.toLowerCase();
  if (step.kind === "uppercase") return value.toUpperCase();
  if (step.kind === "collapse_spaces") return value.replace(/\s+/gu, " ").trim();
  return step.from.includes(value) ? step.to : value;
}
export interface PreparationPreview { sourceFingerprint: string; recipe: StudyPreparation; dataset: ImportedDatasetRecord; changedCells: number; affectedRespondents: number; steps: Array<{ step: PreparationStep; changed: number }>; examples: Array<{ row: number; field: string; before: string; after: string }> }
export async function previewPreparation(source: ImportedDatasetRecord, steps: PreparationStep[], title: string, signal?: AbortSignal, id = createImportedStudyId("prepared-study")): Promise<PreparationPreview> {
  const abort = () => { if (signal?.aborted) throw new DOMException("Data preparation canceled. Original data is preserved.", "AbortError"); }; abort();
  const sourceFingerprint = await preparationFingerprint(source); abort();
  if (!title.trim() || title.trim().length > 160) throw Error("Name the prepared study using 1–160 characters.");
  if (id === source.id) throw Error("Prepared studies must have a new identity; the original is preserved.");
  const recipe: StudyPreparation = { version: 1, sourceDatasetId: source.id, sourceImportedAt: source.importedAt, sourceFingerprint, steps: structuredClone(steps) }; assertStudyPreparation(recipe);
  const dataset = structuredClone(source), counts: PreparationPreview["steps"] = [], affected = new Set<number>(), changed = new Set<string>(), examples: PreparationPreview["examples"] = [];
  for (const step of steps) {
    const fields = dataset.fields.filter(field => field.id === step.fieldId && field.sourceColumn === step.sourceColumn), field = fields[0];
    if (fields.length !== 1 || !["text", "categorical"].includes(field.type)) throw Error("Choose one original text or categorical field for each step. Numeric and date transformations are not supported.");
    const mappingIssue = preparationFieldMappingIssue(dataset, field); if (mappingIssue) throw Error(mappingIssue);
    let count = 0; const alteredTargets = new Set<string>();
    for (let offset = 0; offset < dataset.rows.length; offset += 500) {
      abort();
      for (let index = offset; index < Math.min(offset + 500, dataset.rows.length); index++) {
        const row = dataset.rows[index], before = Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : "";
        if (typeof before !== "string" || before.length > 100000) throw Error("A selected source field has an unsupported value. Original data is preserved.");
        const after = transformPreparationValue(before, step);
        if (after !== before) { row[field.sourceColumn] = after; count++; alteredTargets.add(after); affected.add(index); changed.add(`${index}:${field.id}`); }
      }
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    counts.push({ step: structuredClone(step), changed: count });
    // An altered code must not retain a label describing its previous meaning.
    if (field.valueLabels) field.valueLabels = Object.fromEntries(Object.entries(field.valueLabels).filter(([code]) => transformPreparationValue(code, step) === code && !alteredTargets.has(code)));
    const values = dataset.rows.map(row => Object.hasOwn(row, field.sourceColumn) ? row[field.sourceColumn] : ""), distinct = [...new Set(values.filter(value => value.trim()))];
    field.nonEmptyCount = values.filter(value => value.trim()).length; field.distinctCount = distinct.length; field.sampleValues = distinct.slice(0, 5);
    if (step.kind === "recode") { field.type = "categorical"; field.modelingRole = "candidate_dimension"; field.eligibleForFilter = field.eligibleForBanner = field.eligibleForSegment = true; }
  }
  for (let index = 0; index < dataset.rows.length && examples.length < 25; index++) for (const field of dataset.fields) {
    const before = source.rows[index][field.sourceColumn] ?? "", after = dataset.rows[index][field.sourceColumn] ?? "";
    if (before !== after && examples.length < 25) examples.push({ row: index + 1, field: field.label, before, after });
  }
  abort(); if (await preparationFingerprint(source) !== sourceFingerprint) throw Error("The source changed during preparation. Review the current source and preview again."); abort();
  dataset.id = id; dataset.title = title.trim(); dataset.importedAt = new Date().toISOString(); dataset.preparation = recipe;
  dataset.sourceRef = undefined; dataset.importStatus = undefined; dataset.previewRows = dataset.rows.slice(0, 50).map(row => ({ ...row }));
  dataset.notes = [...source.notes, `Prepared copy of ${source.title}; original import ${source.importedAt}; ${steps.length} reversible preparation steps. Altered raw-code labels were removed to avoid misleading meanings.`];
  return { sourceFingerprint, recipe, dataset: normalizeImportedDataset(dataset, 0), changedCells: changed.size, affectedRespondents: affected.size, steps: counts, examples };
}
export async function verifyPreparedStudy(source: ImportedDatasetRecord, prepared: ImportedDatasetRecord): Promise<void> {
  assertStudyPreparation(prepared.preparation); const recipe = prepared.preparation;
  if (!recipe || recipe.sourceDatasetId !== source.id || recipe.sourceImportedAt !== source.importedAt || await preparationFingerprint(source) !== recipe.sourceFingerprint) throw Error("The original preparation source is missing, replaced or changed. The saved prepared copy remains intact; it was not rebound.");
  const replay = await previewPreparation(source, recipe.steps, prepared.title, undefined, prepared.id);
  if (JSON.stringify(canonical({ fields: replay.dataset.fields, rows: replay.dataset.rows })) !== JSON.stringify(canonical({ fields: prepared.fields, rows: prepared.rows }))) throw Error("The prepared copy no longer matches its recorded steps. It remains intact; review the original source separately.");
}
export function samePreparedStudy(left: ImportedDatasetRecord, right: ImportedDatasetRecord): boolean {
  // Persistence can add storage notes/status and representative previews. Keep
  // that existing copy when retrying, while requiring exact analytical content.
  const content = (study: ImportedDatasetRecord) => ({ id: study.id, title: study.title, sourceType: study.sourceType, sourceRef: study.sourceRef, remote: study.remote, fileName: study.fileName, fileType: study.fileType, importMetadata: study.importMetadata, importedAt: study.importedAt, rowCount: study.rowCount, fieldCount: study.fieldCount, fields: study.fields, rows: study.rows, preparation: study.preparation });
  return JSON.stringify(canonical(content(left))) === JSON.stringify(canonical(content(right)));
}
