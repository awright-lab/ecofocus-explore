import type { ImportedDatasetField, ImportedDatasetRecord } from '../../../shared/types/dashboard';
import { importedCategoryCode } from '../data/importedCategoryCode';
import { importedRawFieldValue } from '../data/importedRawValue';

export interface WaveFieldMapping {
  sourceFieldId: string;
  targetFieldId: string;
  /** Raw answer codes, never display labels. Complete one-to-one mapping. */
  categories: Array<{ source: string; target: string }>;
}
export function waveCategories(study: ImportedDatasetRecord, field: ImportedDatasetField): string[] {
  return [...new Set([...Object.keys(field.valueLabels ?? {}), ...study.rows.map(row => importedCategoryCode(field, importedRawFieldValue(row, field))).filter((value): value is string => value !== null)])].sort();
}
export function validateWaveMapping(source: ImportedDatasetRecord, target: ImportedDatasetRecord, field: ImportedDatasetField, mappings: WaveFieldMapping[]) {
  const entries = mappings.filter(entry => entry.sourceFieldId === field.id);
  if (entries.length !== 1) throw Error(`Map “${field.label}” exactly once before previewing.`);
  const entry = entries[0], matches = target.fields.filter(candidate => candidate.id === entry.targetFieldId);
  if (matches.length !== 1 || mappings.filter(item => item.targetFieldId === entry.targetFieldId).length !== 1)
    throw Error(`The mapping for “${field.label}” is ambiguous. Each target field must be used once.`);
  const next = matches[0];
  if (field.type !== next.type || field.modelingRole !== next.modelingRole || field.sourceFormat !== next.sourceFormat || field.eligibleForFilter !== next.eligibleForFilter || field.eligibleForBanner !== next.eligibleForBanner || field.eligibleForSegment !== next.eligibleForSegment)
    throw Error(`“${field.label}” has incompatible field types, roles or source conventions.`);
  if (field.type === 'numeric') {
    if (entry.categories.length || JSON.stringify(field.valueLabels ?? {}) !== JSON.stringify(next.valueLabels ?? {})) throw Error('Numeric values cannot be recoded during report refresh.');
  } else {
    const oldValues = waveCategories(source, field), newValues = waveCategories(target, next);
    if (entry.categories.length !== oldValues.length || new Set(entry.categories.map(item => item.source)).size !== oldValues.length || new Set(entry.categories.map(item => item.target)).size !== newValues.length || oldValues.length !== newValues.length || entry.categories.some(item => !oldValues.includes(item.source) || !newValues.includes(item.target)))
      throw Error(`Map every raw category of “${field.label}” one-to-one. Unmapped, merged, added or removed categories need a separate review.`);
  }
  return { field: next, entry };
}
