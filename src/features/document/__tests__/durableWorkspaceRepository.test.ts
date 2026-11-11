import { afterEach, expect, it, vi } from "vitest";
import { createDurableWorkspaceRepository, workspaceDraftDigest, type PendingWorkspaceDraft } from "../durableWorkspaceRepository";

const valid: PendingWorkspaceDraft = { workspaceId: "synthetic", editorId: "editor", sequence: 1, expectedRevision: null, payload: "opaque original bytes" };
it.each([
  { workspaceId: "" }, { editorId: " " }, { sequence: 0 }, { sequence: Number.NaN }, { sequence: Number.MAX_SAFE_INTEGER + 1 },
  { expectedRevision: 0 }, { expectedRevision: -1 }, { expectedRevision: 1.5 }, { payload: undefined },
])("rejects invalid durable operation metadata before opening or writing storage (%j)", async updates => {
  const open = vi.fn(); const repository = createDurableWorkspaceRepository("synthetic-probe", { open } as unknown as IDBFactory);
  const input = { ...valid, ...updates } as PendingWorkspaceDraft;
  await expect(repository.stage(input)).rejects.toThrow("Invalid pending");
  await expect(repository.commit(input)).rejects.toThrow("Invalid pending"); expect(open).not.toHaveBeenCalled();
});
it("requires an explicit namespace and an available storage engine", () => {
  expect(() => createDurableWorkspaceRepository("", {} as IDBFactory)).toThrow("namespace");
  expect(() => createDurableWorkspaceRepository("synthetic-probe")).toThrow("unavailable");
});
it("rejects access after close without opening a database", async () => {
  const open = vi.fn(); const repository = createDurableWorkspaceRepository("synthetic-probe", { open } as unknown as IDBFactory);
  await repository.close(); await expect(repository.stage(valid)).rejects.toThrow("closed");
  await expect(repository.read(valid.workspaceId)).rejects.toThrow("closed"); await expect(repository.inspect(valid.workspaceId)).rejects.toThrow("closed"); expect(open).not.toHaveBeenCalled();
});
it("does not permanently cache a synchronous open failure", async () => {
  const open = vi.fn(() => { throw new Error("Synthetic open blocked"); });
  const repository = createDurableWorkspaceRepository("synthetic-probe", { open } as unknown as IDBFactory);
  await expect(repository.read(valid.workspaceId)).rejects.toThrow("Synthetic open blocked");
  await expect(repository.read(valid.workspaceId)).rejects.toThrow("Synthetic open blocked"); expect(open).toHaveBeenCalledTimes(2);
});
it("closes safely while an open fails without replacing the original read error", async () => {
  const repository = createDurableWorkspaceRepository("synthetic-probe", { open: () => { throw new Error("Synthetic initial open failure"); } } as unknown as IDBFactory);
  const reading = repository.read(valid.workspaceId), closing = repository.close();
  await expect(reading).rejects.toThrow("Synthetic initial open failure"); await expect(closing).resolves.toBeUndefined();
});

afterEach(() => vi.unstubAllGlobals());
it("fingerprints opaque strings without collapsing unpaired surrogates or expected revisions", async () => {
  const inputs = [valid, { ...valid, payload: "\\ud800" }, { ...valid, payload: "\ud800" }, { ...valid, payload: "\ufffd" }, { ...valid, expectedRevision: 1 }];
  const digests = await Promise.all(inputs.map(workspaceDraftDigest));
  expect(new Set(digests).size).toBe(inputs.length); expect(digests.every(value => /^[a-f0-9]{64}$/.test(value))).toBe(true);
  expect(await workspaceDraftDigest({ ...valid })).toBe(digests[0]);
  expect(digests[0]).toBe("fef8265e1cc2ba36a79c19904cd671587df8c2a152c3c0b1c4f26eb43fed48cc");
});
it("fails closed before opening storage when secure hashing is unavailable", async () => {
  vi.stubGlobal("crypto", {}); const open = vi.fn();
  const repository = createDurableWorkspaceRepository("synthetic-probe", { open } as unknown as IDBFactory);
  await expect(repository.stage(valid)).rejects.toThrow("Secure hashing");
  await expect(repository.commit(valid)).rejects.toThrow("Secure hashing"); expect(open).not.toHaveBeenCalled();
});

it("binds pre-operation recovery bytes into receipt identity while preserving legacy digests", async () => {
  const original = await workspaceDraftDigest(valid);
  expect(await workspaceDraftDigest({ ...valid, recoveryPayload: undefined })).toBe(original);
  const inputs = ["", "original", "modified", "\ud800", "\ufffd"];
  const digests = await Promise.all(inputs.map(recoveryPayload => workspaceDraftDigest({ ...valid, recoveryPayload })));
  expect(new Set([original, ...digests]).size).toBe(inputs.length + 1);
});
it.each([null, 7, {}, []])("rejects malformed pre-operation recovery metadata before storage access (%j)", async recoveryPayload => {
  const open = vi.fn(), repo = createDurableWorkspaceRepository("synthetic-probe", { open } as unknown as IDBFactory);
  const invalid = { ...valid, recoveryPayload } as PendingWorkspaceDraft;
  await expect(repo.stage(invalid)).rejects.toThrow("Invalid pending"); await expect(repo.commit(invalid)).rejects.toThrow("Invalid pending"); expect(open).not.toHaveBeenCalled();
});
