import { fixture } from "./versionedRefreshFixture";
import { previewPreparation } from "../../data-preparation/preparationModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
export async function preparedEvidenceFixture(metric: "count" | "percent_selected" | "average" | "sum" = "average", rows = 12) {
  const context = await fixture(metric), original = context.studies[0];
  if (rows !== 12) {
    const seed = structuredClone(original.rows); original.rows = Array.from({ length: rows }, (_, i) => ({ ...seed[i % seed.length], ID: String(i + 1) })); original.rowCount = rows; original.previewRows = original.rows.slice(0, 50).map(row => ({ ...row }));
    for (const field of original.fields) { const values = original.rows.map(row => row[field.sourceColumn]); field.nonEmptyCount = values.filter(v => v.trim()).length; field.distinctCount = new Set(values.filter(v => v.trim())).size; field.sampleValues = [...new Set(values.filter(v => v.trim()))].slice(0, 5); }
  }
  original.rows[0].Region = " North ";
  const preview = await previewPreparation(original, [
    { id: "trim-region", fieldId: original.fields[1].id, sourceColumn: "Region", kind: "trim", from: [], to: "" },
    { id: "recode-region", fieldId: original.fields[1].id, sourceColumn: "Region", kind: "recode", from: ["North"], to: "North combined" },
  ], "Prepared synthetic region");
  const prepared = preview.dataset, audience = { ...context.draft.savedAudiences![0], datasetId: prepared.id, importedAt: prepared.importedAt };
  const result = runImportedDatasetQuery({ dataset: prepared, field: prepared.fields[1], measureField: metric === "average" || metric === "sum" ? prepared.fields[3] : null, bannerField: prepared.fields[2], filter: { field: prepared.fields[4], value: "Keep" }, audience, metric, chartType: "table" });
  const tile = context.draft.pages[0].tiles[0]; tile.query = structuredClone(result.query); tile.result = result; tile.source = { kind: "importedField", id: "prepared-source", datasetId: prepared.id, fieldId: prepared.fields[1].id, label: "Prepared region" };
  context.studies = [original, prepared]; context.draft.importedDatasets = context.studies; context.draft.savedAudiences = [audience];
  return { context, original, prepared, tile };
}
