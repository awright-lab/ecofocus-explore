import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { loadDashboardWorkspace, saveDashboardWorkspace } from "./workspacePersistence";

export const workspaceSaveFailureMessage =
  "Your changes could not be saved to this browser. Keep this tab open, retry saving, or download a workspace backup.";

// A browser-session buffer, shared by the home and builder routes. Never use
// preview rows or destructive compaction as a fallback for a failed write.
export function createWorkspaceSaveSession(
  write = saveDashboardWorkspace,
  read = loadDashboardWorkspace
) {
  let pending: DashboardWorkspace | null = null;
  const listeners = new Set<() => void>();
  function remember(workspace: DashboardWorkspace | null) {
    pending = workspace;
    listeners.forEach((listener) => listener());
  }
  function save(workspace: DashboardWorkspace, recoveryWorkspace = workspace) {
    let saved = false;
    try { saved = write(workspace); } catch { /* Treat blocked storage like a failed save. */ }
    remember(saved ? null : recoveryWorkspace);
    return saved;
  }
  return {
    save,
    load: () => pending ?? read(),
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
