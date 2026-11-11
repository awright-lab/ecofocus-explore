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

it("bounds a burst to one active operation and the newest pending capture with explicit supersession", async () => {
  const repo = repository(), commit = deferred<DurableCommitResult>(); repo.commit.mockReturnValueOnce(commit.promise);
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const first = session.save(workspace("First"));
  const burst = Array.from({ length: 100 }, (_, index) => session.save(workspace(`Edit ${index}`)));
  expect(await Promise.all(burst.slice(0, -1))).toEqual(Array.from({ length: 99 }, () => ({ kind: "superseded" })));
  expect(repo.stage).toHaveBeenCalledTimes(1);
  commit.resolve({ kind: "saved", revision: 1 });
  expect(await first).toEqual({ kind: "saved", revision: 1 });
  expect(await burst[99]).toEqual({ kind: "saved", revision: 2 });
  expect(repo.stage.mock.calls.map(([op]) => [op.sequence, op.expectedRevision])).toEqual([[1, null], [101, 1]]);
  expect(decodeDurableWorkspace(repo.stage.mock.calls[1][0].payload, "synthetic").label).toBe("Edit 99");
});
it("retains exact pre-destructive bytes including extensions through failure and uncertain retry", async () => {
  const repo = repository(); repo.commit.mockRejectedValueOnce(new Error("Unknown outcome"));
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const before = Object.assign(workspace("Before"), { futureExtension: { opaque: ["keep", 7] } });
  const target = workspace("After"); const expectedBefore = encodeDurableWorkspace(before);
  await expect(session.save(target, before)).rejects.toThrow("Unknown outcome"); before.futureExtension.opaque[0] = "changed";
  const original = structuredClone(repo.stage.mock.calls[0][0]);
  expect(original.recoveryPayload).toBe(expectedBefore); expect(original.payload).toBe(encodeDurableWorkspace(target));
  expect(session.getSnapshot()).toMatchObject({ pendingPayload: original.payload, pendingRecoveryPayload: expectedBefore });
  repo.stage.mockResolvedValueOnce({ kind: "saved", revision: 1 });
  expect(await session.retry()).toEqual({ kind: "saved", revision: 1 });
  expect(repo.stage.mock.calls[1][0]).toEqual(original); expect(repo.commit).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot().pendingRecoveryPayload).toBeNull();
});
it("never lets an older acknowledgement clear the newest pre-operation recovery bytes", async () => {
  const repo = repository(), firstCommit = deferred<DurableCommitResult>(), secondCommit = deferred<DurableCommitResult>();
  repo.commit.mockReturnValueOnce(firstCommit.promise).mockReturnValueOnce(secondCommit.promise);
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const first = session.save(workspace("First")); const before = workspace("Before destructive edit");
  const second = session.save(workspace("After destructive edit"), before);
  firstCommit.resolve({ kind: "saved", revision: 1 }); await first;
  expect(session.getSnapshot().pendingRecoveryPayload).toBe(encodeDurableWorkspace(before));
  secondCommit.resolve({ kind: "saved", revision: 2 }); await second;
  expect(session.getSnapshot().pendingRecoveryPayload).toBeNull();
});
it("shares retry work and coalesces new edits without replacing uncertain operation identity", async () => {
  const repo = repository(); repo.commit.mockRejectedValueOnce(new Error("Unknown"));
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  await expect(session.save(workspace("First"), workspace("Original"))).rejects.toThrow("Unknown");
  const original = structuredClone(repo.stage.mock.calls[0][0]), stage = deferred<Awaited<ReturnType<Repo["stage"]>>>(); repo.stage.mockReturnValueOnce(stage.promise);
  const retry = session.retry(); expect(session.retry()).toBe(retry);
  const middle = session.save(workspace("Middle")), newest = session.save(workspace("Newest")); expect(await middle).toEqual({ kind: "superseded" });
  stage.resolve({ kind: "saved", revision: 1 });
  expect(await retry).toEqual({ kind: "saved", revision: 2 }); expect(await newest).toEqual({ kind: "saved", revision: 2 });
  expect(repo.stage.mock.calls[1][0]).toEqual(original); expect(repo.stage.mock.calls.map(([op]) => op.sequence)).toEqual([1, 1, 3]);
});
it("settles queued saves immediately on close without waiting for an unresolved commit", async () => {
  const repo = repository(), commit = deferred<DurableCommitResult>(); repo.commit.mockReturnValueOnce(commit.promise);
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const active = session.save(workspace("Active")), queued = session.save(workspace("Queued")); await tick();
  session.close(); expect(await queued).toEqual({ kind: "blocked", reason: "closed" });
  commit.resolve({ kind: "saved", revision: 1 }); await active; expect(repo.stage).toHaveBeenCalledTimes(1);
});
it("rejects an invalid recovery workspace without displacing an already captured pending save", async () => {
  const repo = repository(), commit = deferred<DurableCommitResult>(); repo.commit.mockReturnValueOnce(commit.promise);
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  const active = session.save(workspace("Active")), queued = session.save(workspace("Queued"));
  await expect(session.save(workspace("Invalid"), { ...workspace(), id: "different" })).rejects.toThrow("another workspace");
  expect(decodeDurableWorkspace(session.getSnapshot().pendingPayload!, "synthetic").label).toBe("Queued");
  commit.resolve({ kind: "saved", revision: 1 }); await active; expect((await queued).kind).toBe("saved");
});
it("does not start a second operation from a synchronous saving subscriber", async () => {
  const repo = repository(), commit = deferred<DurableCommitResult>(); repo.commit.mockReturnValueOnce(commit.promise);
  const session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  let queued: ReturnType<typeof session.save> | undefined, submitted = false;
  session.subscribe(() => { if (session.getSnapshot().saving && !submitted) { submitted = true; queued = session.save(workspace("From listener")); } });
  const first = session.save(workspace("First")); await tick(); expect(repo.stage).toHaveBeenCalledTimes(1);
  commit.resolve({ kind: "saved", revision: 1 }); await first; expect(await queued).toEqual({ kind: "saved", revision: 2 });
  expect(repo.stage.mock.calls.map(([op]) => op.expectedRevision)).toEqual([null, 1]);
});
it("does not stage or commit when a synchronous saving subscriber closes the session", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  session.subscribe(() => { if (session.getSnapshot().saving) session.close(); });
  expect(await session.save(workspace())).toEqual({ kind: "blocked", reason: "closed" });
  expect(repo.stage).not.toHaveBeenCalled(); expect(repo.commit).not.toHaveBeenCalled();
  expect(session.getSnapshot()).toMatchObject({ mode: "closed", saving: false });
});
it("does not commit when a synchronous durable-stage subscriber closes the session", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  session.subscribe(() => { if (session.getSnapshot().pendingDurable) session.close(); });
  expect(await session.save(workspace())).toEqual({ kind: "blocked", reason: "closed" });
  expect(repo.stage).toHaveBeenCalledTimes(1); expect(repo.commit).not.toHaveBeenCalled();
});
it("does not stage when a synchronous capture subscriber closes the session", async () => {
  const repo = repository(), session = createDurableWorkspaceSession(repo, "synthetic", "editor"); await session.open();
  session.subscribe(() => { if (session.getSnapshot().pendingPayload) session.close(); });
  expect(await session.save(workspace())).toEqual({ kind: "blocked", reason: "closed" });
  expect(repo.stage).not.toHaveBeenCalled(); expect(repo.commit).not.toHaveBeenCalled();
});
