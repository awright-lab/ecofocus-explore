import { expect, it, vi, afterEach } from "vitest";
import { initialDashboard } from "../documentSeeds";
import { createPublishedSnapshot, createReportRecord, measureWorkspaceStorage, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { syntheticStudy } from "./fixtures/syntheticStudy";

afterEach(() => vi.unstubAllGlobals());
function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
it("measures the same compact text that saving writes without changing source rows or historical versions", async () => {
  const { dataset } = await syntheticStudy(1000, 60); let value = workspace(); value.importedDatasets = [dataset]; value.reports[0].draft.importedDatasets = [dataset]; value = createPublishedSnapshot(value, value.reports[0].draft).workspace;
  value.importedDatasets[0] = structuredClone(dataset); value.importedDatasets[0].rows[0].Spend = "999"; const original = structuredClone(value);
  const summary = measureWorkspaceStorage(value, "previous saved text");
  expect(summary.studies).toHaveLength(2); expect(new Set(summary.studies.map(study => study.key)).size).toBe(2); expect(summary.studies.map(study => study.storedRows)).toEqual([1000, 1000]); expect(summary.snapshotCount).toBe(1);
  let saved = ""; vi.stubGlobal("window", { localStorage: { setItem: (key: string, raw: string) => { expect(key).toBe(workspaceStorageKey); saved = raw; } } });
  expect(saveDashboardWorkspace(value)).toBe(true); expect(summary.projectedTextBytes).toBe(saved.length * 2); expect(summary.savedTextBytes).toBe("previous saved text".length * 2); expect(value).toEqual(original);
  expect(summary.studies.reduce((sum, study) => sum + study.textBytes, 0) + summary.otherTextBytes).toBe(summary.projectedTextBytes);
});
it("reports compact remote coverage rather than treating preview rows or fields as complete", async () => {
  const { dataset } = await syntheticStudy(1000, 100); dataset.remote = { provider: "netlify", projectUrl: "", bucket: "", objectPath: "synthetic", uploadedAt: dataset.importedAt };
  const value = workspace(); value.importedDatasets = [dataset]; const before = structuredClone(value), summary = measureWorkspaceStorage(value, null);
  expect(summary.studies[0]).toMatchObject({ storedRows: 25, declaredRows: 1000, storedFields: 80, declaredFields: 100 }); expect(summary.savedTextBytes).toBeNull(); expect(value).toEqual(before);
});
it("distinguishes an empty saved text from no saved copy and accounts for Unicode code units explicitly", () => {
  const value = workspace(); expect(measureWorkspaceStorage(value, "").savedTextBytes).toBe(0); expect(measureWorkspaceStorage(value, "日本語😀").savedTextBytes).toBe(10);
});
it("includes the report structure when no imported data exists", () => {
  const summary = measureWorkspaceStorage(workspace(), null); expect(summary.projectedTextBytes).toBeGreaterThan(0); expect(summary.studies).toEqual([]); expect(summary.snapshotCount).toBe(0);
});
