import { expect, it, vi } from "vitest";
import { createLegacyWorkspaceCopyCommitter, inspectWorkspaceAuthority } from "../workspaceAuthorityPreparation";
import { createReportRecord, normalizeDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { inspectLegacyWorkspaceCopy } from "../legacyWorkspaceMigration";
import { encodeDurableWorkspace } from "../durableWorkspaceRecovery";
import type { DurableWorkspaceHead, PendingWorkspaceDraft } from "../durableWorkspaceRepository";

function workspace(id = "legacy-original") {
  return { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), id, label: "Synthetic authority study" };
}
function fixture() {
  const raw = JSON.stringify({ ...workspace(), futureExtension: { opaque: "\ud800", exact: "keep original bytes" } }, null, 2) + "\r\n";
  const values = new Map<string, string>([[workspaceStorageKey, raw]]);
  const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn(() => { throw Error("Unexpected legacy write"); }), removeItem: vi.fn(() => { throw Error("Unexpected legacy removal"); }) };
  const heads = new Map<string, DurableWorkspaceHead>(), pending = new Map<string, PendingWorkspaceDraft>();
  const receipts = new Map<string, { draft: PendingWorkspaceDraft; revision: number }>();
  const key = (draft: PendingWorkspaceDraft) => JSON.stringify([draft.workspaceId, draft.editorId]);
  const api = {
    inspect: vi.fn(async (workspaceId: string) => ({ head: heads.get(workspaceId) ?? null, pending: [...pending.values()].filter(draft => draft.workspaceId === workspaceId) })),
    stage: vi.fn(async (draft: PendingWorkspaceDraft) => {
      const receipt = receipts.get(key(draft));
      if (receipt) {
        if (JSON.stringify(receipt.draft) !== JSON.stringify(draft)) throw Error("Changed operation identity");
        return { kind: "saved" as const, revision: receipt.revision };
      }
      pending.set(key(draft), structuredClone(draft)); return { kind: "staged" as const };
    }),
    commit: vi.fn(async (draft: PendingWorkspaceDraft) => {
      const revision = heads.get(draft.workspaceId)?.revision ?? null;
      if (revision !== draft.expectedRevision) return { kind: "conflict" as const, revision };
      const next = (revision ?? 0) + 1;
      heads.set(draft.workspaceId, { workspaceId: draft.workspaceId, revision: next, payload: draft.payload });
      receipts.set(key(draft), { draft: structuredClone(draft), revision: next }); pending.delete(key(draft));
      return { kind: "saved" as const, revision: next };
    })
  };
  const create = () => createLegacyWorkspaceCopyCommitter({ workspaceId: "separate-copy", editorId: "unique-editor", storage, repository: api });
  return { raw, values, storage, heads, pending, api, create };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));

it("keeps explicitly selected legacy authority even when a durable copy exists", async () => {
  const f = fixture(); f.heads.set("separate-copy", { workspaceId: "separate-copy", revision: 1, payload: encodeDurableWorkspace(workspace("separate-copy")) });
  const result = await inspectWorkspaceAuthority({ kind: "legacy" }, { storage: f.storage, repository: f.api });
  expect(result).toMatchObject({ kind: "legacy-only", source: { key: workspaceStorageKey, raw: f.raw }, workspace: { id: "legacy-original" } });
  expect(f.api.inspect).not.toHaveBeenCalled(); expect(f.storage.setItem).not.toHaveBeenCalled();
});
it("reports empty legacy storage without fabricating or saving a default workspace", async () => {
  const f = fixture(); f.values.clear();
  expect(await inspectWorkspaceAuthority({ kind: "legacy" }, { storage: f.storage, repository: f.api })).toEqual({ kind: "legacy-only", source: null, workspace: null });
  expect(f.api.stage).not.toHaveBeenCalled(); expect(f.storage.setItem).not.toHaveBeenCalled();
});
it("does not fall through to older legacy data when the winning source is damaged", async () => {
  const f = fixture(); f.values.set(workspaceStorageKey, "{bad"); f.values.set(legacyWorkspaceStorageKey, f.raw);
  expect(await inspectWorkspaceAuthority({ kind: "legacy" }, { storage: f.storage, repository: f.api })).toMatchObject({ kind: "unavailable" });
  expect(f.storage.getItem.mock.calls).toEqual([[workspaceStorageKey]]);
});
it("opens only an explicitly selected durable head without reading or writing legacy storage", async () => {
  const f = fixture(), payload = encodeDurableWorkspace(workspace("chosen"));
  f.heads.set("chosen", { workspaceId: "chosen", revision: 3, payload }); f.storage.getItem.mockImplementation(() => { throw Error("Legacy access unavailable"); });
  expect(await inspectWorkspaceAuthority({ kind: "durable", workspaceId: "chosen" }, { storage: f.storage, repository: f.api })).toMatchObject({ kind: "durable-ready", workspaceId: "chosen", revision: 3, payload });
  expect(f.storage.getItem).not.toHaveBeenCalled(); expect(f.api.stage).not.toHaveBeenCalled();
});
it.each(["missing", "failed", "invalid"])("fails closed for %s selected authority without falling back to legacy", async failure => {
  const f = fixture(); if (failure === "failed") f.api.inspect.mockRejectedValue(Error("IndexedDB blocked"));
  const selection = failure === "invalid" ? { kind: "durable", workspaceId: " " } as const : { kind: "durable", workspaceId: "selected" } as const;
  expect(await inspectWorkspaceAuthority(selection, { storage: f.storage, repository: f.api })).toMatchObject({ kind: "unavailable" });
  expect(f.storage.getItem).not.toHaveBeenCalled(); expect(f.api.stage).not.toHaveBeenCalled();
});
it("requires recovery review for a selected durable copy with pending edits or unreadable saved bytes", async () => {
  const f = fixture(), payload = encodeDurableWorkspace(workspace("selected"));
  f.heads.set("selected", { workspaceId: "selected", revision: 2, payload });
  f.pending.set("prior", { workspaceId: "selected", editorId: "prior", sequence: 1, expectedRevision: 1, payload });
  const selected = { kind: "durable" as const, workspaceId: "selected" };
  expect(await inspectWorkspaceAuthority(selected, { storage: f.storage, repository: f.api })).toMatchObject({ kind: "recovery-required" });
  f.pending.clear(); f.heads.set("selected", { workspaceId: "selected", revision: 2, payload: "opaque original bytes" });
  const result = await inspectWorkspaceAuthority(selected, { storage: f.storage, repository: f.api });
  expect(result).toMatchObject({ kind: "recovery-required", recovery: { saved: { record: { payload: "opaque original bytes" } } } });
  expect(f.api.stage).not.toHaveBeenCalled();
});

it("prepares once without writing, preserving original source text and unknown fields", () => {
  const f = fixture(), committer = f.create(); const first = committer.prepare()!;
  first.inventory.reports = 999;
  f.values.set(workspaceStorageKey, JSON.stringify(workspace("newer-legacy")));
  expect(committer.prepare()!.inventory.reports).toBe(1);
  expect(inspectLegacyWorkspaceCopy(committer.getCapturedPayload()!).source.raw).toBe(f.raw);
  expect(f.api.stage).not.toHaveBeenCalled(); expect(f.storage.setItem).not.toHaveBeenCalled(); expect(f.storage.removeItem).not.toHaveBeenCalled();
});
it("will not save an unprepared copy or invent a migration when no source exists", async () => {
  const f = fixture(), committer = f.create();
  expect(await committer.saveCopy()).toEqual({ kind: "blocked", reason: "not-prepared" });
  f.values.clear(); expect(committer.prepare()).toBeNull(); expect(f.api.stage).not.toHaveBeenCalled();
});
it("commits a separate byte-preserving copy only after acknowledgement and does not select it", async () => {
  const f = fixture(), committer = f.create(); committer.prepare();
  const committing = deferred<Awaited<ReturnType<typeof f.api.commit>>>(), realCommit = f.api.commit.getMockImplementation()!;
  f.api.commit.mockImplementation(async draft => { const result = await realCommit(draft); await committing.promise; return result; });
  const result = committer.saveCopy(); await tick(); await tick(); await tick();
  expect(committer.getSnapshot().mode).toBe("saving"); expect(committer.getSnapshot().result).toBeNull();
  committing.resolve({ kind: "saved", revision: 1 });
  expect(await result).toEqual({ kind: "saved-copy", workspaceId: "separate-copy", revision: 1, sourceStatus: "unchanged" });
  expect(inspectLegacyWorkspaceCopy(f.heads.get("separate-copy")!.payload).source.raw).toBe(f.raw);
  expect(f.values.get(workspaceStorageKey)).toBe(f.raw); expect(f.storage.setItem).not.toHaveBeenCalled(); expect(f.storage.removeItem).not.toHaveBeenCalled();
  expect((await inspectWorkspaceAuthority({ kind: "legacy" }, { storage: f.storage, repository: f.api })).kind).toBe("legacy-only");
});
it.each(["before", "during-inspection"])("refuses a changed source %s staging", async when => {
  const f = fixture(), committer = f.create(); committer.prepare();
  if (when === "before") f.values.set(workspaceStorageKey, "changed");
  else f.api.inspect.mockImplementation(async () => { f.values.set(workspaceStorageKey, "changed"); return { head: null, pending: [] }; });
  expect(await committer.saveCopy()).toEqual({ kind: "source-changed", staged: false }); expect(f.api.stage).not.toHaveBeenCalled();
});
it("keeps the staged copy but refuses commit when an older tab changes legacy data during staging", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const stage = f.api.stage.getMockImplementation()!;
  f.api.stage.mockImplementation(async draft => { const result = await stage(draft); f.values.set(workspaceStorageKey, "newer legacy bytes"); return result; });
  expect(await committer.saveCopy()).toEqual({ kind: "source-changed", staged: true });
  expect(f.api.commit).not.toHaveBeenCalled(); expect(f.pending.size).toBe(1); expect(f.values.get(workspaceStorageKey)).toBe("newer legacy bytes");
});
it.each(["changed", "unavailable"])("truthfully reports a confirmed copy when the legacy source becomes %s during commit", async status => {
  const f = fixture(), committer = f.create(); committer.prepare(); const commit = f.api.commit.getMockImplementation()!;
  f.api.commit.mockImplementation(async draft => { const result = await commit(draft); if (status === "changed") f.values.set(workspaceStorageKey, "new bytes"); else f.storage.getItem.mockImplementation(() => { throw Error("Read blocked"); }); return result; });
  expect(await committer.saveCopy()).toEqual({ kind: "saved-copy", workspaceId: "separate-copy", revision: 1, sourceStatus: status });
  expect(f.heads.size).toBe(1); expect(f.storage.setItem).not.toHaveBeenCalled();
});
it("reconciles lost commit acknowledgement with the exact original identity, even if legacy changed", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const commit = f.api.commit.getMockImplementation()!;
  f.api.commit.mockImplementationOnce(async draft => { await commit(draft); throw Error("Acknowledgement lost"); });
  expect(await committer.saveCopy()).toMatchObject({ kind: "failed" }); const first = structuredClone(f.api.stage.mock.calls[0][0]);
  f.values.set(workspaceStorageKey, "changed afterward");
  expect(await committer.saveCopy()).toEqual({ kind: "saved-copy", workspaceId: "separate-copy", revision: 1, sourceStatus: "changed" });
  expect(f.api.stage.mock.calls[1][0]).toEqual(first); expect(f.api.commit).toHaveBeenCalledTimes(1); expect(f.heads.get("separate-copy")!.revision).toBe(1);
});
it("shares concurrent requests, caches acknowledgement and retries a failed stage without recapturing", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); f.api.stage.mockRejectedValueOnce(Error("Quota"));
  const first = committer.saveCopy(); expect(committer.saveCopy()).toBe(first); expect(await first).toMatchObject({ kind: "failed" });
  expect(await committer.saveCopy()).toMatchObject({ kind: "saved-copy" }); expect(f.api.stage.mock.calls[1][0]).toEqual(f.api.stage.mock.calls[0][0]);
  await committer.saveCopy(); expect(f.api.commit).toHaveBeenCalledTimes(1);
});
it.each(["head", "pending"])("does not overwrite an existing destination %s", async existing => {
  const f = fixture(), committer = f.create(); committer.prepare(); const payload = "unrelated original bytes";
  if (existing === "head") f.heads.set("separate-copy", { workspaceId: "separate-copy", revision: 1, payload });
  else f.pending.set("other", { workspaceId: "separate-copy", editorId: "other", sequence: 1, expectedRevision: null, payload });
  expect(await committer.saveCopy()).toEqual({ kind: "conflict" }); expect(f.api.stage).not.toHaveBeenCalled(); expect(f.api.commit).not.toHaveBeenCalled();
});
it("preserves both copies when another editor commits after destination inspection", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const stage = f.api.stage.getMockImplementation()!;
  f.api.stage.mockImplementation(async draft => { const result = await stage(draft); f.heads.set(draft.workspaceId, { workspaceId: draft.workspaceId, revision: 1, payload: "Other editor" }); return result; });
  expect(await committer.saveCopy()).toEqual({ kind: "conflict" }); expect(f.pending.size).toBe(1); expect(f.heads.get("separate-copy")!.payload).toBe("Other editor");
});
it("does not start work after close or commit after closing during stage", async () => {
  const f = fixture(), closed = f.create(); closed.prepare(); closed.close();
  expect(await closed.saveCopy()).toEqual({ kind: "blocked", reason: "closed" }); expect(f.api.stage).not.toHaveBeenCalled();
  const committer = f.create(); committer.prepare(); const staged = deferred<Awaited<ReturnType<typeof f.api.stage>>>(); f.api.stage.mockReturnValueOnce(staged.promise);
  const saving = committer.saveCopy(); await tick(); await tick(); committer.close(); staged.resolve({ kind: "staged" });
  expect(await saving).toEqual({ kind: "blocked", reason: "closed" }); expect(f.api.commit).not.toHaveBeenCalled();
});
it("does not pretend closing the view cancels an already committed copy", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const commit = f.api.commit.getMockImplementation()!;
  f.api.commit.mockImplementation(async draft => { const result = await commit(draft); committer.close(); return result; });
  expect(await committer.saveCopy()).toMatchObject({ kind: "saved-copy" }); expect(committer.getSnapshot().mode).toBe("closed");
});
it("rediscovers a completed copy after a new coordinator lifetime without touching legacy storage", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); await committer.saveCopy(); committer.close();
  const inspection = await inspectWorkspaceAuthority({ kind: "durable", workspaceId: "separate-copy" }, { storage: f.storage, repository: f.api });
  expect(inspection).toMatchObject({ kind: "durable-ready", workspaceId: "separate-copy", revision: 1, workspace: { id: "separate-copy" } });
  expect(f.values.get(workspaceStorageKey)).toBe(f.raw); expect(f.storage.setItem).not.toHaveBeenCalled();
});
it("reconciles a lost stage acknowledgement but does not commit if the source subsequently changed", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const stage = f.api.stage.getMockImplementation()!;
  f.api.stage.mockImplementationOnce(async draft => { await stage(draft); throw Error("Stage acknowledgement lost"); });
  expect(await committer.saveCopy()).toMatchObject({ kind: "failed" }); f.values.set(workspaceStorageKey, "changed source");
  expect(await committer.saveCopy()).toEqual({ kind: "source-changed", staged: true });
  expect(f.api.stage.mock.calls[1][0]).toEqual(f.api.stage.mock.calls[0][0]); expect(f.api.commit).not.toHaveBeenCalled(); expect(f.pending.size).toBe(1);
});
it("does not stage after closing during destination inspection", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const inspecting = deferred<Awaited<ReturnType<typeof f.api.inspect>>>();
  f.api.inspect.mockReturnValueOnce(inspecting.promise); const result = committer.saveCopy(); await tick(); committer.close();
  inspecting.resolve({ head: null, pending: [] }); expect(await result).toEqual({ kind: "blocked", reason: "closed" }); expect(f.api.stage).not.toHaveBeenCalled();
});
it("does not start repository work if a synchronous saving subscriber closes the committer", async () => {
  const f = fixture(), committer = f.create(); committer.prepare();
  committer.subscribe(() => { if (committer.getSnapshot().mode === "saving") committer.close(); });
  expect(await committer.saveCopy()).toEqual({ kind: "blocked", reason: "closed" }); expect(f.api.inspect).not.toHaveBeenCalled(); expect(f.api.stage).not.toHaveBeenCalled();
});
it("does not confuse a saved migration copy with activation permission when a foreign pending draft races it", async () => {
  const f = fixture(), committer = f.create(); committer.prepare(); const stage = f.api.stage.getMockImplementation()!;
  f.api.stage.mockImplementation(async draft => {
    const result = await stage(draft);
    f.pending.set("foreign", { ...draft, editorId: "foreign-editor", payload: "other pending bytes" }); return result;
  });
  expect(await committer.saveCopy()).toMatchObject({ kind: "saved-copy" }); expect(f.pending.size).toBe(1);
  expect(await inspectWorkspaceAuthority({ kind: "durable", workspaceId: "separate-copy" }, { storage: f.storage, repository: f.api })).toMatchObject({ kind: "recovery-required" });
});
