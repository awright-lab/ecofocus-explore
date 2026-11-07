import { describe, expect, it, vi } from "vitest";
vi.mock("../pageVisualExport", async original => ({ ...await original<typeof import("../pageVisualExport")>(), renderPageVisualImages: vi.fn() }));
import { buildDashboardExportSpec } from "../../builder/builderExportPackage";
import { renderPageVisualImages } from "../pageVisualExport";
import { buildPdfBlob, buildPptxBlob, buildXlsxBlob } from "../coreDocumentExports";
import { analysisContextRows, assertExportResultsCurrent } from "../exportIntegrity";
import { buildReportPreflight } from "../reportPreflight";
import { createWorkspaceBackup } from "../../document/workspaceBackup";
import { normalizeDashboardWorkspace, createReportRecord } from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
import { sampleSizeLabel } from "../../builder/components/CanvasRenderers";
function document() {
 const draft = structuredClone(initialDashboard); draft.pages = [draft.pages[0]];
 draft.pages[0].elements = []; draft.pages[0].tiles = [draft.pages[0].tiles[0]];
 const tile = draft.pages[0].tiles[0]; tile.query = structuredClone(tile.result.query); return draft;
}
describe("export result identity and weighting certainty", () => {
 it.each(["duplicate row", "missing row", "duplicate column", "missing column"])("rejects %s before PDF rasterization or any formatted file construction", async defect => {
  const draft = document(), result = draft.pages[0].tiles[0].result;
  if (defect === "duplicate row") result.table.push(structuredClone(result.table[0]));
  if (defect === "missing row") result.table[0].optionId = " ";
  if (defect === "duplicate column") result.columns.push(structuredClone(result.columns[0]));
  if (defect === "missing column") result.columns[0].id = "";
  const before = structuredClone(draft); vi.mocked(renderPageVisualImages).mockClear();
  expect(() => buildXlsxBlob(draft, draft.pages)).toThrow(/missing or duplicate/);
  await expect(buildPdfBlob(draft.pages)).rejects.toThrow(/missing or duplicate/);
  await expect(buildPptxBlob(draft.pages)).rejects.toThrow(/missing or duplicate/);
  expect(renderPageVisualImages).not.toHaveBeenCalled(); expect(draft).toEqual(before);
  expect(buildReportPreflight(draft)[0].issues).toContainEqual(expect.objectContaining({ check: "Analysis", message: expect.stringContaining("missing or duplicate") }));
 });
 it("keeps ambiguous recorded cells intact in a portable workspace backup", () => {
  const draft = document(), workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(draft)] });
  const result = workspace.reports[0].draft.pages[0].tiles[0].result;
  result.table.push({ ...structuredClone(result.table[0]), values: { ...result.table[0].values, [result.columns[0].id]: 123.456789 } });
  const before = JSON.stringify(workspace), backup = createWorkspaceBackup(workspace);
  expect(backup.payload).toBe(before); expect(JSON.stringify(workspace)).toBe(before);
  expect(JSON.parse(backup.payload).reports[0].draft.pages[0].tiles[0].result.table).toEqual(result.table);
 });
 it("ignores hidden ambiguous analyses and allows duplicate labels with distinct IDs", () => {
  const draft = document(), tile = draft.pages[0].tiles[0];
  tile.result.table.push({ ...structuredClone(tile.result.table[0]), optionId: "distinct-row" });
  expect(() => assertExportResultsCurrent(draft.pages)).not.toThrow();
  tile.result.table[1].optionId = tile.result.table[0].optionId; tile.hidden = true;
  expect(() => assertExportResultsCurrent(draft.pages)).not.toThrow();
 });
 it("does not label a requested but unconfirmed weight as unweighted or an applied weighted total", () => {
  const draft = document(), tile = draft.pages[0].tiles[0];
  tile.result.query.weight = "weightvar"; tile.query = structuredClone(tile.result.query);
  tile.result.weighting = { applied: false, id: null, label: "Unweighted" };
  const rows = Object.fromEntries(analysisContextRows(tile));
  expect(rows.Weighting).toMatch(/requested.*weightvar.*unconfirmed/i);
  expect(rows["Base scope"]).toContain("weighting unverified");
  expect(rows["Base scope"]).not.toMatch(/Sample n|Weighted total/);
  expect(sampleSizeLabel(tile.result)).toContain("weighting unverified");
  expect(buildDashboardExportSpec(draft, draft.pages).slides[0].tiles[0].exportHints.weighting).toMatch(/application unconfirmed/);
 });
 it("retains confirmed weighted and genuinely unweighted labels", () => {
  const draft = document(), tile = draft.pages[0].tiles[0]; tile.result.query.weight = null;
  tile.result.weighting = { applied: false, id: null, label: "Unweighted" };
  expect(Object.fromEntries(analysisContextRows(tile)).Weighting).toBe("Unweighted");
  tile.result.query.weight = "weightvar";
  tile.result.weighting = { applied: true, id: "weightvar", label: "Synthetic weight applied" };
  expect(Object.fromEntries(analysisContextRows(tile)).Weighting).toBe("Synthetic weight applied");
  expect(sampleSizeLabel(tile.result)).toContain("Weighted total");
 });
});
