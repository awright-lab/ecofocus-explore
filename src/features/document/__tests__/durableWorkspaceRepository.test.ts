import { expect, it, vi } from "vitest";
import { createDurableWorkspaceRepository, type PendingWorkspaceDraft } from "../durableWorkspaceRepository";

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
  await expect(repository.read(valid.workspaceId)).rejects.toThrow("closed"); expect(open).not.toHaveBeenCalled();
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
