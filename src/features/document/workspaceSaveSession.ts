import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { loadDashboardWorkspace, readStoredWorkspaceCopy, writeDashboardWorkspaceVersion } from "./workspacePersistence";

export const workspaceSaveFailureMessage =
  "Your changes could not be saved to this browser. Keep this tab open, retry saving, or download a workspace backup.";

// A browser-session buffer, shared by the home and builder routes. Never use
// preview rows or destructive compaction as a fallback for a failed write.
// Version comparison rejects sequential stale saves; localStorage still cannot
// atomically compare-and-set across tabs. This is not a transaction/merge layer.
// Writers paired with readVersion must return the exact written version token.
export function createWorkspaceSaveSession(
  write: (workspace: DashboardWorkspace) => boolean | { version: string } = writeDashboardWorkspaceVersion,
  read = loadDashboardWorkspace,
  readVersion: (() => string | null) | undefined = write === writeDashboardWorkspaceVersion && read === loadDashboardWorkspace ? readStoredWorkspaceCopy : undefined
) {
  let pending: DashboardWorkspace | null = null;
  let expectedVersion: string | null | undefined;
  let failure: "storage" | "conflict" | null = null;
  const listeners = new Set<() => void>();
  function remember(workspace: DashboardWorkspace | null) {
    if (workspace === null) { expectedVersion = undefined; failure = null; }
    pending = workspace;
    listeners.forEach((listener) => listener());
  }
  function save(workspace: DashboardWorkspace, recoveryWorkspace = workspace) {
    let saved = false;
    failure = "storage";
    try {
      const current = readVersion?.();
      if (readVersion && expectedVersion !== undefined && current !== expectedVersion) {
        failure = "conflict";
      } else {
        if (readVersion && expectedVersion === undefined) expectedVersion = current;
        const result = write(workspace);
        saved = result !== false;
        // Only the exact bytes written are our baseline; rereading here could
        // accidentally adopt another tab's write and authorize a later overwrite.
        if (saved && readVersion && typeof result === "object") expectedVersion = result.version;
      }
    } catch { /* Treat blocked storage like a failed save. */ }
    if (saved) failure = null;
    pending = saved ? null : recoveryWorkspace;
    listeners.forEach((listener) => listener());
    return saved;
  }
  return {
    save,
    load: () => {
      if (pending) return pending;
      // Do not adopt a newer baseline on route remount: older mounted state may
      // still attempt an autosave. A new browser load starts a fresh session.
      const version = readVersion?.();
      const workspace = read();
      if (readVersion && expectedVersion === undefined) expectedVersion = version;
      return workspace;
    },
    getFailure: () => failure,
    getPending: () => pending,
    hasPending: () => pending !== null,
    remember,
    retry: () => pending ? save(pending) : true,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}

export const workspaceSaveSession = createWorkspaceSaveSession();
