import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { importedRawFieldValue, runImportedDatasetQuery } from "./importedDatasetAnalytics";

export type ImportedCategoricalProfile = { status: "unavailable"; reason: string } | {
  status: "ready"; rows: number; valid: number; blank: number; observedCategories: number; unusedLabels: number;
  categories: Array<{ id: string; label: string; count: number; share: number }>;
  omittedCategories: number; omittedResponses: number;
};

export function buildImportedCategoricalProfile(dataset: ImportedDatasetRecord, field: ImportedDatasetField): ImportedCategoricalProfile {
  if (field.type !== "categorical" && field.modelingRole !== "candidate_dimension") return { status: "unavailable", reason: "Choose a categorical field to inspect its response categories." };
  const rows = dataset.rows.length ? dataset.rows : dataset.previewRows;
  if (rows.length < dataset.rowCount) return { status: "unavailable", reason: "Complete respondent rows are unavailable in this browser. A partial preview cannot establish category counts for the study." };
  try {
  const valid = rows.reduce((count, row) => count + (importedRawFieldValue(row, field).trim() ? 1 : 0), 0);
  if (!valid) return { status: "ready", rows: rows.length, valid: 0, blank: rows.length, observedCategories: 0, unusedLabels: Object.keys(field.valueLabels ?? {}).length, categories: [], omittedCategories: 0, omittedResponses: 0 };
    // Use the same code/label interpretation as a created response table.
    const result = runImportedDatasetQuery({ dataset, field, metric: "count", chartType: "table" });
    const all = result.table.map((row, index) => ({ id: `category_${index}`, label: row.label, count: row.values.summary, share: row.values.summary / valid * 100 }));
    const observed = all.filter(category => category.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    if (observed.reduce((sum, category) => sum + category.count, 0) !== valid) throw new Error("Category counts did not match the valid response base.");
    return { status: "ready", rows: rows.length, valid, blank: rows.length - valid, observedCategories: observed.length,
      unusedLabels: all.length - observed.length, categories: observed.slice(0, 10), omittedCategories: Math.max(0, observed.length - 10),
      omittedResponses: observed.slice(10).reduce((sum, category) => sum + category.count, 0) };
  } catch (error) { return { status: "unavailable", reason: error instanceof Error ? error.message : "The response categories could not be inspected safely." }; }
}

// A count-only projection for worker inspection. It cannot be used as a saved
// source or exported analysis: dataset identity and connection data are omitted.
export function buildCategoricalProfileFromValues(values: readonly string[], field: ImportedDatasetField): ImportedCategoricalProfile {
  const dataset: ImportedDatasetRecord = {
    id: "profile-projection", title: "Selected field values", sourceType: "local_file", fileName: "", fileType: "unknown", importedAt: "",
    rowCount: values.length, fieldCount: 1, fields: [field], rows: values.map(value => ({ [field.sourceColumn]: value })), previewRows: [], modelingStatus: "initial_model", notes: []
  };
  return buildImportedCategoricalProfile(dataset, field);
}
