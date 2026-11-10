export type HistoryDurability = "memory" | "writing" | "stored" | "failed";
export interface HistoryStorageState { phase: "memory" | "unopened" | "opening" | "ready" | "failed" | "closed"; unreadableRecords: number; error: string | null; epoch: number; }
export type DeferredHistoryEntry = Readonly<{ id: number; workspaceId: string; snapshotId: string; payload: string }>;
export function createDeferredWorkspaceHistory() {
  let pending: readonly DeferredHistoryEntry[] = Object.freeze([]), sequence = 0;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  const storage: HistoryStorageState = Object.freeze({ phase: "memory", unreadableRecords: 0, error: null, epoch: 0 });
  return {
    getPending: () => pending,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    remember(source: Omit<DeferredHistoryEntry, "id">) {
      const existing = pending.find(entry => entry.workspaceId === source.workspaceId && entry.snapshotId === source.snapshotId && entry.payload === source.payload);
      if (existing) return existing.id;
      const id = ++sequence;
      pending = Object.freeze([...pending, Object.freeze({ ...source, id })]); notify();
      return id;
    },
    acknowledge(id: number) { pending = Object.freeze(pending.filter(entry => entry.id !== id)); notify(); return Promise.resolve(); },
    clear() { pending = Object.freeze([]); notify(); },
    initialize: async () => {},
    retryStorage: async () => {},
    getStorageState: () => storage,
    getDurability: (_id: number): HistoryDurability => "memory",
    close: async () => {},
  };
}
// Tab-lifetime recovery only. A late acknowledgement outlives its editor route.
// Conflicting candidates remain separate; no candidate is restored automatically.
export const deferredWorkspaceHistory = createDeferredWorkspaceHistory();

export interface RetainedHistoryInspection {
  candidates: readonly Readonly<import("./durableHistoryRepository").DurableHistoryCandidate>[];
  legacyReceipts: number;
  unreadableRecords: number;
}
export type WorkspaceHistoryStore = ReturnType<typeof createDeferredWorkspaceHistory> & {
  exportRecoveryArchive?: () => Promise<string>;
  inspectRetained?: () => Promise<RetainedHistoryInspection>;
};
