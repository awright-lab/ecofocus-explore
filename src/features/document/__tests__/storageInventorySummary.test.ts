// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { initialDashboard } from "../documentSeeds";
import { createPublishedSnapshot, createReportRecord, loadDashboardWorkspace, measureWorkspaceStorage, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { syntheticStudy } from "./fixtures/syntheticStudy";
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
async function fixture() {
  const { dataset } = await syntheticStudy(1000, 30), draft = structuredClone(initialDashboard); draft.id = "storage-accounting"; draft.title = "Résumé 日本語 😀"; draft.pages = draft.pages.slice(0, 1); draft.importedDatasets = [dataset];
  let workspace = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: [dataset] }), draft).workspace;
  const next = structuredClone(draft); next.title = "A larger historical report"; next.pages[0].backgroundImage = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><title>' + 'Synthetic asset '.repeat(2000) + '</title></svg>')}`;
  workspace = createPublishedSnapshot(workspace, next).workspace; workspace.importedDatasets[0].rows[0].Spend = "999"; return workspace;
}
it("partitions actual saved UTF-16 text without double counting snapshot studies", async () => {
  const workspace = await fixture(), before = structuredClone(workspace); localStorage.clear(); expect(saveDashboardWorkspace(workspace)).toBe(true);
  const raw = localStorage.getItem(workspaceStorageKey)!, encoded = JSON.parse(raw), summary = measureWorkspaceStorage(workspace, raw), bytes = (value: unknown) => JSON.stringify(value).length * 2;
  expect(summary.projectedTextBytes).toBe(raw.length * 2); expect(summary.currentStudyTextBytes).toBe(encoded.importedDatasets.reduce((sum: number, study: unknown) => sum + bytes(study), 0));
  expect(summary.matchesSavedCopy).toBe(true); expect(measureWorkspaceStorage(workspace, "x".repeat(raw.length)).matchesSavedCopy).toBe(false); expect(measureWorkspaceStorage(workspace, null).matchesSavedCopy).toBe(false);
  expect(summary.snapshotTextBytes).toBe(encoded.publishedSnapshots.reduce((sum: number, snapshot: unknown) => sum + bytes(snapshot), 0));
  expect(summary.workspaceTextBytes + summary.currentStudyTextBytes + summary.snapshotTextBytes).toBe(summary.projectedTextBytes);
  expect(summary.otherTextBytes + summary.studies.reduce((sum, study) => sum + study.textBytes, 0)).toBe(summary.projectedTextBytes);
  summary.snapshots.forEach((snapshot, index) => { expect(snapshot.textBytes).toBe(bytes(encoded.publishedSnapshots[index])); expect(snapshot.studyTextBytes).toBe(encoded.publishedSnapshots[index].dashboard.importedDatasets.reduce((sum: number, study: unknown) => sum + bytes(study), 0)); expect(snapshot.textBytes).toBeGreaterThan(snapshot.studyTextBytes); expect(snapshot.canOpen).toBe(true); });
  expect(summary.snapshots[0].textBytes).toBeGreaterThan(summary.snapshots[1].textBytes); expect(summary.snapshots.map(snapshot => snapshot.title)).toEqual(["A larger historical report", "Résumé 日本語 😀"]);
  expect(workspace).toEqual(before); expect(workspace.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Spend).toBe("1"); expect(loadDashboardWorkspace().publishedSnapshots.map(snapshot => snapshot.dashboard.importedDatasets[0].rows[0].Spend)).toEqual(["1", "1"]);
});
it("counts snapshot report assets even when no study data exists", () => {
  const draft = structuredClone(initialDashboard); draft.importedDatasets = []; const workspace = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(draft)] }), draft).workspace;
  const summary = measureWorkspaceStorage(workspace, null); expect(summary.currentStudyTextBytes).toBe(0); expect(summary.studies).toEqual([]); expect(summary.snapshots[0]).toMatchObject({ studyCount: 0, studyTextBytes: 0, pageCount: draft.pages.length }); expect(summary.snapshotTextBytes).toBeGreaterThan(0); expect(summary.workspaceTextBytes + summary.snapshotTextBytes).toBe(summary.projectedTextBytes);
});
it("keeps remote preview coverage distinct from full declared dimensions", async () => {
  const { dataset } = await syntheticStudy(1000, 100); dataset.remote = { provider: "netlify", projectUrl: "", bucket: "", objectPath: "synthetic", uploadedAt: dataset.importedAt };
  const workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [dataset] }), before = structuredClone(workspace), summary = measureWorkspaceStorage(workspace, null);
  expect(summary.studies[0]).toMatchObject({ storedRows: 25, declaredRows: 1000, storedFields: 80, declaredFields: 100 }); expect(summary.snapshotTextBytes).toBe(0); expect(summary.currentStudyTextBytes + summary.workspaceTextBytes).toBe(summary.projectedTextBytes); expect(workspace).toEqual(before);
});
it("retains duplicate version records but does not advertise an ambiguous viewer link", async () => {
  const workspace = await fixture(); const duplicate = structuredClone(workspace.publishedSnapshots[0]); duplicate.versionLabel = "Conflicting version identity"; workspace.publishedSnapshots.push(duplicate); const before = structuredClone(workspace); expect(saveDashboardWorkspace(workspace)).toBe(true); const summary = measureWorkspaceStorage(workspace, localStorage.getItem(workspaceStorageKey));
  expect(summary.snapshotCount).toBe(3); expect(new Set(summary.snapshots.map(snapshot => snapshot.key)).size).toBe(3); expect(summary.snapshots.map(snapshot => snapshot.canOpen)).toEqual([false, true, false]); expect(new Set(summary.studies.map(study => study.key)).size).toBe(summary.studies.length); expect(workspace).toEqual(before);
});
it("measurement never writes or requests storage permission", async () => {
  const workspace = await fixture(), write = vi.spyOn(Storage.prototype, "setItem"), before = structuredClone(workspace); const summary = measureWorkspaceStorage(workspace, "Previous 😀 text"); expect(summary.savedTextBytes).toBe("Previous 😀 text".length * 2); expect(write).not.toHaveBeenCalled(); expect(workspace).toEqual(before);
});
it("does not advertise a new or changed version as the stored snapshot", async () => {
  const workspace = await fixture(); expect(saveDashboardWorkspace(workspace)).toBe(true); const raw = localStorage.getItem(workspaceStorageKey)!;
  const changed = structuredClone(workspace); changed.publishedSnapshots[0].dashboard.title = "Changed only in memory"; const summary = measureWorkspaceStorage(changed, raw);
  expect(summary.snapshots.map(snapshot => snapshot.canOpen)).toEqual([false, true]); expect(summary.savedSnapshotInspectionFailed).toBe(false);
  const newest = createPublishedSnapshot(workspace, workspace.reports[0].draft).workspace; expect(measureWorkspaceStorage(newest, raw).snapshots[0].canOpen).toBe(false);
  expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
});
it.each(["not JSON", "", '{"publishedSnapshots":{}}', '{"publishedSnapshots":null}'])("retains current measurements but refuses unreadable stored version metadata %s", async raw => {
  const workspace = await fixture(), before = structuredClone(workspace), summary = measureWorkspaceStorage(workspace, raw);
  expect(summary.savedSnapshotInspectionFailed).toBe(true); expect(summary.snapshots.every(snapshot => !snapshot.canOpen)).toBe(true); expect(summary.projectedTextBytes).toBeGreaterThan(0); expect(workspace).toEqual(before);
});
it.each(["id", "reportId"] as const)("keeps an unencodable saved %s inspectable without an unusable link", async field => {
  const workspace = await fixture(); workspace.publishedSnapshots[0][field] = "bad\ud800identity"; expect(saveDashboardWorkspace(workspace)).toBe(true);
  const summary = measureWorkspaceStorage(workspace, localStorage.getItem(workspaceStorageKey)); expect(summary.snapshots[0].localPath).toBeNull(); expect(summary.snapshots[0].canOpen).toBe(false); expect(summary.snapshotCount).toBe(2);
});
it.each(["invalid", ""])("does not link a snapshot whose timestamp cannot be displayed: %s", async value => {
  const workspace = await fixture(); workspace.publishedSnapshots[0].publishedAt = value; expect(saveDashboardWorkspace(workspace)).toBe(true);
  const summary = measureWorkspaceStorage(workspace, localStorage.getItem(workspaceStorageKey)); expect(summary.snapshots[0].canOpen).toBe(false); expect(summary.snapshots[0].localPath).toBeNull(); expect(summary.projectedTextBytes).toBeGreaterThan(0);
});
it("derives the local destination from identity components rather than a stored destination", async () => {
  const workspace = await fixture(), target = workspace.publishedSnapshots[0]; target.id = "version /?#%"; target.reportId = "report /?#%"; target.viewerPath = "https://example.invalid/not-local"; expect(saveDashboardWorkspace(workspace)).toBe(true);
  const summary = measureWorkspaceStorage(workspace, localStorage.getItem(workspaceStorageKey)); expect(summary.snapshots[0].canOpen).toBe(true); expect(summary.snapshots[0].localPath).toBe("#/published/report%20%2F%3F%23%25/version%20%2F%3F%23%25");
});

it.each(["publishedAt", "versionLabel", "title"] as const)("keeps malformed %s metadata inspectable without coercing it or inventing a valid version", async field => {
  const workspace = await fixture(), invalid = { toString: "not callable", value: "synthetic" };
  if (field === "title") workspace.publishedSnapshots[0].dashboard.title = invalid as unknown as string;
  else workspace.publishedSnapshots[0][field] = invalid as unknown as string;
  const before = structuredClone(workspace); expect(saveDashboardWorkspace(workspace)).toBe(true);
  const summary = measureWorkspaceStorage(workspace, localStorage.getItem(workspaceStorageKey)); expect(summary.snapshots[0].canOpen).toBe(false); expect(summary.snapshots[0].localPath).toBeNull(); expect(summary.projectedTextBytes).toBeGreaterThan(0); expect(workspace).toEqual(before);
});
