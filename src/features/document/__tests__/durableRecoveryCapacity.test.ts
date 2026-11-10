import { expect, it, vi } from "vitest";
import { createDurableWorkspaceRepository, type PendingWorkspaceDraft } from "../durableWorkspaceRepository";

// An event-order probe, not an IndexedDB emulator. Browser atomicity, disk
// persistence and mixed-tab behavior still require native acceptance.
function harness() {
  const requests: { store: string; method: string; request: any }[] = [];
  const writes: unknown[] = [];
  const tx: any = { abort: vi.fn(() => { queueMicrotask(() => tx.onabort()); }), objectStore: (store: string) => ({
    get: () => { const request = {}; requests.push({ store, method: "get", request }); return request; },
    getAll: () => { const request = {}; requests.push({ store, method: "getAll", request }); return request; },
    put: (value: unknown) => { writes.push(structuredClone(value)); return {}; }
  }) };
  const db: any = { close: vi.fn(), transaction: vi.fn(() => tx) };
  const factory = { open: () => { const request: any = { result: db }; queueMicrotask(() => request.onsuccess()); return request; } } as unknown as IDBFactory;
  const repo = createDurableWorkspaceRepository("synthetic-recovery-capacity", factory);
  async function reply(store: string, method: string, value: unknown) {
    await vi.waitFor(() => expect(requests.some(item => item.store === store && item.method === method)).toBe(true));
    const index = requests.findIndex(item => item.store === store && item.method === method), [{ request }] = requests.splice(index, 1);
    request.result = value; request.onsuccess();
  }
  return { repo, tx, db, writes, reply };
}
const draft: PendingWorkspaceDraft = { workspaceId: "synthetic", editorId: "editor", sequence: 1, expectedRevision: null, payload: "full original payload" };
async function prepare(h: ReturnType<typeof harness>, existing?: PendingWorkspaceDraft) { await h.reply("committedOperations", "get", undefined); await h.reply("pendingDrafts", "get", existing); }
it("acknowledges retention only on transaction completion, with strict durability and capacity checked in the write transaction", async () => {
  const h = harness(), saving = h.repo.stage(draft, { maxDrafts: 2, maxPayloadCharacters: 100 }); let done = false; void saving.then(() => { done = true; });
  await prepare(h); expect(h.writes).toEqual([]); await h.reply("pendingDrafts", "getAll", []); expect(h.writes).toEqual([draft]); await Promise.resolve(); expect(done).toBe(false);
  expect(h.db.transaction).toHaveBeenCalledWith(["workspaceHeads", "pendingDrafts", "committedOperations"], "readwrite", { durability: "strict" });
  h.tx.oncomplete(); expect(await saving).toEqual({ kind: "staged" }); expect(done).toBe(true);
});
it.each([ { maxDrafts: 1, maxPayloadCharacters: 100 }, { maxDrafts: 5, maxPayloadCharacters: 25 } ])("aborts at capacity without writing or evicting another editor's copy (%j)", async limits => {
  const h = harness(), other = { ...draft, editorId: "other-tab" }, saving = h.repo.stage(draft, limits), failure = expect(saving).rejects.toThrow("limit reached");
  await prepare(h); await h.reply("pendingDrafts", "getAll", [other]); await failure; expect(h.writes).toEqual([]); expect(h.tx.abort).toHaveBeenCalledOnce(); expect(other.payload).toBe(draft.payload);
});
it("allows a newer capture to replace only its own editor copy within capacity", async () => {
  const h = harness(), newer = { ...draft, sequence: 2, payload: "newer full payload" }, saving = h.repo.stage(newer, { maxDrafts: 1, maxPayloadCharacters: 30 });
  await prepare(h, draft); await h.reply("pendingDrafts", "getAll", [draft]); h.tx.oncomplete(); expect(await saving).toEqual({ kind: "staged" }); expect(h.writes).toEqual([newer]);
});
it("refuses a late older sequence without replacing a newer staged copy", async () => {
  const h = harness(), saving = h.repo.stage(draft, { maxDrafts: 1, maxPayloadCharacters: 30 }); await prepare(h, { ...draft, sequence: 2 }); h.tx.oncomplete();
  expect(await saving).toEqual({ kind: "superseded" }); expect(h.writes).toEqual([]);
});
it("discovers all workspaces read-only, preserving opaque payload bytes", async () => {
  const h = harness(), opaque = { ...draft, payload: "not decoded\ud800" }, reading = h.repo.pendingAll(); await h.reply("pendingDrafts", "getAll", [opaque]); h.tx.oncomplete();
  expect(await reading).toEqual([opaque]); expect(h.db.transaction).toHaveBeenCalledWith(["pendingDrafts"], "readonly"); expect(h.writes).toEqual([]);
});
it("rejects damaged inventory metadata instead of claiming it is empty", async () => {
  const h = harness(), reading = h.repo.pendingAll(), failure = expect(reading).rejects.toThrow("Invalid pending"); await h.reply("pendingDrafts", "getAll", [{ ...draft, sequence: -1 }]); await failure; expect(h.writes).toEqual([]);
});
it("rejects invalid retention limits without opening storage", async () => {
  const h = harness(); await expect(h.repo.stage(draft, { maxDrafts: 0, maxPayloadCharacters: 10 })).rejects.toThrow("Invalid recovery"); expect(h.db.transaction).not.toHaveBeenCalled();
});
