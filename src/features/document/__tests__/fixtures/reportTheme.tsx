import { useState } from "react"; import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace, loadDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../../workspacePersistence";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { syntheticStudy } from "./syntheticStudy";
import { chartColor } from "../../../design-system/reportColors";
import "../../../../styles.css"; import "../../../../studio.css";
const id = "goal34_synthetic_report", original = localStorage.getItem(workspaceStorageKey);
const existing = original ? loadDashboardWorkspace() : null;
const safe = !existing || existing.reports.length === 1 && existing.reports[0].id === id;
if (safe && !existing) {
 const { dataset } = await syntheticStudy(1000, 30); const draft = structuredClone(initialDashboard); draft.id = id; draft.title = "Goal 34 synthetic color acceptance"; draft.importedDatasets = [dataset];
 const first = structuredClone(draft.pages[0]); first.id = "color_page_1"; first.title = "Regional totals"; first.elements = []; first.tiles = [first.tiles[0]];
 const result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], measureField: dataset.fields[3], metric: "sum", chartType: "vertical_bar" });
 first.tiles[0] = { ...first.tiles[0], id: "color_tile_1", title: "Spend by region", result, query: result.query, visualization: "vertical_bar", layout: { x: 100, y: 100, width: 1000, height: 650, zIndex: 1 }, appearance: { ...first.tiles[0].appearance, barStyles: {}, barFillMode: "solid", showValueLabels: false } };
 const second = structuredClone(first); second.id = "color_page_2"; second.order = 2; second.title = "Reordered regions"; second.tiles[0].id = "color_tile_2"; second.tiles[0].result.table.reverse();
 draft.pages = [first, second]; const workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }); if (!saveDashboardWorkspace(workspace)) throw new Error("Synthetic workspace could not be saved");
}
if (safe && !window.location.hash.includes("reports")) window.history.replaceState(null, "", `#/reports/${id}`);
function Harness() { const [inspection, setInspection] = useState(""); return safe ? <><App /><aside aria-label="Synthetic acceptance inspection" style={{position:"fixed",bottom:8,left:8,zIndex:9999,padding:10,background:"white",border:"1px solid #39784d",maxWidth:430,maxHeight:150,overflow:"auto"}}><button onClick={() => { const workspace = loadDashboardWorkspace(), draft = workspace.reports[0].draft; setInspection(JSON.stringify({ theme: Boolean(draft.reportColorTheme), slots: draft.reportColorTheme?.slots.length ?? 0, pages: draft.pages.map(page => ({ title: page.title, colors: page.tiles[0].result.table.map((row,index) => ({ id:row.optionId,label:row.label,color:chartColor(page.tiles[0],"rows",row.optionId,index),value:row.values.summary })) })), rows:workspace.importedDatasets[0].rows.length })); }}>Inspect actual saved colors</button><p>Synthetic study only; real App, storage, charts and commands. This origin must contain only this fixture.</p><output>{inspection}</output></aside></> : <p>Acceptance stopped: this origin already contains another workspace. No data was changed.</p>; }
createRoot(document.getElementById("root")!).render(<Harness />);
