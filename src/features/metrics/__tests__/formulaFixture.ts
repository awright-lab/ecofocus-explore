import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import type { CellFormulaPlan } from "../cellFormulaCommands";
export async function formulaFixture(rows = 1000, numerator = 300, percent = false) {
  const csv = ["Answer,Group,Spend", ...Array.from({ length: rows }, (_, i) => `${i < numerator ? "A" : "B"},${i % 2 ? "X" : "Y"},${i % 31}`)].join("\n");
  const imported = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic-formula.csv"); if (!imported.dataset) throw Error("Fixture import"); const dataset = imported.dataset;
  const draft = structuredClone(initialDashboard); draft.importedDatasets = [dataset]; draft.pages = draft.pages.slice(0, 1); draft.pages[0].elements = [];
  const source = draft.pages[0].tiles[0], result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: percent ? "percent_selected" : "count", chartType: "table" });
  Object.assign(source, { id: "formula-source", name: "Responses", title: "Responses", result, query: structuredClone(result.query), visualization: "table", derivedOutput: undefined, source: { kind: "importedField", id: `${dataset.id}:${dataset.fields[0].id}`, datasetId: dataset.id, fieldId: dataset.fields[0].id, label: "Answer" }, layout: { x: 64, y: 80, width: 1152, height: 520, zIndex: 1 } }); draft.pages[0].tiles = [source];
  const plan: CellFormulaPlan = { reportId: draft.id, sourceId: source.id, definitionId: "formula-test", rowId: result.table.find(row => row.label === "A")!.optionId, comparedRowId: result.table.find(row => row.label === "B")!.optionId, columnId: result.columns[0].id, expression: "A / B * 100", label: "A index vs B", targetId: "", expectedBinding: "" };
  return { draft, source, dataset, plan };
}
