import { describe, expect, it, vi } from "vitest";
import { storageKey } from "../../builder/builderConstants";
import { initialDashboard } from "../documentSeeds";
import { inspectLegacyWorkspaceCopy, prepareLegacyWorkspaceCopy } from "../legacyWorkspaceMigration";
import { createPublishedSnapshot, createReportRecord, decodeStoredWorkspaceSource, legacyWorkspaceStorageKey, normalizeDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { encodeImportedRows } from "../workspaceRowStorage";
import { syntheticStudy, syntheticStudySums, expectedSyntheticSums } from "./fixtures/syntheticStudy";

function storage(values: Record<string, string>) {
  return { getItem: vi.fn((key: string) => values[key] ?? null), setItem: vi.fn(() => { throw new Error("Unexpected storage write"); }), removeItem: vi.fn(() => { throw new Error("Unexpected removal"); }) };
}
function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }

it("does not invent a migration when there is no saved source", () => {
  const source = storage({}); expect(prepareLegacyWorkspaceCopy("new-copy", source)).toBeNull(); expect(source.setItem).not.toHaveBeenCalled();
});
it("captures the newest raw text once, without falling through or writing storage", () => {
  const raw = JSON.stringify(workspace(), null, 2) + "\r\n";
  const source = storage({ [workspaceStorageKey]: raw, [legacyWorkspaceStorageKey]: "damaged old save" });
  const copy = prepareLegacyWorkspaceCopy("new-copy", source)!;
  expect(source.getItem.mock.calls).toEqual([[workspaceStorageKey]]);
  expect(inspectLegacyWorkspaceCopy(copy.payload).source).toEqual({ key: workspaceStorageKey, raw });
  expect(source.setItem).not.toHaveBeenCalled(); expect(source.removeItem).not.toHaveBeenCalled();
});
it.each(["", "null", "{damaged"])("does not hide a damaged winning source (%j)", raw => {
  const source = storage({ [workspaceStorageKey]: raw, [legacyWorkspaceStorageKey]: JSON.stringify(workspace()) });
  expect(() => prepareLegacyWorkspaceCopy("new-copy", source)).toThrow(); expect(source.getItem.mock.calls).toEqual([[workspaceStorageKey]]); expect(source.setItem).not.toHaveBeenCalled();
});
it("propagates blocked reads without creating a replacement", () => {
  expect(() => prepareLegacyWorkspaceCopy("new-copy", { getItem: () => { throw new Error("Read denied"); } })).toThrow("Read denied");
});
it.each(["", " ", "local_workspace"])("requires a distinct nonempty destination (%j)", id => {
  expect(() => prepareLegacyWorkspaceCopy(id, storage({ [workspaceStorageKey]: JSON.stringify(workspace()) }))).toThrow(/separate/);
});
it.each([workspaceStorageKey, legacyWorkspaceStorageKey, storageKey])("reopens %s with original rows, modeling, report selection and exact raw text", async key => {
  const { dataset } = await syntheticStudy(1000, 60);
  const original = workspace(); original.importedDatasets = [dataset]; original.reports[0].draft.importedDatasets = [dataset];
  original.reports[0].draft.title = "Synthetic Unicode study – 日本語";
  const value = key === storageKey ? original.reports[0].draft : original;
  const raw = JSON.stringify(value, null, 2) + "\r\n";
  const source = storage({ [key]: raw }); const copy = prepareLegacyWorkspaceCopy("separate-copy", source)!;
  // Reopen solely from the copy after the source storage changes/disappears.
  const reopened = inspectLegacyWorkspaceCopy(copy.payload);
  expect(reopened.source.raw).toBe(raw); expect(reopened.workspace.id).toBe("separate-copy");
  expect(reopened.workspace.activeReportId).toBe(original.activeReportId);
  expect(reopened.workspace.importedDatasets[0]).toMatchObject(dataset);
  expect(reopened.workspace.importedDatasets[0].rows).toEqual(dataset.rows);
  expect(reopened.workspace.importedDatasets[0].fields).toEqual(copy.workspace.importedDatasets[0].fields);
  expect(syntheticStudySums(reopened.workspace.importedDatasets[0])).toEqual(expectedSyntheticSums(1000));
  expect(reopened.inventory.requiresSourceData).toBe(false); expect(source.setItem).not.toHaveBeenCalled(); expect(source.removeItem).not.toHaveBeenCalled();
});
it("keeps historical and current same-ID study versions distinct, including encoded rows and raw extensions", async () => {
  const { dataset } = await syntheticStudy(100, 8); let original = workspace(); original.importedDatasets = [dataset];
  original = createPublishedSnapshot(original, original.reports[0].draft).workspace;
  original.importedDatasets[0] = structuredClone(dataset); original.importedDatasets[0].rows[0].Spend = "999";
  original.publishedSnapshots[0].dashboard.importedDatasets = [encodeImportedRows(dataset)];
  const raw = JSON.stringify({ ...original, futureExtension: { untouched: "raw metadata" } }, null, 2);
  const copy = prepareLegacyWorkspaceCopy("historical-copy", storage({ [workspaceStorageKey]: raw }))!;
  const reopened = inspectLegacyWorkspaceCopy(copy.payload);
  expect(reopened.workspace.importedDatasets[0].rows[0].Spend).toBe("999");
  expect(reopened.workspace.publishedSnapshots[0].dashboard.importedDatasets[0].rows).toEqual(dataset.rows);
  expect(reopened.source.raw).toBe(raw); expect(JSON.parse(reopened.source.raw).futureExtension).toEqual({ untouched: "raw metadata" });
});
it("refuses conflicting current study identities rather than collapsing them into a migration", async () => {
  const { dataset } = await syntheticStudy(100, 4); const original = workspace();
  original.importedDatasets = [dataset]; original.reports[0].draft.importedDatasets = [structuredClone(dataset)];
  original.reports[0].draft.importedDatasets[0].rows[0].Spend = "999";
  expect(() => prepareLegacyWorkspaceCopy("conflict-copy", storage({ [workspaceStorageKey]: JSON.stringify(original) }))).toThrow("conflicting data");
});
it("discloses incomplete remote rows instead of fabricating full coverage or fetching", async () => {
  const { dataset } = await syntheticStudy(100, 4); const original = workspace();
  dataset.remote = { provider: "netlify", projectUrl: "", bucket: "", objectPath: "synthetic", uploadedAt: dataset.importedAt };
  dataset.rows = []; dataset.previewRows = dataset.previewRows.slice(0, 2); original.importedDatasets = [dataset];
  const copy = prepareLegacyWorkspaceCopy("partial-copy", storage({ [workspaceStorageKey]: JSON.stringify(original) }))!;
  expect(copy.inventory.requiresRemoteAccess).toBe(true); expect(copy.inventory.requiresSourceData).toBe(true);
  expect(copy.workspace.importedDatasets[0].rowCount).toBe(100); expect(copy.workspace.importedDatasets[0].rows).toEqual([]);
});
describe("migration envelope validation", () => {
  const source = { key: workspaceStorageKey, raw: JSON.stringify(workspace()) };
  it.each([null, [], {}, { kind: "unknown", version: 1, workspaceId: "copy", source },
    { kind: "ecofocus-legacy-workspace-copy", version: 2, workspaceId: "copy", source },
    { kind: "ecofocus-legacy-workspace-copy", version: 1, workspaceId: "copy", source: { key: "unknown", raw: source.raw } },
    { kind: "ecofocus-legacy-workspace-copy", version: 1, workspaceId: "copy", source: { key: workspaceStorageKey, raw: null } },
  ])("rejects unsupported or incomplete envelopes (%j)", value => { expect(() => inspectLegacyWorkspaceCopy(JSON.stringify(value))).toThrow("migration copy"); });
  it("rejects unknown source keys at the decoder boundary", () => {
    expect(() => decodeStoredWorkspaceSource({ key: "unknown", raw: source.raw } as never)).toThrow("Unknown saved workspace format");
  });
});
