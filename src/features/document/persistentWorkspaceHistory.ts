import { createDeferredWorkspaceHistory, type DeferredHistoryEntry, type HistoryDurability, type HistoryStorageState, type WorkspaceHistoryStore } from "./deferredWorkspaceHistory";
import type { createDurableHistoryRepository, DurableHistoryCandidate } from "./durableHistoryRepository";

type Repository = Pick<ReturnType<typeof createDurableHistoryRepository>, "inspect" | "stage" | "reconcile" | "close"> & Partial<Pick<ReturnType<typeof createDurableHistoryRepository>, "exportRecoveryArchive" | "inspectRetained">>;
const storageFailure = "Recovery storage could not be confirmed. Keep this tab open and download a recovery copy.";

// Explicit opt-in coordinator. The product singleton remains memory-only until
// activation review. This journal never writes or migrates active workspaces.
// Pass a factory when browser storage access itself can throw. Construction then
// happens inside initialize(), after the in-memory recovery store already exists.
export function createPersistentWorkspaceHistory(source: Repository | (() => Repository), makeId: () => string = () => crypto.randomUUID()): WorkspaceHistoryStore {
  let repository = typeof source === "function" ? undefined : source;
  const memory = createDeferredWorkspaceHistory(), listeners = new Set<() => void>();
  const records = new Map<number, DurableHistoryCandidate[]>(), durability = new Map<number, HistoryDurability>(), resolved = new Set<string>();
  let state: HistoryStorageState = Object.freeze({ phase: "unopened", unreadableRecords: 0, error: null, epoch: 0 });
  let opening: Promise<void> | undefined, tail = Promise.resolve(), closed = false;
  function update(patch: Partial<HistoryStorageState>) {
    if (closed && patch.phase !== "closed") return;
    state = Object.freeze({ ...state, ...patch, epoch: state.epoch + 1 }); listeners.forEach(listener => listener());
  }
  function mark(id: number, value: HistoryDurability) { durability.set(id, value); update({}); }
  function ready() {
    const failed = memory.getPending().some(entry => durability.get(entry.id) === "failed");
    update({ phase: failed ? "failed" : "ready", error: failed ? storageFailure : null });
  }
  function enqueue<T>(work: () => Promise<T>): Promise<T> { const result = tail.then(work); tail = result.then(() => undefined, () => undefined); return result; }
  function identity(record: DurableHistoryCandidate) { return JSON.stringify([record.id, record.workspaceId, record.snapshotId, record.capturedAt, record.payload]); }
  function checkOpen() { if (closed) throw new Error("This history coordinator is closed."); }
  function getRepository() {
    checkOpen();
    if (!repository) repository = (source as () => Repository)();
    return repository;
  }
  function attach(id: number, record: DurableHistoryCandidate) {
    const current = records.get(id) ?? [];
    if (!current.some(item => item.id === record.id && item.workspaceId === record.workspaceId && item.snapshotId === record.snapshotId && item.capturedAt === record.capturedAt && item.payload === record.payload)) records.set(id, [...current, Object.freeze({ ...record })]);
  }
  function initialize(): Promise<void> {
    if (closed) return Promise.reject(new Error("This history coordinator is closed."));
    if (!opening) {
      update({ phase: "opening", error: null });
      const attempt = (async () => {
        const scan = await getRepository().inspect(); checkOpen();
        for (const record of scan.candidates) {
          const id = memory.remember({ workspaceId: record.workspaceId, snapshotId: record.snapshotId, payload: record.payload });
          attach(id, record); mark(id, "stored");
        }
        update({ unreadableRecords: scan.unreadableRecords }); ready();
      })();
      opening = attempt;
      void attempt.catch(() => { if (opening === attempt) opening = undefined; update({ phase: "failed", error: storageFailure }); });
    }
    return opening;
  }
  function recordFor(entry: DeferredHistoryEntry) {
    let current = records.get(entry.id);
    if (!current?.length) {
      const id = makeId(); if (typeof id !== "string" || !id.trim()) throw new Error("A unique recovery record ID is required.");
      current = [Object.freeze({ version: 1, id, workspaceId: entry.workspaceId, snapshotId: entry.snapshotId, payload: entry.payload, capturedAt: new Date().toISOString() })]; records.set(entry.id, current);
    }
    return current;
  }
  async function removeMemory(id: number) { await memory.acknowledge(id); for (const record of records.get(id) ?? []) resolved.delete(identity(record)); records.delete(id); durability.delete(id); ready(); }
  async function persist(id: number) {
    checkOpen(); await initialize(); checkOpen();
    const entry = memory.getPending().find(item => item.id === id); if (!entry) return;
    mark(id, "writing");
    try {
      const current = recordFor(entry);
      for (const record of current) {
        const result = await getRepository().stage(record); checkOpen();
        if (result.kind === "reconciled" && result.payloadRetained !== true) throw new Error("This receipt does not confirm a retained recovery payload. Keep the memory copy and download it for review.");
        if (result.kind === "reconciled") resolved.add(identity(record));
      }
      if (current.every(record => resolved.has(identity(record)))) await removeMemory(id);
      else { mark(id, "stored"); ready(); }
    } catch (error) { mark(id, "failed"); update({ phase: "failed", error: storageFailure }); throw error; }
  }
  return {
    ...(typeof source === "function" || repository?.inspectRetained ? { inspectRetained: async () => {
      const current = getRepository();
      if (!current.inspectRetained) throw new Error("Retained history inspection is unavailable.");
      const scan = await current.inspectRetained(); checkOpen();
      return Object.freeze({ ...scan, candidates: Object.freeze(scan.candidates.map(candidate => Object.freeze({ ...candidate }))) });
    } } : {}),
    ...(typeof source === "function" || repository?.exportRecoveryArchive ? { exportRecoveryArchive: async () => {
      const current = getRepository();
      if (!current.exportRecoveryArchive) throw new Error("Recovery storage export is unavailable. The original records have not been changed.");
      return current.exportRecoveryArchive();
    } } : {}),
    getPending: memory.getPending,
    getStorageState: () => state,
    getDurability: id => durability.get(id) ?? "memory",
    subscribe(listener) { listeners.add(listener); const stop = memory.subscribe(listener); return () => { listeners.delete(listener); stop(); }; },
    remember(source) {
      checkOpen(); const id = memory.remember(source);
      if (durability.get(id) !== "stored" && durability.get(id) !== "writing") void enqueue(() => persist(id)).catch(() => { mark(id, "failed"); update({ phase: "failed", error: storageFailure }); });
      return id;
    },
    initialize,
    retryStorage: () => enqueue(async () => { checkOpen(); opening = undefined; await initialize(); for (const entry of [...memory.getPending()]) await persist(entry.id); }),
    acknowledge: id => enqueue(async () => {
      checkOpen(); await initialize(); checkOpen();
      const entry = memory.getPending().find(item => item.id === id); if (!entry) return;
      try {
        for (const record of recordFor(entry)) {
          if (!resolved.has(identity(record))) {
            const result = await getRepository().reconcile(record); checkOpen();
            if (result.kind !== "reconciled") throw new Error("History reconciliation was not acknowledged.");
            if (result.payloadRetained !== true) throw new Error("This receipt does not confirm a retained recovery payload. Keep the memory copy and download it for review.");
            resolved.add(identity(record));
          }
        }
        await removeMemory(id);
      } catch (error) { mark(id, "failed"); update({ phase: "failed", error: storageFailure }); throw error; }
    }),
    clear() { throw new Error("Persistent recovery copies cannot be discarded without reconciliation."); },
    async close() { closed = true; update({ phase: "closed" }); await repository?.close(); },
  };
}
