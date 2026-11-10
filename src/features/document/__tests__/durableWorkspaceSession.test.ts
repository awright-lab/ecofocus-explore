import { expect, it, vi } from "vitest";
import { createDurableWorkspaceSession } from "../durableWorkspaceSession";
import { decodeDurableWorkspace, encodeDurableWorkspace } from "../durableWorkspaceRecovery";
import { initialDashboard } from "../documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import type { DurableCommitResult } from "../durableWorkspaceRepository";

type Repo = Parameters<typeof createDurableWorkspaceSession>[0];
function workspace(title = "Synthetic") { const value = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); value.id = "synthetic"; value.label = title; return value; }
function repository() {
  return { inspect: vi.fn<Repo["inspect"]>().mockResolvedValue({ head: null, pending: [] }), stage: vi.fn<Repo["stage"]>().mockResolvedValue({ kind: "staged" }), commit: vi.fn<Repo["commit"]>().mockImplementation(async operation => ({ kind: "saved", revision: (operation.expectedRevision ?? 0) + 1 })) };
}
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));
it("does not write before startup inspection and does not claim memory-only edits are durable", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor");
  expect(await session.save(workspace())).toEqual({ kind: "blocked", reason: "unopened" }); expect(repo.stage).not.toHaveBeenCalled(); expect(session.getSnapshot().pendingPayload).toBeTruthy(); expect(session.getSnapshot().pendingDurable).toBe(false);
});
it("serializes captured edits and advances expected revision only after acknowledgement", async () => {
  const repo = repository(), firstCommit = deferred<DurableCommitResult>(); repo.commit.mockReturnValueOnce(firstCommit.promise);
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const first = workspace("First captured"), savingFirst = session.save(first); first.label = "mutated caller";
  const savingSecond = session.save(workspace("Latest captured")); await tick(); await tick();
  expect(repo.stage).toHaveBeenCalledTimes(1); expect(session.getSnapshot().saving).toBe(true); expect(session.getSnapshot().pendingDurable).toBe(false);
  firstCommit.resolve({ kind: "saved", revision: 1 }); await savingFirst; await savingSecond;
  expect(repo.stage.mock.calls.map(([op]) => [op.sequence, op.expectedRevision, decodeDurableWorkspace(op.payload, "synthetic").label])).toEqual([[1, null, "First captured"], [2, 1, "Latest captured"]]);
  expect(session.getSnapshot()).toMatchObject({ mode: "ready", pendingPayload: null, pendingDurable: false, saving: false });
});
it("retries the exact uncertain operation before committing newer queued edits", async () => {
  const repo = repository(); repo.commit.mockRejectedValueOnce(new Error("Lost acknowledgement")).mockResolvedValue({ kind: "saved", revision: 2 });
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const first = session.save(workspace("First")), later = session.save(workspace("Later")); await expect(first).rejects.toThrow("Lost acknowledgement"); expect((await later).kind).toBe("blocked");
  const originalOperation = structuredClone(repo.stage.mock.calls[0][0]); repo.stage.mockResolvedValueOnce({ kind: "saved", revision: 1 }).mockResolvedValue({ kind: "staged" });
  expect(await session.retry()).toEqual({ kind: "saved", revision: 2 }); expect(repo.stage.mock.calls[1][0]).toEqual(originalOperation);
  expect(repo.stage.mock.calls[2][0]).toMatchObject({ sequence: 2, expectedRevision: 1 }); expect(session.getSnapshot().pendingPayload).toBeNull();
});
it("pauses conflicting writes, retains newer edits in memory and never adopts the conflicting revision", async () => {
  const repo = repository(); repo.commit.mockResolvedValue({ kind: "conflict", revision: 9 });
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open(); expect((await session.save(workspace("Conflict"))).kind).toBe("conflict");
  expect(await session.save(workspace("Newest unsaved edit"))).toEqual({ kind: "blocked", reason: "conflict" }); expect((await session.retry()).kind).toBe("blocked");
  expect(repo.stage).toHaveBeenCalledTimes(1); expect(decodeDurableWorkspace(session.getSnapshot().pendingPayload!, "synthetic").label).toBe("Newest unsaved edit"); expect(session.getSnapshot().pendingDurable).toBe(false);
});
it("preserves a failed-stage payload and retries its original identity", async () => {
  const repo = repository(); repo.stage.mockRejectedValueOnce(new Error("Quota exceeded")); const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  await expect(session.save(workspace())).rejects.toThrow("Quota exceeded"); expect(session.getSnapshot()).toMatchObject({ mode: "failed", pendingDurable: false });
  expect(await session.retry()).toEqual({ kind: "saved", revision: 1 }); expect(repo.stage.mock.calls[1][0]).toEqual(repo.stage.mock.calls[0][0]); expect(session.getSnapshot().pendingPayload).toBeNull();
});
it("requires recovery review when pending candidates exist, even beside a valid saved workspace", async () => {
  const repo = repository(), payload = encodeDurableWorkspace(workspace()); repo.inspect.mockResolvedValue({ head: { workspaceId: "synthetic", revision: 1, payload }, pending: [{ workspaceId: "synthetic", editorId: "older", sequence: 1, expectedRevision: null, payload }] });
  const session = createDurableWorkspaceSession(repo, "synthetic", "new-editor"); expect((await session.open()).kind).toBe("needs_recovery"); expect((await session.save(workspace())).kind).toBe("blocked"); expect((await session.retry()).kind).toBe("blocked"); expect(repo.stage).not.toHaveBeenCalled();
});
it("does not begin a commit if the session closes while staging", async () => {
  const repo = repository(), staged = deferred<Awaited<ReturnType<Repo["stage"]>>>(); repo.stage.mockReturnValue(staged.promise); const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const saving = session.save(workspace()); await tick(); session.close(); staged.resolve({ kind: "staged" }); expect((await saving).kind).toBe("blocked"); expect(repo.commit).not.toHaveBeenCalled(); expect(session.getSnapshot().mode).toBe("closed");
});
it("cancels queued writes after close while allowing an already-running commit to settle", async () => {
  const repo = repository(), committing = deferred<DurableCommitResult>(); repo.commit.mockReturnValueOnce(committing.promise); const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const first = session.save(workspace("First")), second = session.save(workspace("Second")); await tick(); await tick(); session.close(); committing.resolve({ kind: "saved", revision: 1 });
  expect((await first).kind).toBe("saved"); expect((await second).kind).toBe("blocked"); expect(repo.stage).toHaveBeenCalledTimes(1); expect(session.getSnapshot().mode).toBe("closed");
});
it("rejects crossed or malformed workspace edits before any repository write", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open(); await expect(session.save({ ...workspace(), id: "other" })).rejects.toThrow("another workspace"); await expect(session.save({ ...workspace(), reports: [] })).rejects.toThrow(); expect(repo.stage).not.toHaveBeenCalled(); expect(session.getSnapshot().pendingPayload).toBeNull();
});
it("retries a failed startup read without hiding the failure as an empty workspace", async () => {
  const repo = repository(); repo.inspect.mockRejectedValueOnce(new Error("Read blocked")); const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await expect(session.open()).rejects.toThrow("Read blocked"); expect((await session.retry()).kind).toBe("blocked"); await session.open(); expect(session.getSnapshot().mode).toBe("ready");
});
it("returns unchanged rather than inventing a saved revision when nothing needs retrying", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open(); expect(await session.retry()).toEqual({ kind: "unchanged" }); expect(repo.stage).not.toHaveBeenCalled();
});
it("shares one startup inspection and does not reload a newer baseline during editing", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await Promise.all([session.open(), session.open()]); await session.save(workspace()); await session.open(); expect(repo.inspect).toHaveBeenCalledTimes(1);
});

it("does not replay an edit that was submitted while an uncertain retry already saved that latest edit", async () => {
  const repo = repository(); repo.commit.mockRejectedValueOnce(new Error("Lost acknowledgement"));
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open(); await expect(session.save(workspace("First"))).rejects.toThrow("Lost acknowledgement");
  const receipt = deferred<Awaited<ReturnType<Repo["stage"]>>>(); repo.stage.mockReturnValueOnce(receipt.promise);
  const retry = session.retry(); await tick(); const later = session.save(workspace("During retry")); receipt.resolve({ kind: "saved", revision: 1 });
  expect(await retry).toEqual({ kind: "saved", revision: 2 }); expect(await later).toEqual({ kind: "saved", revision: 2 }); expect(repo.stage).toHaveBeenCalledTimes(3); expect(repo.stage.mock.calls[2][0]).toMatchObject({ sequence: 2, expectedRevision: 1 }); expect(session.getSnapshot().pendingPayload).toBeNull();
});
