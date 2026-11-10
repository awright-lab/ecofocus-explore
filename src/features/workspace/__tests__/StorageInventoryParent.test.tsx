// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../App";
import { syntheticStudy } from "../../document/__tests__/fixtures/syntheticStudy";
import { initialDashboard } from "../../document/documentSeeds";
import { createPublishedSnapshot, createReportRecord, measureWorkspaceStorage, loadDashboardWorkspace, makePublishedViewerPath, normalizeDashboardWorkspace, saveDashboardWorkspace, upsertDraftReport, workspaceStorageKey } from "../../document/workspacePersistence";
import { workspaceSaveSession } from "../../document/workspaceSaveSession";
import { allRespondentsGroupingField } from "../../data/numericSummaryScope";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
async function until(check: () => boolean) { for (let index = 0; index < 800 && !check(); index++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check(), document.body.textContent?.slice(-1500)).toBe(true); }
function button(label: string) { const found = Array.from(document.querySelectorAll("button")).find(node => node.textContent?.startsWith(label)); if (!found) throw Error(label); return found; }
it("actual App measures, browses and opens an acknowledged historical version without changing the1000x30study, current draft or snapshot through cold reopen", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("fetch", vi.fn());
  const { dataset } = await syntheticStudy(1000, 30), draft = structuredClone(initialDashboard); draft.id = "storage-inventory-journey"; draft.title = "Original annual insight"; draft.pages = draft.pages.slice(0, 1); draft.importedDatasets = [dataset];
  const result = runImportedDatasetQuery({ dataset, field: allRespondentsGroupingField(dataset), measureField: dataset.fields[3], metric: "average", chartType: "table", groupingScope: "all_respondents" });
  const tile = draft.pages[0].tiles[0]; tile.id = "stored-original-mean"; tile.title = tile.name = "Original spend mean"; tile.result = result; tile.query = result.query; tile.visualization = "table"; tile.source = { kind: "importedField", id: `${dataset.id}:spend`, datasetId: dataset.id, fieldId: dataset.fields[3].id, label: "Spend" }; draft.pages[0].tiles = [tile];
  const published = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }), draft);
  published.snapshot.viewerPath = "https://example.invalid/not-a-local-viewer";
  const currentStudy = structuredClone(dataset); currentStudy.rows[0].Spend = "999"; currentStudy.title = "Current study copy";
  const current = structuredClone(published.dashboard); current.title = "Current edited report"; current.status = "draft"; current.importedDatasets = [currentStudy]; current.pages[0].tiles[0].title = "Current cached tile";
  const workspace = upsertDraftReport({ ...published.workspace, importedDatasets: [currentStudy] }, current);
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null); expect(saveDashboardWorkspace(workspace)).toBe(true);
  const raw = localStorage.getItem(workspaceStorageKey), before = structuredClone(loadDashboardWorkspace()); window.history.replaceState(null, "", "/#/");
  const host = document.createElement("div"); document.body.append(host); let root = createRoot(host);
  try {
    await act(async () => root.render(<App />)); await until(() => !!document.querySelector("details.workspace-storage-panel"));
    await act(async () => { document.querySelector<HTMLDetailsElement>("details.workspace-storage-panel")!.open = true; });
    await act(async () => button("Measure storage details").click()); await until(() => !!document.querySelector('[aria-label="Storage inventory"]'));
    expect(document.querySelector(".workspace-storage-panel")?.textContent).toContain("Historical snapshot text"); await act(async () => button("Snapshots (").click());
    const link = document.querySelector<HTMLAnchorElement>('.storage-inventory tbody a')!; expect(link, JSON.stringify({ panel: document.querySelector(".workspace-storage-panel")?.textContent?.slice(-3500), normalizedMatchesSaved: measureWorkspaceStorage(before, raw).matchesSavedCopy, pending: workspaceSaveSession.hasPending(), rawUnchanged: localStorage.getItem(workspaceStorageKey) === raw })).not.toBeNull(); expect(link.getAttribute("href")).toBe(makePublishedViewerPath(published.snapshot.reportId, published.snapshot.id)); expect(link.textContent).toBe("Open local snapshot");
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); await act(async () => { link.focus(); link.click(); }); await until(() => window.location.hash === makePublishedViewerPath(published.snapshot.reportId, published.snapshot.id) && !!document.querySelector(".published-page-meta"));
    expect(document.body.textContent).toContain("Original annual insight"); expect(document.body.textContent).toContain("50.5"); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); expect(loadDashboardWorkspace()).toEqual(before); expect(workspaceSaveSession.hasPending()).toBe(false); expect(fetch).not.toHaveBeenCalled();
    await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host); await act(async () => root.render(<App />)); await until(() => !!document.querySelector(".published-page-meta"));
    expect(document.body.textContent).toContain("Original annual insight"); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); const reopened = loadDashboardWorkspace(); expect(reopened).toEqual(before); expect(reopened.importedDatasets[0].rows[0].Spend).toBe("999"); expect(reopened.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Spend).toBe("1"); expect(fetch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); }
}, 45000);
