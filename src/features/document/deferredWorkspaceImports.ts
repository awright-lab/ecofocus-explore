import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";

let pending: ImportedDatasetRecord[] = [];
const listeners = new Set<() => void>();
export const deferredWorkspaceImports = {
  getPending: () => pending,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  remember(dataset: ImportedDatasetRecord) {
    pending = [...pending.filter((item) => item.id !== dataset.id), dataset];
    listeners.forEach((listener) => listener());
  },
  clear() { pending = []; listeners.forEach((listener) => listener()); }
};
