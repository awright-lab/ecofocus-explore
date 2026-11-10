import { expect, it } from "vitest";
import { initialDashboard } from "../documentSeeds";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
it("advances beyond acknowledged history when a newer draft has stale snapshot metadata", () => {
  const value = workspace(), draft = value.reports[0].draft;
  const first = createPublishedSnapshot(value, draft);
  const retained = { ...value, publishedSnapshots: [first.snapshot] }, before = structuredClone(retained);
  const next = createPublishedSnapshot(retained, { ...draft, title: "Newer edited draft" });
  expect(next.snapshot.versionLabel).toBe("v2"); expect(next.dashboard.publishMetadata.publishCount).toBe(2);
  expect(next.workspace.publishedSnapshots.map(snapshot => snapshot.versionLabel)).toEqual(["v2", "v1"]);
  expect(next.snapshot.dashboard.title).toBe("Newer edited draft"); expect(retained).toEqual(before);
});
it("uses a newer saved report counter even when the caller is stale and history is unavailable", () => {
  const value = workspace(), stale = structuredClone(value.reports[0].draft);
  value.reports[0].draft.publishMetadata.publishCount = 6;
  expect(createPublishedSnapshot(value, stale).snapshot.versionLabel).toBe("v7");
});
it("does not take version numbers from another report", () => {
  const value = workspace(), other = structuredClone(initialDashboard); other.id = "other-report"; other.publishMetadata.publishCount = 99;
  const otherSnapshot = createPublishedSnapshot({ ...value, reports: [createReportRecord(other)] }, other).snapshot;
  value.publishedSnapshots = [otherSnapshot];
  expect(createPublishedSnapshot(value, value.reports[0].draft).snapshot.versionLabel).toBe("v1");
});
it("keeps a higher current draft counter ahead of historical versions", () => {
  const value = workspace(), draft = value.reports[0].draft;
  value.publishedSnapshots = [createPublishedSnapshot(value, draft).snapshot]; draft.publishMetadata.publishCount = 10;
  expect(createPublishedSnapshot(value, draft).snapshot.versionLabel).toBe("v11");
});
it.each([-1, 0.5, NaN, Number.MAX_SAFE_INTEGER])("rejects invalid or exhausted current counters without changing saved inputs (%s)", count => {
  const value = workspace(); value.reports[0].draft.publishMetadata.publishCount = count; const before = structuredClone(value);
  expect(() => createPublishedSnapshot(value, value.reports[0].draft)).toThrow(/version/); expect(value).toEqual(before);
});
it("rejects inconsistent historical counters for the same report", () => {
  const value = workspace(); value.publishedSnapshots = [createPublishedSnapshot(value, value.reports[0].draft).snapshot]; value.publishedSnapshots[0].dashboard.publishMetadata.publishCount = -1;
  expect(() => createPublishedSnapshot(value, value.reports[0].draft)).toThrow("inconsistent");
});
