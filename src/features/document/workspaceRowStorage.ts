import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";

type RowStorage = { version: 1; columns: string[]; values: Array<Array<string | null>> };
type StoredDataset = ImportedDatasetRecord & { rowStorage?: RowStorage };

// Store field names once, without sampling or rounding any respondent values.
export function encodeImportedRows(dataset: ImportedDatasetRecord): StoredDataset {
  if (dataset.rows.length <= 50) return dataset;
  const columnNames = new Set<string>();
  for (const row of dataset.rows) for (const column of Object.keys(row)) columnNames.add(column);
  const columns = [...columnNames];
  return {
    ...dataset,
    rows: [],
    rowStorage: {
      version: 1,
      columns,
      values: dataset.rows.map((row) => columns.map((column) => Object.hasOwn(row, column) ? row[column] : null))
    }
  };
}

export function decodeImportedRows(dataset: ImportedDatasetRecord): ImportedDatasetRecord {
  const stored = dataset as StoredDataset;
  if (!Object.hasOwn(stored, "rowStorage")) return dataset;
  const value = stored.rowStorage;
  if (!value || value.version !== 1 || !Array.isArray(value.columns) || !value.columns.every((column) => typeof column === "string") ||
      new Set(value.columns).size !== value.columns.length || !Array.isArray(value.values) ||
      !value.values.every((row) => Array.isArray(row) && row.length === value.columns.length && row.every((cell) => cell === null || typeof cell === "string"))) {
    throw new Error("Saved respondent data has an unsupported or damaged storage format. Your saved data has not been changed.");
  }
  const { rowStorage: _, ...rest } = stored;
  return {
    ...rest,
    rows: value.values.map((row) => Object.fromEntries(value.columns.flatMap((column, index) => row[index] === null ? [] : [[column, row[index]!]])))
  };
}
