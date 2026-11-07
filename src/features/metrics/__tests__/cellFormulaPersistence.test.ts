// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { formulaFixture } from "./formulaFixture";
import { commitCellFormula, planFromFormula, previewCellFormula } from "../cellFormulaCommands";
import { assertSavedCellFormulas, canonicalFormulaValue } from "../cellFormulaModel";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace, workspaceStorageKey, duplicateReportRecord, createPublishedSnapshot } from "../../document/workspacePersistence";
import { draftImportedStudyReferences } from "../../document/importedStudyUsage";
import { buildPageVisualSvg } from "../../export/pageVisualExport";
import { assertExportResultsCurrent } from "../../export/exportIntegrity";
import { buildReportPreflight } from "../../export/reportPreflight";
beforeEach(() => localStorage.clear());
it("retains definitions, exact sources and calculation through save/reopen, duplication and snapshot", async () => {
  const { draft, dataset, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft, originalStudy = structuredClone(dataset);
  const workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(current)], importedDatasets: [dataset] }); expect(saveDashboardWorkspace(workspace)).toBe(true);
  const reopened = loadDashboardWorkspace(), saved = reopened.reports[0].draft;
  expect(saved.analysisLibrary.derivedDefinitions[0].spec.formula).toEqual(current.analysisLibrary.derivedDefinitions[0].spec.formula); expect(canonicalFormulaValue(saved.pages[1].tiles[0].result)).toBe(canonicalFormulaValue(current.pages[1].tiles[0].result)); expect(reopened.importedDatasets[0].rows).toEqual(originalStudy.rows);
  expect(draftImportedStudyReferences(saved).some(item => item.datasetId === dataset.id && item.location.includes("Saved calculation"))).toBe(true);
  const copy = duplicateReportRecord(reopened, reopened.reports[0]); expect(() => assertSavedCellFormulas(copy.report.draft.pages, copy.report.draft.analysisLibrary.derivedDefinitions)).not.toThrow(); expect(() => assertExportResultsCurrent(copy.report.draft.pages)).not.toThrow();
  const snapshot = createPublishedSnapshot(reopened, reopened.reports[0].draft); expect(snapshot.snapshot.dashboard.pages[1].tiles[0].derivedOutput?.formula).toEqual(current.pages[1].tiles[0].derivedOutput?.formula);
  const reused = planFromFormula(saved, saved.analysisLibrary.derivedDefinitions[0]); expect(previewCellFormula(saved, reused).response.table[0].values.summary).toBe(300 / 700 * 100);
});
it("preserves damaged serialized formula data rather than opening fabricated valid values", async () => {
  const { draft, dataset, plan } = await formulaFixture(), current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft;
  expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(current)], importedDatasets: [dataset] }))).toBe(true);
  const raw = JSON.parse(localStorage.getItem(workspaceStorageKey)!); raw.reports[0].draft.pages[1].tiles[0].result.table[0].values.summary = 999999; const damaged = JSON.stringify(raw); localStorage.setItem(workspaceStorageKey, damaged);
  expect(() => loadDashboardWorkspace()).toThrow(/calculated metric/i); expect(localStorage.getItem(workspaceStorageKey)).toBe(damaged);
});
it("renders decimal arithmetic and method notes, and preflight resolves source pages across the report", async () => {
  const { draft, plan } = await formulaFixture(); plan.expression = "A/B"; const current = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft;
  const svg = buildPageVisualSvg(current.pages[1]); expect(svg).toContain("0.4286"); expect(svg).toContain("Source response universe"); expect(svg).not.toContain("Significant");
  const preflight = buildReportPreflight(current); expect(preflight[1].issues.filter(issue => issue.check === "Analysis")).toHaveLength(0);
});
