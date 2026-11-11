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
  pendingRecoveryPayload: string | null;
  pendingDurable: boolean;
  error: string | null;
  recovery: DurableRecoveryInspection | null;
}

// Async lifecycle foundation, deliberately separate from the synchronous active
// adapter. Consumers must await the specific operation's result before claiming
// a save or navigating. A queued edit is not a durable acknowledgement.
export function createDurableWorkspaceSession(repository: Repository, workspaceId: string, editorId: string) {
  if (!workspaceId.trim() || !editorId.trim()) throw new Error("A workspace and unique editor lifetime are required.");
  let state: DurableSessionState = { mode: "unopened", saving: false, pendingPayload: null, pendingRecoveryPayload: null, pendingDurable: false, error: null, recovery: null };
  let revision: number | null = null, sequence = 0;
  type Capture = { sequence: number; payload: string; recoveryPayload?: string; resolve?: (result: SaveResult) => void; reject?: (error: unknown) => void };
  let latest: Capture | null = null;
  let pending: Capture | null = null;
  let uncertain: PendingWorkspaceDraft | null = null;
  let opening: Promise<DurableRecoveryInspection> | null = null;
  let running: Promise<SaveResult> | null = null;
  const listeners = new Set<() => void>();
  function update(patch: Partial<DurableSessionState>) {
    if (state.mode === "closed") return;
    state = { ...state, ...patch }; listeners.forEach(listener => listener());
  }
  const isClosed = () => state.mode === "closed";
  const blocked = (): SaveResult => ({ kind: "blocked", reason: state.mode });
  async function perform(operation: PendingWorkspaceDraft): Promise<SaveResult> {
    if (isClosed()) return blocked();
    update({ saving: true, error: null });
    if (isClosed()) return blocked();
    uncertain = operation;
    try {
      const staged = await repository.stage(operation);
      if (latest?.sequence === operation.sequence && staged.kind !== "superseded") update({ pendingDurable: true });
      if (isClosed()) return blocked();
      const result = staged.kind === "staged" ? await repository.commit(operation) : staged;
      if (result.kind === "saved") {
        revision = result.revision; uncertain = null;
        if (latest?.sequence === operation.sequence) latest = null;
        update({ mode: "ready", pendingPayload: latest?.payload ?? null, pendingRecoveryPayload: latest ? latest.recoveryPayload ?? latest.payload : null, ...(!latest ? { pendingDurable: false } : {}) });
      } else {
        update({ mode: "conflict", error: "Saved work changed or this operation was superseded. Preserve the pending copy before resolving it." });
      }
      return result;
    } catch (error) {
      update({ mode: "failed", error: error instanceof Error ? error.message : "The save outcome could not be confirmed." });
      throw error;
    } finally { update({ saving: false }); }
  }
  // Only one captured operation is active and one pending capture is retained.
  // A displaced pending promise is settled immediately, never acknowledged saved.
  function settle(task: Capture, result: SaveResult) { task.resolve?.(result); task.resolve = undefined; task.reject = undefined; }
  function start(reconcile = false): Promise<SaveResult> {
    if (running) return running;
    const work = async (): Promise<SaveResult> => {
      let result: SaveResult = { kind: "unchanged" };
      try {
        if (reconcile && uncertain) {
          result = await perform(uncertain);
          if (result.kind !== "saved") return result;
        }
        while (pending && state.mode === "ready") {
          const task = pending; pending = null;
          try {
            result = await perform({ workspaceId, editorId, sequence: task.sequence, expectedRevision: revision, payload: task.payload,
              ...(task.recoveryPayload === undefined ? {} : { recoveryPayload: task.recoveryPayload }) });
            settle(task, result);
          } catch (error) { task.reject?.(error); task.resolve = undefined; task.reject = undefined; throw error; }
          if (result.kind !== "saved") break;
        }
        return result;
      } finally {
        if (pending && state.mode !== "ready") settle(pending, blocked());
      }
    };
    // Start synchronously so a second save cannot replace an already active edit.
    let resolve!: (result: SaveResult) => void, reject!: (error: unknown) => void;
    const request = new Promise<SaveResult>((yes, no) => { resolve = yes; reject = no; });
    running = request;
    const finished = () => {
      if (running !== request) return;
      running = null;
      if (pending) {
        if (state.mode === "ready") void start().catch(() => undefined);
        else settle(pending, blocked());
      }
    };
    void request.then(finished, finished);
    void work().then(resolve, reject);
    return request;
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
    save(workspace: DashboardWorkspace, recoveryWorkspace: DashboardWorkspace = workspace): Promise<SaveResult> {
      if (state.mode === "closed") return Promise.resolve(blocked());
      let payload: string, recoveryPayload: string;
      try {
        if (workspace.id !== workspaceId || recoveryWorkspace.id !== workspaceId) throw new Error("This edit belongs to another workspace.");
        payload = encodeDurableWorkspace(workspace);
        recoveryPayload = recoveryWorkspace === workspace ? payload : encodeDurableWorkspace(recoveryWorkspace);
        if (!Number.isSafeInteger(sequence + 1)) throw new Error("The editor sequence limit was reached. Preserve a backup.");
      } catch (error) { return Promise.reject(error); }
      if (pending) settle(pending, { kind: "superseded" });
      const task: Capture = { sequence: ++sequence, payload, ...(recoveryPayload === payload ? {} : { recoveryPayload }) };
      const result = new Promise<SaveResult>((resolve, reject) => { task.resolve = resolve; task.reject = reject; });
      latest = pending = task;
      update({ pendingPayload: payload, pendingRecoveryPayload: recoveryPayload, pendingDurable: false });
      if (!running && state.mode === "ready") void start().catch(() => undefined);
      else if (!running) settle(task, blocked());
      return result;
    },
    retry(): Promise<SaveResult> {
      if (state.mode === "closed" || state.mode === "conflict" || state.mode === "recovery" || state.mode === "loading" || state.mode === "unopened") return Promise.resolve(blocked());
      if (running) return running;
      if (state.mode === "failed" && !uncertain) return Promise.resolve(blocked());
      return start(true);
    },
    close() {
      if (state.mode === "closed") return;
      state = { ...state, mode: "closed", saving: false };
      if (pending) { settle(pending, blocked()); pending = null; } listeners.forEach(listener => listener()); listeners.clear();
      // Do not close a repository supplied by the caller: other sessions may
      // share it. Already-running transactions must settle and be reconciled.
    },
  };
}
