import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../../shared/types/dashboard";

/** Display metadata for a completed background run, not a source-authentication receipt. */
export interface ProfileRunDisplay {
  readonly label: string;
  readonly sourceColumn: string;
  readonly storedRows: number;
  readonly declaredRows: number;
}

export function captureProfileRunDisplay(dataset: ImportedDatasetRecord, field: ImportedDatasetField): ProfileRunDisplay {
  return {
    label: field.variableLabel || field.label,
    sourceColumn: field.sourceColumn,
    storedRows: dataset.rows.length ? dataset.rows.length : dataset.previewRows.length,
    declaredRows: dataset.rowCount
  };
}
