import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { loadDashboardWorkspace, readStoredWorkspaceCopy, writeDashboardWorkspaceVersion } from "./workspacePersistence";

export const workspaceSaveFailureMessage =
  "Your changes could not be saved to this browser. Keep this tab open, retry saving, or download a workspace backup.";

type SessionMemory = {
  version: 1;
  pending: DashboardWorkspace | null;
  expectedVersion: string | null | undefined;
  failure: "storage" | "conflict" | null;
  listeners: Set<() => void>;
};

export type WorkspaceSessionHotContext = {
  data: Record<string, unknown>;
  dispose: (callback: (data: Record<string, unknown>) => void) => void;
};

function newSessionMemory(): SessionMemory {
  return { version: 1, pending: null, expectedVersion: undefined, failure: null, listeners: new Set() };
}

// A browser-session buffer, shared by the home and builder routes. Never use
// preview rows or destructive compaction as a fallback for a failed write.
// Version comparison rejects sequential stale saves; localStorage still cannot
// atomically compare-and-set across tabs. This is not a transaction/merge layer.
// Writers paired with readVersion must return the exact written version token.
export function createWorkspaceSaveSession(
  write: (workspace: DashboardWorkspace) => boolean | { version: string } = writeDashboardWorkspaceVersion,
  read = loadDashboardWorkspace,
  readVersion: (() => string | null) | undefined = write === writeDashboardWorkspaceVersion && read === loadDashboardWorkspace ? readStoredWorkspaceCopy : undefined,
  memory: SessionMemory = newSessionMemory()
) {
  function remember(workspace: DashboardWorkspace | null) {
    if (workspace === null) { memory.expectedVersion = undefined; memory.failure = null; }
    memory.pending = workspace;
    memory.listeners.forEach((listener) => listener());
  }
  function save(workspace: DashboardWorkspace, recoveryWorkspace = workspace) {
    let saved = false;
    memory.failure = "storage";
    try {
      const current = readVersion?.();
      if (readVersion && memory.expectedVersion !== undefined && current !== memory.expectedVersion) {
        memory.failure = "conflict";
      } else {
        if (readVersion && memory.expectedVersion === undefined) memory.expectedVersion = current;
        const result = write(workspace);
        saved = result !== false;
        // Only the exact bytes written are our baseline; rereading here could
        // accidentally adopt another tab's write and authorize a later overwrite.
        if (saved && readVersion && typeof result === "object") memory.expectedVersion = result.version;
      }
    } catch { /* Treat blocked storage like a failed save. */ }
    if (saved) memory.failure = null;
    memory.pending = saved ? null : recoveryWorkspace;
    memory.listeners.forEach((listener) => listener());
    return saved;
  }
  return {
    save,
    // Awaitable acknowledgement boundary for consumers migrating to the
    // transactional adapter. Legacy writes still complete synchronously here.
    saveAsync: async (workspace: DashboardWorkspace, recoveryWorkspace = workspace) => save(workspace, recoveryWorkspace),
    load: () => {
      if (memory.pending) return memory.pending;
      // Do not adopt a newer baseline on route remount: older mounted state may
      // still attempt an autosave. A new browser load starts a fresh session.
      const version = readVersion?.();
      const workspace = read();
      if (readVersion && memory.expectedVersion === undefined) memory.expectedVersion = version;
      return workspace;
    },
    getFailure: () => memory.failure,
    getPending: () => memory.pending,
    hasPending: () => memory.pending !== null,
    remember,
    retry: () => memory.pending ? save(memory.pending) : true,
    subscribe(listener: () => void) {
      memory.listeners.add(listener);
      return () => { memory.listeners.delete(listener); };
    }
  };
}

// Fast Refresh can retain mounted report state while replacing this module.
// Retain the guard and pending copy as well: adopting a fresh baseline would
// authorize the older mounted report to overwrite another tab's newer save.
// Keep only memory, not old writer functions, so updated validation still runs.
export function createBrowserWorkspaceSaveSession(hot?: WorkspaceSessionHotContext | false) {
  const retained = hot ? hot.data.workspaceSessionMemory as SessionMemory | undefined : undefined;
  if (retained !== undefined && (!retained || retained.version !== 1 || !(retained.listeners instanceof Set))) {
    throw Error("The development save session could not be recovered. Preserve open edits before reloading; saving was not restarted.");
  }
  const memory = retained ?? newSessionMemory();
  if (hot) {
    // A dependency can be reevaluated through a React refresh boundary without
    // its own disposer running. Publish the shared memory before that happens.
    hot.data.workspaceSessionMemory = memory;
    hot.dispose(data => { data.workspaceSessionMemory = memory; });
  }
  return createWorkspaceSaveSession(undefined, undefined, undefined, memory);
}

const hot = (import.meta as ImportMeta & { hot?: WorkspaceSessionHotContext | false }).hot;
// Test/SSR loaders may expose a hot shim without persistent data.
export const workspaceSaveSession = createBrowserWorkspaceSaveSession(
  hot && hot.data && typeof hot.dispose === "function" ? hot : undefined
);
