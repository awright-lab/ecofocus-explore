import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { storageKey } from "../../../builder/builderConstants";
import { createReportRecord, normalizeDashboardWorkspace, loadDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import "../../../../styles.css";
import "../../../../studio.css";

const id = "goal22_numeric_model_report", hasData = [workspaceStorageKey, legacyWorkspaceStorageKey, storageKey].some(key => localStorage.getItem(key) !== null), existing = hasData ? loadDashboardWorkspace() : null;
const safe = !existing || existing.reports.length === 1 && existing.reports[0].id === id;
if (safe && !existing) {
  const headers = ["Respondent_ID", "Region", "Outcome", "PredictorA", "PredictorB", ...Array.from({ length: 25 }, (_, i) => `Other_${i + 1}`)];
  const csv = [headers.join(","), ...Array.from({ length: 1000 }, (_, index) => { const a = index % 17 - 8, b = index * 7 % 23 - 11; return [index + 1, index % 2 ? "North" : "South", 7.5 + 1.25 * a - .8 * b + (index * 13 % 19 - 9) * .03, a, b, ...Array.from({ length: 25 }, (_, i) => (index + i) % 5)].join(","); })].join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic_model_1000x30.csv"); if (!dataset) throw Error("Synthetic import failed");
  const draft = structuredClone(initialDashboard); draft.id = id; draft.title = "Numeric model acceptance"; draft.importedDatasets = [dataset];
  draft.savedAudiences = [{ version: 1, id: "north-model", label: "North respondents", datasetId: dataset.id, importedAt: dataset.importedAt, expression: { kind: "category", fieldId: dataset.fields[1].id, sourceColumn: "Region", values: ["North"], exclude: false } }];
  draft.pages = draft.pages.slice(0, 1); const page = draft.pages[0], result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], metric: "count", chartType: "table" });
  page.id = "original-model-source-page"; page.title = "Original regional analysis"; page.order = 1; page.elements = [];
  page.tiles = [{ ...page.tiles[0], id: "original-model-source-analysis", name: "Original region", title: "Original region", source: { kind: "importedField", id: `${dataset.id}:${dataset.fields[1].id}`, datasetId: dataset.id, fieldId: dataset.fields[1].id, label: "Region" }, query: result.query, result, visualization: "table", layout: { x: 64, y: 100, width: 1152, height: 560, zIndex: 1 } }];
  if (!saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }))) throw Error("Synthetic model workspace save failed");
}
if (safe && !location.hash) history.replaceState(null, "", `#/reports/${id}`);
function Harness() {
  const [inspection, setInspection] = useState("");
  function inspect() { const workspace = loadDashboardWorkspace(); setInspection(JSON.stringify({ study: workspace.importedDatasets[0], pages: workspace.reports[0].draft.pages, audiences: workspace.reports[0].draft.savedAudiences, snapshots: workspace.publishedSnapshots.length })); }
  return safe ? <><App /><aside aria-label="Synthetic model inspection" style={{ position: "fixed", bottom: 8, left: 8, zIndex: 900, padding: 8, background: "white", border: "1px solid #39784d", maxWidth: 370, maxHeight: 90, overflow: "auto" }}><button onClick={inspect}>Inspect saved model workspace</button><p>Fabricated 1,000-row, 30-field study. Actual App and writer. No real respondents.</p><output>{inspection}</output></aside></> : <p>Acceptance stopped: this origin contains another workspace. No data was changed.</p>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
