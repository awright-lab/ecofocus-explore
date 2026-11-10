import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { encodeDurableWorkspace } from "./durableWorkspaceRecovery";
import { createDurableWorkspaceRepository, type PendingWorkspaceDraft } from "./durableWorkspaceRepository";

// Recovery-only namespace: never commits a head, migrates or changes localStorage.
export const failedWorkspaceRecoveryDatabase = "ecofocus-failed-workspace-recovery-v1";
type Repository = Pick<ReturnType<typeof createDurableWorkspaceRepository>, "stage" | "pendingAll">;
export type FailedRecoveryState = {
  source: DashboardWorkspace | null;
  status: "idle" | "saving" | "retained" | "failed";
};

export function createFailedWorkspaceRecoveryJournal(
  repository: () => Repository,
  editorIdentity: () => string = () => crypto.randomUUID()
) {
  let state: FailedRecoveryState = { source: null, status: "idle" };
  let sequence = 0, editorId: string | undefined;
  let latest: PendingWorkspaceDraft | null = null;
  let running = false;
  const listeners = new Set<() => void>();
  function update(next: FailedRecoveryState) { state = next; listeners.forEach(listener => listener()); }
  async function stage(draft: PendingWorkspaceDraft, source: DashboardWorkspace) {
    running = true;
    try {
      const result = await repository().stage(draft, { maxDrafts: 50, maxPayloadCharacters: 16 * 1024 * 1024 });
      if (latest === draft) update({ source, status: result.kind === "staged" ? "retained" : "failed" });
    } catch { if (latest === draft) update({ source, status: "failed" }); }
    finally {
      running = false;
      // At most one transaction/hash plus one latest captured payload is held.
      // Intermediate edits are coalesced, never queued as unbounded full copies.
      if (latest && latest !== draft && state.source) void stage(latest, state.source);
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    retain(source: DashboardWorkspace) {
      // Capture full bytes synchronously, before callers can mutate or leave.
      // A newer failed capture invalidates ownership of older completions too.
      latest = null;
      try {
        if (!Number.isSafeInteger(sequence + 1)) throw new Error("Recovery sequence exhausted.");
        const payload = JSON.stringify({ ...JSON.parse(encodeDurableWorkspace(source)), capturedAt: new Date().toISOString() });
        editorId ??= editorIdentity();
        const draft = { workspaceId: source.id, editorId, sequence: ++sequence, expectedRevision: null, payload };
        latest = draft; update({ source, status: "saving" });
        if (!running) void stage(draft, source);
      } catch { update({ source, status: "failed" }); }
    },
    retry() {
      if (!latest || !state.source || state.status === "saving") return;
      update({ source: state.source, status: "saving" });
      void stage(latest, state.source);
    },
    inspect: () => repository().pendingAll()
  };
}
let repository: ReturnType<typeof createDurableWorkspaceRepository> | undefined;
export const failedWorkspaceRecoveryJournal = createFailedWorkspaceRecoveryJournal(
  () => repository ??= createDurableWorkspaceRepository(failedWorkspaceRecoveryDatabase)
);
