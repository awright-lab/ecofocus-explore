import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import { decodeStoredWorkspaceSource, readStoredWorkspaceSource, type StoredWorkspaceSource } from "./workspacePersistence";
import { inspectDurableWorkspaceRecovery, type DurableRecoveryInspection } from "./durableWorkspaceRecovery";
import { inspectLegacyWorkspaceCopy, prepareLegacyWorkspaceCopy } from "./legacyWorkspaceMigration";
import type { createDurableWorkspaceRepository, PendingWorkspaceDraft } from "./durableWorkspaceRepository";

type Repository = Pick<ReturnType<typeof createDurableWorkspaceRepository>, "inspect" | "stage" | "commit">;
type StorageReader = Pick<Storage, "getItem">;
export type WorkspaceAuthoritySelection = { kind: "legacy" } | { kind: "durable"; workspaceId: string };
export type WorkspaceAuthorityInspection =
  | { kind: "legacy-only"; source: StoredWorkspaceSource | null; workspace: DashboardWorkspace | null }
  | { kind: "durable-ready"; workspaceId: string; revision: number; payload: string; workspace: DashboardWorkspace }
  | { kind: "recovery-required"; workspaceId: string; recovery: DurableRecoveryInspection }
  | { kind: "unavailable"; error: string };

// Deliberately not imported by App or the active save adapter. Selection must
// come from a future explicit authority workflow, never record existence or a
// failed legacy write. Inspection itself does not select, restore or write.
export async function inspectWorkspaceAuthority(
  selection: WorkspaceAuthoritySelection,
  dependencies: { storage: StorageReader; repository: Pick<Repository, "inspect"> }
): Promise<WorkspaceAuthorityInspection> {
  try {
    if (selection?.kind === "legacy") {
      const source = readStoredWorkspaceSource(dependencies.storage);
      return { kind: "legacy-only", source, workspace: source ? decodeStoredWorkspaceSource(source) : null };
    }
    if (selection?.kind !== "durable" || typeof selection.workspaceId !== "string" || !selection.workspaceId.trim()) {
      return { kind: "unavailable", error: "An explicit, valid workspace authority is required." };
    }
    const recovery = await inspectDurableWorkspaceRecovery(dependencies.repository, selection.workspaceId);
    if (recovery.kind === "needs_recovery") return { kind: "recovery-required", workspaceId: selection.workspaceId, recovery };
    if (recovery.kind !== "ready" || !recovery.saved?.workspace) {
      return { kind: "unavailable", error: "The selected durable workspace has no confirmed saved head. No legacy or default workspace was substituted." };
    }
    return { kind: "durable-ready", workspaceId: selection.workspaceId, revision: recovery.saved.record.revision,
      payload: recovery.saved.record.payload, workspace: recovery.saved.workspace };
  } catch (error) {
    return { kind: "unavailable", error: error instanceof Error ? error.message : "Workspace authority could not be inspected. Existing storage was not changed." };
  }
}

type SourceStatus = "unchanged" | "changed" | "unavailable";
export type LegacyWorkspaceCopyResult =
  | { kind: "saved-copy"; workspaceId: string; revision: number; sourceStatus: SourceStatus }
  | { kind: "source-changed"; staged: boolean }
  | { kind: "conflict" }
  | { kind: "blocked"; reason: "not-prepared" | "closed" }
  | { kind: "failed"; error: string };
export interface LegacyWorkspaceCopyState {
  mode: "unprepared" | "prepared" | "saving" | "saved" | "source-changed" | "conflict" | "failed" | "closed";
  staged: boolean;
  error: string | null;
  result: LegacyWorkspaceCopyResult | null;
}

// A create-only, separately acknowledged migration copy. It never switches the
// application authority or modifies legacy storage. Repeated attempts retain
// the exact captured source/operation, including after a lost acknowledgement.
export function createLegacyWorkspaceCopyCommitter(options: {
  workspaceId: string;
  editorId: string;
  storage: StorageReader;
  repository: Repository;
}) {
  if (!options.workspaceId?.trim() || !options.editorId?.trim()) throw new Error("A separate workspace ID and unique editor lifetime are required.");
  let state: LegacyWorkspaceCopyState = { mode: "unprepared", staged: false, error: null, result: null };
  let plan: ReturnType<typeof prepareLegacyWorkspaceCopy> = null;
  let source: StoredWorkspaceSource | undefined;
  let operation: PendingWorkspaceDraft | undefined;
  let destinationChecked = false;
  let running: Promise<LegacyWorkspaceCopyResult> | undefined;
  let saved: Extract<LegacyWorkspaceCopyResult, { kind: "saved-copy" }> | undefined;
  const listeners = new Set<() => void>();
  function update(patch: Partial<LegacyWorkspaceCopyState>) {
    if (state.mode === "closed") return;
    state = { ...state, ...patch }; listeners.forEach(listener => listener());
  }
  function sourceStatus(): SourceStatus {
    try {
      const current = readStoredWorkspaceSource(options.storage);
      return current?.key === source?.key && current?.raw === source?.raw ? "unchanged" : "changed";
    } catch { return "unavailable"; }
  }
  function finish(result: LegacyWorkspaceCopyResult): LegacyWorkspaceCopyResult {
    if (result.kind === "saved-copy") saved = result;
    update({ result, ...(result.kind === "saved-copy" ? { staged: false } : {}), mode: result.kind === "saved-copy" ? "saved" : result.kind === "blocked" ? state.mode : result.kind,
      error: result.kind === "failed" ? result.error : null });
    return result;
  }
  const closed = () => state.mode === "closed";
  async function perform(): Promise<LegacyWorkspaceCopyResult> {
    if (closed()) return { kind: "blocked", reason: "closed" };
    if (!operation) return { kind: "blocked", reason: "not-prepared" };
    update({ mode: "saving", error: null });
    if (closed()) return { kind: "blocked", reason: "closed" };
    try {
      if (!destinationChecked) {
        const status = sourceStatus();
        if (status === "unavailable") throw new Error("The legacy source cannot be checked. No migration copy was committed.");
        if (status === "changed") return finish({ kind: "source-changed", staged: false });
        const destination = await options.repository.inspect(operation.workspaceId);
        if (closed()) return { kind: "blocked", reason: "closed" };
        if (destination.head || destination.pending.length) return finish({ kind: "conflict" });
        const afterInspection = sourceStatus();
        if (afterInspection === "unavailable") throw new Error("The legacy source cannot be checked. No migration copy was committed.");
        if (afterInspection === "changed") return finish({ kind: "source-changed", staged: false });
        // After this point a failed response may hide a completed stage/commit.
        // Retry must reconcile the same identity instead of choosing a new one.
        destinationChecked = true;
      }
      const staged = await options.repository.stage(operation);
      if (staged.kind === "saved") return finish({ kind: "saved-copy", workspaceId: operation.workspaceId, revision: staged.revision, sourceStatus: sourceStatus() });
      if (staged.kind !== "staged") return finish({ kind: "conflict" });
      update({ staged: true });
      if (closed()) return { kind: "blocked", reason: "closed" };
      const status = sourceStatus();
      if (status === "unavailable") throw new Error("The legacy source cannot be checked. The staged copy was preserved but not committed.");
      if (status === "changed") return finish({ kind: "source-changed", staged: true });
      const result = await options.repository.commit(operation);
      if (result.kind !== "saved") return finish({ kind: "conflict" });
      return finish({ kind: "saved-copy", workspaceId: operation.workspaceId, revision: result.revision, sourceStatus: sourceStatus() });
    } catch (error) {
      return finish({ kind: "failed", error: error instanceof Error ? error.message : "The migration copy outcome could not be confirmed. Preserve the original source and retry the same copy." });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    prepare() {
      if (closed()) throw new Error("This migration-copy preparation is closed.");
      if (!plan) {
        // Capture once. A new source requires a new explicit preparation, not
        // silently replacing the payload of an uncertain operation.
        plan = prepareLegacyWorkspaceCopy(options.workspaceId, options.storage);
        if (!plan) return null;
        source = inspectLegacyWorkspaceCopy(plan.payload).source;
        operation = { workspaceId: options.workspaceId, editorId: options.editorId, sequence: 1, expectedRevision: null, payload: plan.payload };
        update({ mode: "prepared", error: null });
      }
      return { workspaceId: options.workspaceId, inventory: structuredClone(plan.inventory) };
    },
    getCapturedPayload: () => operation?.payload ?? null,
    saveCopy(): Promise<LegacyWorkspaceCopyResult> {
      if (closed()) return Promise.resolve({ kind: "blocked", reason: "closed" });
      if (saved) return Promise.resolve(saved);
      if (running) return running;
      const request = Promise.resolve().then(perform);
      running = request;
      const clear = () => { if (running === request) running = undefined; };
      void request.then(clear, clear);
      return request;
    },
    close() {
      if (closed()) return;
      state = { ...state, mode: "closed" }; listeners.forEach(listener => listener()); listeners.clear();
      // A transaction already committed cannot be undone by closing the view.
    },
  };
}
