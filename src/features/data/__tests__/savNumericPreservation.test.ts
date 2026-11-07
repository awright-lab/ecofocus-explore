// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import frozen from "./fixtures/legacy-sav-number-loss.json";
import { importDatasetBuffer } from "../datasetImportModel";
import { runImportedDatasetQuery } from "../importedDatasetAnalytics";
import { allRespondentsGroupingField } from "../numericSummaryScope";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace, workspaceStorageKey } from "../../document/workspacePersistence";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";

afterEach(() => localStorage.clear());
it("preserves actual prior blanked input/cache/snapshot on load and stores explicit reimport separately", async () => {
  const dataset = structuredClone(frozen.dataset) as unknown as ImportedDatasetRecord;
  const draft = structuredClone(initialDashboard); draft.id = "synthetic-old-sav"; draft.importedDatasets = [dataset]; draft.pages = draft.pages.slice(0, 1);
  const tile = draft.pages[0].tiles[0]; tile.result = structuredClone(frozen.result) as unknown as AnalyticsQueryResponse; tile.query = tile.result.query; tile.visualization = "table"; draft.pages[0].tiles = [tile];
  const old = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }), draft).workspace;
  localStorage.clear(); expect(saveDashboardWorkspace(old)).toBe(true); const raw = localStorage.getItem(workspaceStorageKey), loaded = loadDashboardWorkspace();
  expect(loaded.importedDatasets[0].rows.map(row => row.AMOUNT)).toEqual(["", "", "5"]); expect(loaded.reports[0].draft.pages[0].tiles[0].result.table[0].values.summary).toBe(5); expect(loaded.reports[0].draft.pages[0].tiles[0].result.table[0].bases.summary).toBe(1);
  expect(saveDashboardWorkspace(loaded)).toBe(true); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
  const { dataset: fresh } = await importDatasetBuffer(Uint8Array.from(atob(frozen.sourceBase64), char => char.charCodeAt(0)).buffer, "synthetic-finite-values.sav", "sav"); if (!fresh) throw Error("reimport");
  expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); expect(fresh.id).not.toBe(dataset.id); expect(fresh.rows.map(row => row.AMOUNT)).toEqual(["1e+101", "-1e+101", "5"]);
  const result = runImportedDatasetQuery({ dataset: fresh, field: allRespondentsGroupingField(fresh), measureField: fresh.fields[1], metric: "average", chartType: "table", groupingScope: "all_respondents" });
  const next = structuredClone(draft); next.id = "synthetic-explicit-reimport"; next.importedDatasets = [fresh]; next.pages[0].tiles[0].result = result; next.pages[0].tiles[0].query = result.query;
  expect(saveDashboardWorkspace({ ...loaded, importedDatasets: [...loaded.importedDatasets, fresh], reports: [...loaded.reports, createReportRecord(next)] })).toBe(true);
  const reopened = loadDashboardWorkspace(); expect(reopened.importedDatasets.find(study => study.id === dataset.id)).toEqual(loaded.importedDatasets[0]); expect(reopened.publishedSnapshots).toEqual(loaded.publishedSnapshots);
  expect(reopened.reports[0].draft.pages).toEqual(loaded.reports[0].draft.pages); const corrected = reopened.reports[1].draft.pages[0].tiles[0].result; expect(corrected.table[0].values.summary).toBe(5 / 3); expect(corrected.table[0].bases.summary).toBe(3);
});
