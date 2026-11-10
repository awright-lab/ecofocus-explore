import { expect, it, vi } from "vitest";
import { createFailedWorkspaceRecoveryJournal } from "../failedWorkspaceRecoveryJournal";
import { createWorkspaceSaveSession } from "../workspaceSaveSession";
import { decodeDurableWorkspace } from "../durableWorkspaceRecovery";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { syntheticStudy } from "./fixtures/syntheticStudy";
import type { PendingWorkspaceDraft } from "../durableWorkspaceRepository";

function workspace(label = "Synthetic recovery") {
  return { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), id: "synthetic", label };
}
function deferred<T>() { let resolve!: (value: T) => void, reject!: (value: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture() {
  const repo = { stage: vi.fn().mockResolvedValue({ kind: "staged" }), pendingAll: vi.fn().mockResolvedValue([]) };
  return { repo, journal: createFailedWorkspaceRecoveryJournal(() => repo, () => "synthetic-editor") };
}
it("keeps the primary failed save false and protects a captured recovery copy only after acknowledgement", async () => {
  const { repo, journal } = fixture(), waiting = deferred<{ kind: string }>(); repo.stage.mockReturnValue(waiting.promise);
  const original = workspace(), session = createWorkspaceSaveSession(() => false, () => original, undefined, undefined, journal.retain);
  expect(session.save(original)).toBe(false); expect(session.getFailure()).toBe("storage");
  expect(journal.getSnapshot().status).toBe("saving"); original.label = "Caller mutation";
  expect(decodeDurableWorkspace(repo.stage.mock.calls[0][0].payload, original.id).label).toBe("Synthetic recovery");
  waiting.resolve({ kind: "staged" }); await tick(); expect(journal.getSnapshot().status).toBe("retained");
  expect(session.hasPending()).toBe(true); expect(session.getFailure()).toBe("storage");
});
it("retains the safe recovery workspace rather than a failed destructive target", async () => {
  const { repo, journal } = fixture(), before = workspace("Original before removal"), after = workspace("Removal attempt");
  const session = createWorkspaceSaveSession(() => false, () => before, undefined, undefined, journal.retain);
  expect(session.save(after, before)).toBe(false); await tick();
  expect(decodeDurableWorkspace(repo.stage.mock.calls[0][0].payload, before.id).label).toBe(before.label);
});
it("never invokes retention on a successful primary save and never clears retained copies on retry success", async () => {
  const { repo, journal } = fixture(), value = workspace(), write = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
  const session = createWorkspaceSaveSession(write, () => value, undefined, undefined, journal.retain);
  session.save(value); await tick(); expect(session.retry()).toBe(true); expect(session.hasPending()).toBe(false);
  expect(repo.stage).toHaveBeenCalledTimes(1); expect(journal.getSnapshot().status).toBe("retained");
});
it("does not let old acknowledgement or rejection describe a newer capture", async () => {
  const { repo, journal } = fixture(), a = deferred<unknown>(), b = deferred<unknown>(); repo.stage.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  journal.retain(workspace("old")); journal.retain(workspace("new")); a.resolve({ kind: "staged" }); await tick();
  expect(journal.getSnapshot()).toMatchObject({ status: "saving", source: { label: "new" } });
  b.reject(new Error("Quota")); await tick(); expect(journal.getSnapshot().status).toBe("failed");
});
it("invalid newer capture invalidates older completion ownership without discarding the old durable copy", async () => {
  const { repo, journal } = fixture(), a = deferred<unknown>(); repo.stage.mockReturnValueOnce(a.promise);
  journal.retain(workspace()); journal.retain({ ...workspace(), reports: [] }); a.resolve({ kind: "staged" }); await tick();
  expect(journal.getSnapshot().status).toBe("failed"); expect(repo.stage).toHaveBeenCalledTimes(1);
});
it("retries the exact failed draft identity and bytes without rereading mutable caller data", async () => {
  const { repo, journal } = fixture(); repo.stage.mockRejectedValueOnce(new Error("Quota exceeded")); const value = workspace();
  journal.retain(value); await tick(); const first = structuredClone(repo.stage.mock.calls[0][0]); value.label = "mutated";
  journal.retry(); await tick(); expect(repo.stage.mock.calls[1][0]).toEqual(first); expect(journal.getSnapshot().status).toBe("retained");
  expect(repo.stage.mock.calls[1][1]).toEqual({ maxDrafts: 50, maxPayloadCharacters: 16 * 1024 * 1024 });
});
it("ignores retry during retention and does not treat superseded or saved-head receipts as recovery retention", async () => {
  const { repo, journal } = fixture(); journal.retain(workspace()); journal.retry(); expect(repo.stage).toHaveBeenCalledTimes(1); await tick();
  for (const kind of ["saved", "superseded"]) { repo.stage.mockResolvedValueOnce({ kind }); journal.retain(workspace()); await tick(); expect(journal.getSnapshot().status).toBe("failed"); }
});
it("keeps the main failed save intact if recovery setup or listeners fail", () => {
  const value = workspace(), session = createWorkspaceSaveSession(() => false, () => value, undefined, undefined, () => { throw Error("No recovery store"); });
  expect(session.save(value)).toBe(false); expect(session.getPending()).toBe(value); expect(session.getFailure()).toBe("storage");
});
it("retains remembered unsaved edits and conflict copies without modifying a newer primary save", async () => {
  const { repo, journal } = fixture(), write = vi.fn(() => true), value = workspace(); let version = "old";
  const session = createWorkspaceSaveSession(write, () => value, () => version, undefined, journal.retain); session.load(); version = "new";
  expect(session.save(value)).toBe(false); expect(write).not.toHaveBeenCalled(); expect(session.getFailure()).toBe("conflict");
  const next = workspace("later edits"); session.remember(next); await tick(); expect(repo.stage).toHaveBeenCalledTimes(2); expect(journal.getSnapshot().source).toBe(next);
});
it("preserves full current and historical rows, reports, snapshots and unknown fields exactly", async () => {
  const { repo, journal } = fixture(), value = workspace(), { dataset } = await syntheticStudy(1000, 30);
  value.importedDatasets = [dataset]; value.reports[0].draft.importedDatasets = [structuredClone(dataset)];
  Object.assign(value, { futureExtension: { opaque: "\ud800", nested: [1, 2, 3] } });
  Object.assign(value.reports[0], { futureHistory: [{ rows: structuredClone(dataset.rows) }] });
  const published = createPublishedSnapshot(value, value.reports[0].draft);
  value.publishedSnapshots = published.workspace.publishedSnapshots;
  value.publishedSnapshots[0].dashboard.importedDatasets = [structuredClone(dataset)];
  const original = JSON.stringify(value); journal.retain(value); await tick();
  const envelope = JSON.parse(repo.stage.mock.calls[0][0].payload); expect(envelope.payload).toBe(original); expect(Date.parse(envelope.capturedAt)).toBeGreaterThan(0);
  expect(JSON.parse(envelope.payload).reports[0].futureHistory[0].rows).toHaveLength(1000);
  expect(JSON.parse(envelope.payload).publishedSnapshots[0].dashboard.importedDatasets[0].rows).toHaveLength(1000);
});
it("discovers prior tab copies read-only and leaves raw payloads available even if workspace decoding fails", async () => {
  const { repo, journal } = fixture(), raw: PendingWorkspaceDraft = { workspaceId: "older", editorId: "tab", sequence: 1, expectedRevision: null, payload: "opaque\ud800" };
  repo.pendingAll.mockResolvedValue([raw]); expect(await journal.inspect()).toEqual([raw]); expect(repo.stage).not.toHaveBeenCalled();
});
it("treats inaccessible startup storage as an error, not an empty recovered workspace", async () => {
  const journal = createFailedWorkspaceRecoveryJournal(() => { throw Error("Unavailable"); });
  await expect(async () => journal.inspect()).rejects.toThrow("Unavailable"); journal.retain(workspace()); expect(journal.getSnapshot().status).toBe("failed");
});

it("keeps simultaneous conflicting editors distinct and rediscovers committed staging after an interrupted lifetime", async () => {
  const drafts = new Map<string, PendingWorkspaceDraft>();
  const repo = { stage: vi.fn(async (draft: PendingWorkspaceDraft) => { drafts.set(JSON.stringify([draft.workspaceId, draft.editorId]), structuredClone(draft)); return { kind: "staged" as const }; }), pendingAll: async () => Array.from(drafts.values()) };
  const first = createFailedWorkspaceRecoveryJournal(() => repo, () => "tab-one"), second = createFailedWorkspaceRecoveryJournal(() => repo, () => "tab-two");
  first.retain(workspace("First tab conflict")); second.retain(workspace("Second tab conflict")); await tick();
  const reopened = createFailedWorkspaceRecoveryJournal(() => repo, () => "reopened");
  const copies = await reopened.inspect(); expect(copies).toHaveLength(2); expect(new Set(copies.map(copy => copy.editorId))).toEqual(new Set(["tab-one", "tab-two"]));
  expect(copies.map(copy => decodeDurableWorkspace(copy.payload, copy.workspaceId).label)).toEqual(["First tab conflict", "Second tab conflict"]);
  expect(repo.stage).toHaveBeenCalledTimes(2);
});

it("bounds stalled storage to one in-flight capture plus the latest full payload", async () => {
  const { repo, journal } = fixture(), stalled = deferred<unknown>(); repo.stage.mockReturnValueOnce(stalled.promise);
  journal.retain(workspace("first"));
  for (let index = 0; index < 100; index++) journal.retain(workspace("edit-" + index));
  expect(repo.stage).toHaveBeenCalledTimes(1); expect(journal.getSnapshot()).toMatchObject({ status: "saving", source: { label: "edit-99" } });
  stalled.resolve({ kind: "staged" }); await tick(); await tick();
  expect(repo.stage).toHaveBeenCalledTimes(2); expect(repo.stage.mock.calls[1][0].sequence).toBe(101);
  expect(decodeDurableWorkspace(repo.stage.mock.calls[1][0].payload, "synthetic").label).toBe("edit-99"); expect(journal.getSnapshot().status).toBe("retained");
});
