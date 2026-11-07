import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import type { ImportedDatasetRecord } from "../../../../../shared/types/dashboard";

export const syntheticStudyCases = [
  { rows: 1000, fields: 30 },
  { rows: 5000, fields: 60 },
  { rows: 10000, fields: 60 },
  { rows: 2000, fields: 250 }
];

// Deterministic, fabricated survey data. No real respondent records or services.
export function syntheticStudyCsv(rows: number, fields: number) {
  const headers = ["Respondent_ID", "Region", "Segment", "Spend",
    ...Array.from({ length: fields - 4 }, (_, index) => `Survey_question_${String(index + 1).padStart(3, "0")}_response`)];
  const regions = ["North", "South", "East", "West"];
  const lines = [headers.join(",")];
  for (let row = 0; row < rows; row++) {
    lines.push([String(row + 1), regions[row % 4], Math.floor(row / 4) % 2 ? "Growth" : "Core", String(row % 100 + 1),
      ...Array.from({ length: fields - 4 }, (_, column) => String((row + column) % 5 + 1))].join(","));
  }
  return lines.join("\n") + "\n";
}

export async function syntheticStudy(rows: number, fields: number) {
  const csv = syntheticStudyCsv(rows, fields);
  const bytes = new TextEncoder().encode(csv);
  const result = await importDatasetBuffer(bytes.buffer, `synthetic_${rows}x${fields}.csv`);
  if (!result.dataset) throw new Error(result.error ?? "Synthetic import failed");
  return { dataset: result.dataset, csvBytes: bytes.length };
}

export function syntheticStudySums(dataset: ImportedDatasetRecord) {
  const result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], measureField: dataset.fields[3],
    bannerField: null, filter: null, chartType: "vertical_bar", metric: "sum" });
  return Object.fromEntries(result.table.map((row) => [row.label, row.values.summary]));
}

export function expectedSyntheticSums(rows: number) {
  if (rows % 100) throw new Error("Fixture size must be a multiple of 100");
  return { North: 1225 * rows / 100, South: 1250 * rows / 100, East: 1275 * rows / 100, West: 1300 * rows / 100 };
}
