import type { DashboardWorkspace } from "../../../shared/types/dashboard";
import type { DurableWorkspaceHead, PendingWorkspaceDraft } from "./durableWorkspaceRepository";
import { inspectLegacyWorkspaceCopy } from "./legacyWorkspaceMigration";
import { decodeStoredWorkspaceSource, workspaceStorageKey } from "./workspacePersistence";
import { isSavedObject } from "./workspaceStorageValidation";

export function encodeDurableWorkspace(workspace: DashboardWorkspace): string {
  const payload = JSON.stringify(workspace);
  const validated = decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: payload });
  if (!validated.id.trim()) throw new Error("A workspace ID is required before saving.");
  return JSON.stringify({ kind: "ecofocus-workspace-state", version: 1, workspaceId: validated.id, payload });
}

export function decodeDurableWorkspace(payload: string, workspaceId: string): DashboardWorkspace {
  const envelope: unknown = JSON.parse(payload);
  let workspace: DashboardWorkspace;
  if (isSavedObject(envelope) && envelope.kind === "ecofocus-legacy-workspace-copy") {
    workspace = inspectLegacyWorkspaceCopy(payload).workspace;
  } else {
    if (!isSavedObject(envelope) || envelope.kind !== "ecofocus-workspace-state" || envelope.version !== 1 ||
        envelope.workspaceId !== workspaceId || typeof envelope.payload !== "string") throw new Error("The saved workspace format is incomplete or unsupported.");
    workspace = decodeStoredWorkspaceSource({ key: workspaceStorageKey, raw: envelope.payload });
  }
  if (workspace.id !== workspaceId) throw new Error("The saved workspace belongs to a different workspace ID. Preserve the original copy.");
  return workspace;
}

type Snapshot = { head: DurableWorkspaceHead | null; pending: PendingWorkspaceDraft[] };
type Inspection = { workspace: DashboardWorkspace; error: null } | { workspace: null; error: string };
export type DurableRecoveryInspection = {
  kind: "empty" | "ready" | "needs_recovery";
  saved: ({ record: DurableWorkspaceHead } & Inspection) | null;
  candidates: Array<{ draft: PendingWorkspaceDraft; base: "current" | "changed" } & Inspection>;
};

// Read-only startup preparation. Never selects, merges, clears, re-stages or
// commits a recovery candidate. A valid saved head cannot hide pending edits.
export async function inspectDurableWorkspaceRecovery(repository: { inspect(workspaceId: string): Promise<Snapshot> }, workspaceId: string): Promise<DurableRecoveryInspection> {
  if (typeof workspaceId !== "string" || !workspaceId.trim()) throw new Error("A workspace ID is required for recovery.");
  const snapshot = await repository.inspect(workspaceId);
  const decode = (payload: string): Inspection => {
    try { return { workspace: decodeDurableWorkspace(payload, workspaceId), error: null }; }
    catch (error) { return { workspace: null, error: error instanceof Error ? error.message : "The saved workspace could not be read safely." }; }
  };
  const saved = snapshot.head ? { record: snapshot.head, ...decode(snapshot.head.payload) } : null;
  const candidates = snapshot.pending.map(draft => ({ draft, base: (snapshot.head?.revision ?? null) === draft.expectedRevision ? "current" as const : "changed" as const, ...decode(draft.payload) }));
  return { kind: !saved && !candidates.length ? "empty" : saved?.workspace && !candidates.length ? "ready" : "needs_recovery", saved, candidates };
}
