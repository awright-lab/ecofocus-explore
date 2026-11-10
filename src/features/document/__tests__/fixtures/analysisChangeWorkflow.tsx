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

const id = "goal13_change_report";
const hasData = [workspaceStorageKey, legacyWorkspaceStorageKey, storageKey].some(key => localStorage.getItem(key) !== null);
const existing = hasData ? loadDashboardWorkspace() : null;
const safe = !existing || existing.reports.length === 1 && existing.reports[0].id === id;
if (safe && !existing) {
  const lines = ["Answer,Breakout,Keep,Spend"];
  for (let row = 0; row < 80; row++) for (let column = 0; column < 10; column++) for (let repeat = 0; repeat < 2; repeat++) lines.push(`Answer ${String(row).padStart(3, "0")},Group ${column},${repeat === 0 && row !== 79 ? "Yes" : "No"},${row + column}`);
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(lines.join("\n")).buffer, "synthetic-change-review.csv");
  if (!dataset) throw Error("Synthetic import failed");
  dataset.title = "Analysis change synthetic study";
  const draft = structuredClone(initialDashboard); draft.id = id; draft.title = "Analysis change acceptance"; draft.importedDatasets = [dataset]; draft.pages = draft.pages.slice(0, 1);
  const page = draft.pages[0], result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], bannerField: dataset.fields[1], metric: "count", chartType: "table" });
  page.id = "original-change-page"; page.title = "Recorded choices"; page.order = 1; page.elements = [];
  page.tiles = [{ ...page.tiles[0], id: "original-change-analysis", name: "Recorded choices", title: "Recorded choices", source: { kind: "importedField", id: `${dataset.id}:${dataset.fields[0].id}`, datasetId: dataset.id, fieldId: dataset.fields[0].id, label: "Answer" }, query: result.query, result, visualization: "table", layout: { x: 64, y: 100, width: 1152, height: 560, zIndex: 1 } }];
  if (!saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }))) throw Error("Synthetic fixture could not be saved");
}
const baseline = safe ? loadDashboardWorkspace() : null;
const baselinePage = JSON.stringify(baseline?.reports[0].draft.pages[0]);
const baselineStudy = JSON.stringify(baseline?.importedDatasets[0]);
if (safe && !window.location.hash) window.history.replaceState(null, "", `#/reports/${id}`);
function Harness() {
  const [inspection, setInspection] = useState("");
  function inspect() {
    const workspace = loadDashboardWorkspace(), draft = workspace.reports[0].draft, study = workspace.importedDatasets[0];
    setInspection(JSON.stringify({ pageUnchanged: JSON.stringify(draft.pages[0]) === baselinePage, studyUnchanged: JSON.stringify(study) === baselineStudy, rows: study.rows.length, fields: study.fields.length, pages: draft.pages, study }));
  }
  return safe ? <><App /><aside aria-label="Synthetic change inspection" style={{ position: "fixed", bottom: 8, left: 8, zIndex: 900, padding: 8, background: "white", border: "1px solid #39784d", maxWidth: 350, maxHeight: 90, overflow: "auto" }}><button onClick={inspect}>Inspect saved change workflow</button><p>1,600 fabricated rows; actual App and local writer.</p><output>{inspection}</output></aside></> : <p>Acceptance stopped: this origin contains another workspace. No data was changed.</p>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
