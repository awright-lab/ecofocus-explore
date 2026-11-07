import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { initialDashboard } from "../../documentSeeds";
import { storageKey } from "../../../builder/builderConstants";
import { createReportRecord, normalizeDashboardWorkspace, loadDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../../workspacePersistence";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { canonicalFormulaValue, formulaCacheIssue, formulaSourceIssue } from "../../../metrics/cellFormulaModel";
import { normalizeDashboard } from "../../documentModel";
import { buildPdfBlob, buildPptxBlob, buildXlsxBlob } from "../../../export/coreDocumentExports";
import "../../../../styles.css";
import "../../../../studio.css";
const id = "goal21_calculated_metric_report", hasData = [workspaceStorageKey, legacyWorkspaceStorageKey, storageKey].some(key => localStorage.getItem(key) !== null), existing = hasData ? loadDashboardWorkspace() : null;
const safe = !existing || existing.reports.length === 1 && existing.reports[0].id === id;
if (safe && !existing) {
  const headers = ["Respondent_ID", "Answer", "Group", "Spend", ...Array.from({ length: 26 }, (_, i) => `Other_${i + 1}`)];
  const csv = [headers.join(","), ...Array.from({ length: 1000 }, (_, i) => [i + 1, i < 300 ? "A" : "B", i % 2 ? "X" : "Y", i % 31, ...Array.from({ length: 26 }, (_, j) => (i + j) % 5)].join(","))].join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic_calculation_1000x30.csv"); if (!dataset) throw Error("Synthetic import failed");
  const draft = structuredClone(initialDashboard); draft.id = id; draft.title = "Calculated metric acceptance"; draft.importedDatasets = [dataset]; draft.pages = draft.pages.slice(0, 1);
  const page = draft.pages[0], result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], metric: "count", chartType: "table" });
  page.id = "original-calculation-source-page"; page.title = "Original response analysis"; page.order = 1; page.elements = [];
  page.tiles = [{ ...page.tiles[0], id: "original-calculation-source", name: "Original responses", title: "Original responses", derivedOutput: undefined, source: { kind: "importedField", id: `${dataset.id}:${dataset.fields[1].id}`, datasetId: dataset.id, fieldId: dataset.fields[1].id, label: "Answer" }, query: structuredClone(result.query), result, visualization: "table", layout: { x: 64, y: 80, width: 1152, height: 520, zIndex: 1 } }];
  if (!saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }))) throw Error("Synthetic formula workspace save failed");
}
if (safe && !location.hash) history.replaceState(null, "", `#/reports/${id}`);
function Harness() {
  const [inspection, setInspection] = useState(""), [proofs, setProofs] = useState<Record<string, string>>({}), [format, setFormat] = useState("PDF"), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  function inspect() {
    const workspace = loadDashboardWorkspace(), draft = workspace.reports[0].draft, tiles = draft.pages.flatMap(page => page.tiles);
    setInspection(JSON.stringify({ study: workspace.importedDatasets[0], pages: draft.pages, definitions: draft.analysisLibrary.derivedDefinitions, snapshots: workspace.publishedSnapshots.length, formulas: tiles.filter(tile => tile.derivedOutput?.kind === "cell_formula").map(tile => ({ id: tile.id, title: tile.title, value: tile.result.table[0].values[tile.result.columns[0].id], issue: formulaCacheIssue(tile) ?? formulaSourceIssue(tile.derivedOutput!, tiles.find(source => source.id === tile.derivedOutput!.sourceTileId)) })) }));
  }
  function changeSyntheticSource() {
    const workspace = loadDashboardWorkspace(), draft = workspace.reports[0].draft, dataset = workspace.importedDatasets[0];
    if (draft.id !== id || dataset.rows.length !== 1000 || dataset.fields.length !== 30) throw Error("The bounded synthetic source is unavailable");
    if (dataset.rows.every((row, index) => row.Answer === (index < 200 ? "A" : "B"))) { setStatus("The synthetic source is already A200/B800. No write was repeated; open the latest saved workspace."); return; }
    dataset.rows.forEach((row, index) => { row.Answer = index < 200 ? "A" : "B"; }); dataset.previewRows = dataset.rows.slice(0, 25).map(row => ({ ...row }));
    const source = draft.pages.flatMap(page => page.tiles).find(tile => tile.id === "original-calculation-source")!;
    const result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], metric: "count", chartType: "table" }); source.result = result; source.query = structuredClone(result.query);
    draft.importedDatasets = [dataset];
    const acknowledged = saveDashboardWorkspace(workspace), stored = loadDashboardWorkspace();
    const expected = normalizeDashboard(draft), actual = stored.reports[0].draft;
    if (canonicalFormulaValue({ rows: stored.importedDatasets[0].rows, fields: stored.importedDatasets[0].fields, pages: actual.pages, definitions: actual.analysisLibrary.derivedDefinitions }) !== canonicalFormulaValue({ rows: dataset.rows, fields: dataset.fields, pages: expected.pages, definitions: expected.analysisLibrary.derivedDefinitions })) { setStatus("The synthetic source write was not verified. Preserve both tabs and inspect before another action."); return; }
    setStatus(`Synthetic source write verified by readback (${acknowledged ? "acknowledged" : "acknowledgement uncertain; saved body matched"}). Open the latest saved workspace in another tab. The old tab is retained; do not retry its stale save.`);
  }
  async function buildProofs() {
    setBusy(true); setProofs({}); setStatus("Building actual formats locally...");
    try {
      const draft = loadDashboardWorkspace().reports[0].draft; if (draft.id !== id || draft.pages.length > 8) throw Error("The bounded synthetic export is unavailable");
      const pdf = await buildPdfBlob(draft.pages), pptx = await buildPptxBlob(draft.pages), xlsx = buildXlsxBlob(draft, draft.pages), next: Record<string, string> = {};
      for (const [name, blob] of [["PDF", pdf], ["PPTX", pptx], ["XLSX", xlsx]] as const) { const bytes = new Uint8Array(await blob.arrayBuffer()); let value = ""; for (let offset = 0; offset < bytes.length; offset += 16384) value += String.fromCharCode(...bytes.subarray(offset, offset + 16384)); next[name] = btoa(value); }
      setProofs(next); setStatus(`Built ${draft.pages.length} pages: PDF ${pdf.size}, PPTX ${pptx.size}, XLSX ${xlsx.size} bytes. Actual browser rendering; no OS download.`);
    } catch (problem) { setStatus(problem instanceof Error ? problem.message : "Synthetic export failed"); } finally { setBusy(false); }
  }
  return safe ? <><App /><aside aria-label="Synthetic calculation inspection" style={{ position: "fixed", bottom: 8, left: 8, zIndex: 900, padding: 8, background: "white", border: "1px solid #39784d", maxWidth: 380, maxHeight: 96, overflow: "auto" }}><button onClick={inspect}>Inspect saved calculation workspace</button><p>Fabricated 1,000-row/30-field study. Actual App and local writer.</p><output>{inspection}</output><button onClick={changeSyntheticSource}>Rerun synthetic source as A200 B800</button><a href={location.href} target="_blank" rel="noopener noreferrer">Open latest saved calculation workspace</a><button disabled={busy} onClick={() => void buildProofs()}>Build calculation format proofs</button><p role="status">{status}</p><label>Calculation format<select value={format} onChange={event => setFormat(event.target.value)}><option>PDF</option><option>PPTX</option><option>XLSX</option></select></label><textarea aria-label="Calculation format bytes" readOnly value={proofs[format] ?? ""} /></aside></> : <p>Acceptance stopped: this origin contains another workspace. No data was changed.</p>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
