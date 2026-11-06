import { encodeImportedRows } from "../workspaceRowStorage";
import { syntheticStudy } from "./fixtures/syntheticStudy";
import { expect, it } from "vitest";
import { reconcileAcknowledgedHistory } from "../acknowledgedWorkspaceHistory";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace, decodeStoredWorkspaceSource, workspaceStorageKey } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
function saved() { const value = workspace(); return createPublishedSnapshot(value, value.reports[0].draft).workspace; }
it("adds acknowledged history while preserving every newer current workspace value", () => {
  const acknowledged = saved(), latest = workspace(); latest.label = "New route"; latest.reports[0].draft.title = "Newer report edit";
  const before = structuredClone(latest), original = structuredClone(acknowledged);
  const result = reconcileAcknowledgedHistory(latest, acknowledged);
  expect(result.kind).toBe("ready"); expect(result.workspace.publishedSnapshots).toEqual(acknowledged.publishedSnapshots);
  expect({ ...result.workspace, publishedSnapshots: [] }).toEqual(before); expect(latest).toEqual(before); expect(acknowledged).toEqual(original);
});
it("does not share mutable references with either caller", () => {
  const latest = workspace(), acknowledged = saved(), result = reconcileAcknowledgedHistory(latest, acknowledged);
  acknowledged.publishedSnapshots[0].dashboard.title = "Caller mutation"; latest.reports[0].draft.title = "Later edit";
  expect(result.workspace.publishedSnapshots[0].dashboard.title).not.toBe("Caller mutation"); expect(result.workspace.reports[0].draft.title).not.toBe("Later edit");
});
it("keeps older acknowledgements behind an existing newer snapshot", () => {
  const first = saved(), second = createPublishedSnapshot(first, first.reports[0].draft).workspace;
  const latest = { ...second, publishedSnapshots: [second.publishedSnapshots[0]] };
  const result = reconcileAcknowledgedHistory(latest, first);
  expect(result.workspace.publishedSnapshots.map(snapshot => snapshot.versionLabel)).toEqual(["v2", "v1"]);
});
it("places a newer acknowledged snapshot ahead of current older history", () => {
  const first = saved(), second = createPublishedSnapshot(first, first.reports[0].draft).workspace;
  expect(reconcileAcknowledgedHistory(first, second).workspace.publishedSnapshots.map(snapshot => snapshot.versionLabel)).toEqual(["v2", "v1"]);
});
it("treats reordered object properties as the same immutable snapshot", () => {
  const latest = saved(), acknowledged = structuredClone(latest); acknowledged.publishedSnapshots[0] = Object.fromEntries(Object.entries(acknowledged.publishedSnapshots[0]).reverse()) as typeof acknowledged.publishedSnapshots[0];
  const result = reconcileAcknowledgedHistory(latest, acknowledged); expect(result.kind).toBe("unchanged"); expect(result.issues).toEqual([]);
});
it("retains both candidates and makes no partial merge when snapshot identities conflict", () => {
  const latest = saved(), acknowledged = structuredClone(latest); acknowledged.publishedSnapshots[0].dashboard.title = "Different historical content";
  acknowledged.publishedSnapshots.push(createPublishedSnapshot(acknowledged, acknowledged.reports[0].draft).snapshot);
  const result = reconcileAcknowledgedHistory(latest, acknowledged);
  expect(result.kind).toBe("needs_review"); expect(result.issues).toContainEqual({ kind: "conflicting_snapshot", snapshotId: latest.publishedSnapshots[0].id });
  expect(result.workspace).toEqual(latest); expect(result.acknowledged).toEqual(acknowledged); expect(result.additions).toHaveLength(1);
});
it("does not resurrect a deleted report when detached history arrives", () => {
  const acknowledged = saved(), latest = workspace(); latest.reports[0].id = "new-report"; latest.reports[0].draft.id = "new-report"; latest.activeReportId = "new-report";
  const result = reconcileAcknowledgedHistory(latest, acknowledged);
  expect(result.kind).toBe("needs_review"); expect(result.workspace).toEqual(latest); expect(result.issues[0].kind).toBe("detached_snapshot"); expect(result.acknowledged.publishedSnapshots).toHaveLength(1);
});
it("never combines different workspace identities", () => {
  const acknowledged = saved(), latest = workspace(); latest.id = "different-workspace";
  const result = reconcileAcknowledgedHistory(latest, acknowledged); expect(result.kind).toBe("needs_review"); expect(result.workspace).toEqual(latest); expect(result.issues[0].kind).toBe("different_workspace");
});
it("fails closed for duplicate current snapshot IDs even when their content matches", () => {
  const latest = saved(); latest.publishedSnapshots.push(structuredClone(latest.publishedSnapshots[0]));
  const result = reconcileAcknowledgedHistory(latest, saved()); expect(result.kind).toBe("needs_review"); expect(result.workspace).toEqual(latest);
});
it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("preserves invalid acknowledged history for review (count=%s)", count => {
  const latest = workspace(), acknowledged = saved(); acknowledged.publishedSnapshots[0].dashboard.publishMetadata.publishCount = count;
  const result = reconcileAcknowledgedHistory(latest, acknowledged); expect(result.kind).toBe("needs_review"); expect(result.workspace).toEqual(latest); expect(result.acknowledged).toEqual(acknowledged);
});
it("preserves historical respondent data separately from same-ID newer study rows", async () => {
  const parsed = await importDatasetBuffer(new TextEncoder().encode("Region,Spend\nNorth,10\nSouth,20\n").buffer, "synthetic.csv");
  const value = workspace(); value.importedDatasets = [parsed.dataset!]; value.reports[0].draft.importedDatasets = [parsed.dataset!];
  const acknowledged = createPublishedSnapshot(value, value.reports[0].draft).workspace;
  const latest = structuredClone(value); latest.importedDatasets[0].rows[0].Spend = "999"; latest.reports[0].draft.importedDatasets = [];
  const result = reconcileAcknowledgedHistory(latest, acknowledged);
  expect(result.kind).toBe("ready"); expect(result.workspace.importedDatasets[0].rows[0].Spend).toBe("999"); expect(result.workspace.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Spend).toBe("10");
});

it("retains the acknowledged candidate independently of proposed workspace edits", () => {
  const result = reconcileAcknowledgedHistory(workspace(), saved()), original = result.acknowledged.publishedSnapshots[0].dashboard.title;
  result.workspace.publishedSnapshots[0].dashboard.title = "Edited proposal";
  expect(result.acknowledged.publishedSnapshots[0].dashboard.title).toBe(original);
});
it("does not silently collapse duplicate acknowledged snapshot IDs", () => {
  const acknowledged = saved(); acknowledged.publishedSnapshots.push(structuredClone(acknowledged.publishedSnapshots[0]));
  const result = reconcileAcknowledgedHistory(workspace(), acknowledged); expect(result.kind).toBe("needs_review"); expect(result.workspace.publishedSnapshots).toHaveLength(0); expect(result.acknowledged.publishedSnapshots).toHaveLength(2);
});
it("requires review when different snapshots claim the same report version", () => {
  const latest = saved(), acknowledged = structuredClone(latest); acknowledged.publishedSnapshots[0].id = "same-version-different-snapshot";
  const result = reconcileAcknowledgedHistory(latest, acknowledged); expect(result.kind).toBe("needs_review"); expect(result.workspace).toEqual(latest); expect(result.issues).toContainEqual({ kind: "conflicting_version", snapshotId: "same-version-different-snapshot" });
});

it("reconciles a 1,000 by 60 acknowledged study after storage encoding without borrowing newer data", async () => {
  const { dataset } = await syntheticStudy(1000, 60);
  const value = workspace(); value.importedDatasets = [dataset]; value.reports[0].draft.importedDatasets = [dataset];
  const acknowledged = createPublishedSnapshot(value, value.reports[0].draft).workspace;
  const encoded = { ...acknowledged, importedDatasets: acknowledged.importedDatasets.map(encodeImportedRows), reports: acknowledged.reports.map(report => ({ ...report, draft: { ...report.draft, importedDatasets: [] } })), publishedSnapshots: acknowledged.publishedSnapshots.map(snapshot => ({ ...snapshot, dashboard: { ...snapshot.dashboard, importedDatasets: snapshot.dashboard.importedDatasets.map(encodeImportedRows) } })) };
  const reopened = decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: JSON.stringify(encoded) });
  const latest = structuredClone(value); latest.reports[0].draft.title = "New route pending draft"; latest.reports[0].draft.importedDatasets = []; latest.importedDatasets[0].rows = latest.importedDatasets[0].rows.slice(0, 900); latest.importedDatasets[0].rowCount = 900;
  const result = reconcileAcknowledgedHistory(latest, reopened);
  expect(result.kind).toBe("ready"); expect(result.workspace.reports[0].draft.title).toBe("New route pending draft");
  expect(result.workspace.importedDatasets[0].rows).toHaveLength(900);
  expect(result.workspace.publishedSnapshots[0].dashboard.importedDatasets[0].rows).toEqual(dataset.rows);
  expect(result.workspace.publishedSnapshots[0].dashboard.importedDatasets[0].fields).toHaveLength(60);
  expect(createPublishedSnapshot(result.workspace, result.workspace.reports[0].draft).snapshot.versionLabel).toBe("v2");
});
it("preserves per-report version order across many delayed acknowledgement subsets", () => {
  const value = workspace(), secondReport = structuredClone(value.reports[0]); secondReport.id = "second-report"; secondReport.draft.id = secondReport.id; value.reports.push(secondReport);
  const base = createPublishedSnapshot(value, value.reports[0].draft).snapshot;
  const snapshots = Array.from({ length: 12 }, (_, index) => { const reportId = index % 2 ? secondReport.id : value.reports[0].id, count = Math.floor(index / 2) + 1; const snapshot = structuredClone(base); snapshot.id = `history-${index}`; snapshot.reportId = reportId; snapshot.dashboard.id = reportId; snapshot.dashboard.publishMetadata.publishCount = count; snapshot.versionLabel = `v${count}`; return snapshot; });
  for (let seed = 1; seed <= 64; seed += 1) {
    const latest = { ...value, publishedSnapshots: snapshots.filter((_snapshot, index) => ((seed >> (index % 6)) & 1) === 1).reverse() };
    const acknowledged = { ...value, publishedSnapshots: snapshots.filter((_snapshot, index) => ((seed >> ((index + 3) % 6)) & 1) === 1) };
    const result = reconcileAcknowledgedHistory(latest, acknowledged); expect(result.issues).toEqual([]);
    const ids = new Set([...latest.publishedSnapshots, ...acknowledged.publishedSnapshots].map(snapshot => snapshot.id));
    expect(new Set(result.workspace.publishedSnapshots.map(snapshot => snapshot.id))).toEqual(ids);
    for (const report of value.reports) {
      const counts = result.workspace.publishedSnapshots.filter(snapshot => snapshot.reportId === report.id).map(snapshot => snapshot.dashboard.publishMetadata.publishCount);
      expect(counts).toEqual([...counts].sort((left, right) => right - left));
    }
  }
});
