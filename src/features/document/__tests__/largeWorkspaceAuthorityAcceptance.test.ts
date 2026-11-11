// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createDurableWorkspaceSession } from "../durableWorkspaceSession";
import { createLegacyWorkspaceCopyCommitter, inspectWorkspaceAuthority } from "../workspaceAuthorityPreparation";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace, readStoredWorkspaceCopy, saveDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { syntheticStudy } from "./fixtures/syntheticStudy";
import type { DurableWorkspaceHead, PendingWorkspaceDraft } from "../durableWorkspaceRepository";

afterEach(() => { vi.restoreAllMocks(); });

it("round-trips complete large current and historical studies through explicit durable authority after real synthetic Web Storage quota refusal", async () => {
  // Real jsdom Web Storage quota, but a deterministic in-memory transactional
  // repository contract. This is not native IndexedDB/disk/crash acceptance.
  const original = { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), id: "synthetic-original" };
  expect(saveDashboardWorkspace(original)).toBe(true); const legacyBytes = readStoredWorkspaceCopy();
  const heads = new Map<string, DurableWorkspaceHead>(), pending = new Map<string, PendingWorkspaceDraft>();
  const key = (draft: PendingWorkspaceDraft) => JSON.stringify([draft.workspaceId, draft.editorId]);
  const repo = {
    inspect: async (workspaceId: string) => ({ head: heads.get(workspaceId) ?? null, pending: [...pending.values()].filter(draft => draft.workspaceId === workspaceId) }),
    stage: async (draft: PendingWorkspaceDraft) => { pending.set(key(draft), structuredClone(draft)); return { kind: "staged" as const }; },
    commit: async (draft: PendingWorkspaceDraft) => {
      const revision = heads.get(draft.workspaceId)?.revision ?? null;
      if (revision !== draft.expectedRevision) return { kind: "conflict" as const, revision };
      const next = (revision ?? 0) + 1; heads.set(draft.workspaceId, { workspaceId: draft.workspaceId, revision: next, payload: draft.payload }); pending.delete(key(draft));
      return { kind: "saved" as const, revision: next };
    }
  };
  const migration = createLegacyWorkspaceCopyCommitter({ workspaceId: "synthetic-large-copy", editorId: "migration-only", storage: localStorage, repository: repo });
  migration.prepare(); expect(await migration.saveCopy()).toMatchObject({ kind: "saved-copy", revision: 1 });
  const selection = { kind: "durable" as const, workspaceId: "synthetic-large-copy" };
  const selected = await inspectWorkspaceAuthority(selection, { storage: localStorage, repository: repo });
  if (selected.kind !== "durable-ready") throw Error("Synthetic durable authority did not open");
  const { dataset } = await syntheticStudy(1000, 4);
  dataset.rows = dataset.rows.map(row => ({ ...row, Segment: "H".repeat(3100) })); dataset.previewRows = dataset.rows.slice(0, 2);
  const seed = { ...selected.workspace, importedDatasets: [dataset] };
  let large = createPublishedSnapshot(seed, { ...seed.reports[0].draft, importedDatasets: [dataset] }).workspace;
  large.reports[0].draft.importedDatasets = [];
  large.importedDatasets = [structuredClone(dataset)]; large.importedDatasets[0].rows[0].Segment = "C".repeat(3100);
  Object.assign(large, { futureExtension: { opaque: "\ud800", preserved: true } });
  const originalPayload = JSON.stringify(large), historyRows = structuredClone(large.publishedSnapshots[0].dashboard.importedDatasets[0].rows);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(saveDashboardWorkspace(large)).toBe(false);
  expect(warning).toHaveBeenCalledWith("Unable to save InsightCanvas workspace because local browser storage is full.", expect.objectContaining({ name: "QuotaExceededError" }));
  expect(readStoredWorkspaceCopy()).toBe(legacyBytes);
  const session = createDurableWorkspaceSession(repo, selection.workspaceId, "durable-editor"); await session.open();
  expect(await session.save(large)).toEqual({ kind: "saved", revision: 2 }); session.close();
  const reopened = await inspectWorkspaceAuthority(selection, { storage: localStorage, repository: repo });
  if (reopened.kind !== "durable-ready") throw Error("Synthetic saved authority did not reopen");
  expect(JSON.parse(reopened.payload).payload).toBe(originalPayload);
  expect(reopened.workspace.importedDatasets[0].rows).toEqual(large.importedDatasets[0].rows);
  expect(reopened.workspace.publishedSnapshots[0].dashboard.importedDatasets[0].rows).toEqual(historyRows);
  expect(reopened.workspace.importedDatasets[0].rows[0].Segment[0]).toBe("C");
  expect(reopened.workspace.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Segment[0]).toBe("H");
  expect(reopened.workspace.importedDatasets[0].rows).toHaveLength(1000); expect(readStoredWorkspaceCopy()).toBe(legacyBytes);
  expect((await inspectWorkspaceAuthority({ kind: "legacy" }, { storage: localStorage, repository: repo })).kind).toBe("legacy-only");
}, 30000);
