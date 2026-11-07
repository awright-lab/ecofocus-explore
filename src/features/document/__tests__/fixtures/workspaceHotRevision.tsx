import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { storageKey } from "../../../builder/builderConstants";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { commitCellFormula, planFromFormula, previewCellFormula, type CellFormulaPlan } from "../../../metrics/cellFormulaCommands";
import "../../../../styles.css";
import "../../../../studio.css";

const reportId = "isolated_revision_lifecycle_probe";
const existing = [workspaceStorageKey, legacyWorkspaceStorageKey, storageKey].some(key => localStorage.getItem(key) !== null) ? loadDashboardWorkspace() : null;
const safe = !existing || existing.reports.length === 1 && existing.reports[0].id === reportId;
const events: Array<{ at: number; label: string; a: number | undefined; formula: number | undefined; bytes: number }> = [];
const originalWrite = Storage.prototype.setItem;
function details(text: string | null) {
  if (!text) return { label: "No saved revision", a: undefined, formula: undefined, bytes: 0 };
  const workspace = JSON.parse(text), draft = workspace.reports?.[0]?.draft;
  const tiles = draft?.pages?.flatMap((page: { tiles: unknown[] }) => page.tiles) ?? [];
  const source = tiles.find((tile: { id: string }) => tile.id === "revision-source");
  const metric = tiles.find((tile: { derivedOutput?: { kind: string } }) => tile.derivedOutput?.kind === "cell_formula");
  return { label: workspace.label, a: source?.result.table.find((row: { label: string }) => row.label === "A")?.values.summary, formula: metric?.result.table[0].values.summary, bytes: text.length };
}
if (safe) Storage.prototype.setItem = function(key: string, value: string) {
  originalWrite.call(this, key, value);
  if (this === localStorage && key === workspaceStorageKey) events.push({ at: Math.round(performance.now()), ...details(value) });
};
if (safe && !existing) {
  const headers = ["Respondent_ID", "Answer", ...Array.from({ length: 28 }, (_, i) => `Other_${i + 1}`)];
  const csv = [headers.join(","), ...Array.from({ length: 1000 }, (_, i) => [i + 1, i < 300 ? "A" : "B", ...Array.from({ length: 28 }, (_, j) => (i + j) % 7)].join(","))].join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "isolated_revision_1000x30.csv");
  if (!dataset) throw Error("Synthetic import failed");
  let draft = structuredClone(initialDashboard); draft.id = reportId; draft.title = "Isolated revision lifecycle probe"; draft.importedDatasets = [dataset]; draft.pages = draft.pages.slice(0, 1);
  const page = draft.pages[0], result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], metric: "count", chartType: "table" });
  page.elements = []; page.tiles = [{ ...page.tiles[0], id: "revision-source", title: "Synthetic original source", name: "Synthetic original source", derivedOutput: undefined, query: structuredClone(result.query), result, visualization: "table", source: { kind: "importedField", id: `${dataset.id}:${dataset.fields[1].id}`, datasetId: dataset.id, fieldId: dataset.fields[1].id, label: "Answer" } }];
  const a = result.table.find(row => row.label === "A")!, b = result.table.find(row => row.label === "B")!;
  const plan: CellFormulaPlan = { reportId, sourceId: "revision-source", definitionId: "revision-formula", rowId: a.optionId, comparedRowId: b.optionId, columnId: "summary", expression: "A / B * 100", label: "Synthetic index", targetId: "", expectedBinding: "" };
  draft = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create", { tileId: "revision-result", pageId: "revision-result-page" }).draft;
  if (!saveDashboardWorkspace({ ...normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }), label: "Synthetic older revision" })) throw Error("Synthetic seed was not saved");
}
if (!safe) {
  document.getElementById("root")!.textContent = "Stopped: another workspace exists on this origin. No writes or storage instrumentation installed.";
} else {
  if (!location.hash) history.replaceState(null, "", `#/reports/${reportId}`);
  createRoot(document.getElementById("root")!).render(<App />);
  // Separate DOM controls keep inspection from rerendering the real App.
  const panel = document.createElement("aside"); panel.setAttribute("aria-label", "Synthetic revision controls");
  Object.assign(panel.style, { position: "fixed", bottom: "8px", left: "8px", zIndex: "900", background: "white", border: "2px solid #39784d", padding: "8px", maxWidth: "470px", maxHeight: "160px", overflow: "auto" });
  const heading = document.createElement("strong"); heading.textContent = "Isolated synthetic revision probe — 1,000 rows / 30 fields"; panel.append(heading);
  const status = document.createElement("p"); status.setAttribute("role", "status"); panel.append(status);
  const captured = document.createElement("textarea"); captured.setAttribute("aria-label", "Captured revision bytes"); captured.readOnly = true; captured.style.display = "none";
  const instance = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function inspect() { const raw = localStorage.getItem(workspaceStorageKey); captured.value = raw ?? ""; status.textContent = JSON.stringify({ instance, navigation: performance.getEntriesByType("navigation").map(entry => (entry as PerformanceNavigationTiming).type), current: details(raw), writes: events }); }
  function button(label: string, action: () => void) { const node = document.createElement("button"); node.textContent = label; node.onclick = action; panel.append(node); }
  button("Capture saved revision", inspect);
  button("Write newer synthetic revision", () => {
    const workspace = loadDashboardWorkspace(), record = workspace.reports[0], dataset = workspace.importedDatasets[0];
    if (record.id !== reportId || dataset.rows.length !== 1000 || dataset.fields.length !== 30) throw Error("Synthetic scope mismatch");
    if (details(localStorage.getItem(workspaceStorageKey)).a === 200) { status.textContent = "Newer synthetic revision already exists; no repeat write."; return; }
    dataset.rows.forEach((row, i) => { row.Answer = i < 200 ? "A" : "B"; }); dataset.previewRows = dataset.rows.slice(0, 25).map(row => ({ ...row }));
    const source = record.draft.pages.flatMap(page => page.tiles).find(tile => tile.id === "revision-source")!;
    source.result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], metric: "count", chartType: "table" }); source.query = structuredClone(source.result.query); record.draft.importedDatasets = [dataset];
    const definition = record.draft.analysisLibrary.derivedDefinitions.find(item => item.id === "revision-formula")!;
    const plan = planFromFormula(record.draft, definition, "revision-result"); record.draft = commitCellFormula(record.draft, plan, previewCellFormula(record.draft, plan).token, "refresh").draft;
    workspace.label = "Synthetic newer revision";
    const acknowledged = saveDashboardWorkspace(workspace); inspect(); status.textContent = `${acknowledged ? "Acknowledged" : "Unacknowledged"} synthetic foreign write. ${status.textContent}`;
  });
  button("Trigger isolated module reload", () => {
    status.textContent = "Requesting isolated Vite module reload...";
    void fetch("/__synthetic_revision_reload", { method: "POST" }).then(async response => { if (!response.ok) throw Error(`Synthetic reload unavailable (${response.status})`); status.textContent = await response.text(); }).catch(problem => { status.textContent = String(problem); });
  });
  panel.append(captured); document.body.append(panel); inspect();
}
