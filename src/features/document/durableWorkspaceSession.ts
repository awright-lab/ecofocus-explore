import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { encodeDurableWorkspace, inspectDurableWorkspaceRecovery, type DurableRecoveryInspection } from "./durableWorkspaceRecovery";
import type { createDurableWorkspaceRepository, DurableCommitResult, PendingWorkspaceDraft } from "./durableWorkspaceRepository";

type Repository = Pick<ReturnType<typeof createDurableWorkspaceRepository>, "inspect" | "stage" | "commit">;
type Mode = "unopened" | "loading" | "ready" | "recovery" | "conflict" | "failed" | "closed";
type SaveResult = DurableCommitResult | { kind: "blocked"; reason: Mode } | { kind: "unchanged" };
export interface DurableSessionState {
  mode: Mode;
  saving: boolean;
  pendingPayload: string | null;
  pendingDurable: boolean;
  error: string | null;
  recovery: DurableRecoveryInspection | null;
}

// Async lifecycle foundation, deliberately separate from the synchronous active
// adapter. Consumers must await the specific operation's result before claiming
// a save or navigating. A queued edit is not a durable acknowledgement.
export function createDurableWorkspaceSession(repository: Repository, workspaceId: string, editorId: string) {
  if (!workspaceId.trim() || !editorId.trim()) throw new Error("A workspace and unique editor lifetime are required.");
  let state: DurableSessionState = { mode: "unopened", saving: false, pendingPayload: null, pendingDurable: false, error: null, recovery: null };
  let revision: number | null = null, sequence = 0;
  let latest: { sequence: number; payload: string } | null = null;
  let uncertain: PendingWorkspaceDraft | null = null;
  let accepted: { sequence: number; payload: string; revision: number } | null = null;
  let opening: Promise<DurableRecoveryInspection> | null = null;
  let tail: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  function update(patch: Partial<DurableSessionState>) {
    if (state.mode === "closed") return;
    state = { ...state, ...patch }; listeners.forEach(listener => listener());
  }
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = tail.then(work); tail = result.then(() => undefined, () => undefined); return result;
  }
  const isClosed = () => state.mode === "closed";
  const blocked = (): SaveResult => ({ kind: "blocked", reason: state.mode });
  async function perform(operation: PendingWorkspaceDraft): Promise<SaveResult> {
    if (isClosed()) return blocked();
    update({ saving: true, error: null }); uncertain = operation;
    try {
      const staged = await repository.stage(operation);
      if (latest?.sequence === operation.sequence && staged.kind !== "superseded") update({ pendingDurable: true });
      if (isClosed()) return blocked();
      const result = staged.kind === "staged" ? await repository.commit(operation) : staged;
      if (result.kind === "saved") {
        revision = result.revision; uncertain = null; accepted = { sequence: operation.sequence, payload: operation.payload, revision: result.revision };
        if (latest?.sequence === operation.sequence) latest = null;
        update({ mode: "ready", pendingPayload: latest?.payload ?? null, ...(!latest ? { pendingDurable: false } : {}) });
      } else {
        update({ mode: "conflict", error: "Saved work changed or this operation was superseded. Preserve the pending copy before resolving it." });
      }
      return result;
    } catch (error) {
      update({ mode: "failed", error: error instanceof Error ? error.message : "The save outcome could not be confirmed." });
      throw error;
    } finally { update({ saving: false }); }
  }
  async function performLatest(task: { sequence: number; payload: string }): Promise<SaveResult> {
    if (state.mode !== "ready") return blocked();
    if (accepted && task.sequence <= accepted.sequence) return task.sequence === accepted.sequence && task.payload === accepted.payload ? { kind: "saved", revision: accepted.revision } : { kind: "superseded" };
    return perform({ workspaceId, editorId, sequence: task.sequence, expectedRevision: revision, payload: task.payload });
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    open(): Promise<DurableRecoveryInspection> {
      if (state.mode === "closed") return Promise.reject(new Error("This workspace session is closed."));
      if (opening) return opening;
      update({ mode: "loading", error: null });
      const request = inspectDurableWorkspaceRecovery(repository, workspaceId).then(recovery => {
        if (state.mode !== "closed") {
          revision = recovery.saved?.record.revision ?? null;
          update({ recovery, mode: recovery.kind === "needs_recovery" ? "recovery" : "ready" });
        }
        return recovery;
      }).catch(error => {
        if (opening === request) opening = null;
        update({ mode: "failed", error: error instanceof Error ? error.message : "Workspace recovery could not be inspected." });
        throw error;
      });
      opening = request; return request;
    },
    save(workspace: DashboardWorkspace): Promise<SaveResult> {
      if (state.mode === "closed") return Promise.resolve(blocked());
      let payload: string;
      try {
        if (workspace.id !== workspaceId) throw new Error("This edit belongs to another workspace.");
        payload = encodeDurableWorkspace(workspace);
        if (!Number.isSafeInteger(sequence + 1)) throw new Error("The editor sequence limit was reached. Preserve a backup.");
      } catch (error) { return Promise.reject(error); }
      const task = { sequence: ++sequence, payload }; latest = task;
      update({ pendingPayload: payload, pendingDurable: false }); return enqueue(() => performLatest(task));
    },
    retry(): Promise<SaveResult> {
      return enqueue(async () => {
        if (state.mode === "closed" || state.mode === "conflict" || state.mode === "recovery" || state.mode === "loading" || state.mode === "unopened") return blocked();
        if (state.mode === "failed" && !uncertain) return blocked();
        let result: SaveResult = { kind: "unchanged" };
        if (uncertain) {
          result = await perform(uncertain);
          if (result.kind !== "saved") return result;
        }
        return latest ? performLatest(latest) : result;
      });
    },
    close() {
      if (state.mode === "closed") return;
      state = { ...state, mode: "closed", saving: false }; listeners.forEach(listener => listener()); listeners.clear();
      // Do not close a repository supplied by the caller: other sessions may
      // share it. Already-running transactions must settle and be reconciled.
    },
  };
}
