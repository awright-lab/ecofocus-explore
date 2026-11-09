import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
export async function changeSummaryFixture() {
 const rows = ["Answer,Keep,Amount"];
 for (const [keep, counts] of [["Y", [5, 2, 1, 2]], ["N", [1, 4, 1, 4]]] as const)
  counts.forEach((count, index) => { for (let i = 0; i < count; i++) rows.push(`${"ABCD"[index]},${keep},${index + 1}`); });
 const parsed = await importDatasetBuffer(new TextEncoder().encode(rows.join("\n")).buffer, "synthetic-change-summary.csv"), dataset = parsed.dataset!;
 const config = { dataset, field: dataset.fields[0], metric: "count" as const, chartType: "table" as const };
 return { dataset, before: runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "Y" } }), after: runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "N" } }) };
}

export async function zeroBaseChangeFixture(metric: "average" | "percent_selected") {
 const { dataset } = await changeSummaryFixture();
 dataset.rows = [...Array.from({ length: 100 }, () => ({ Answer: "A", Keep: "Y", Amount: "10" })), ...Array.from({ length: 100 }, () => ({ Answer: "A", Keep: "N", Amount: "" }))]; dataset.rowCount = dataset.rows.length;
 dataset.fields[0].valueLabels = { A: "A" };
 const config = { dataset, field: dataset.fields[0], measureField: metric === "average" ? dataset.fields[2] : undefined, metric, chartType: "table" as const };
 const before = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: "Y" } });
 const after = runImportedDatasetQuery({ ...config, filter: { field: dataset.fields[1], value: metric === "average" ? "N" : "NONE" } });
 return { before, after, dataset };
}
