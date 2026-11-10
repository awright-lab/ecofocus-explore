import { storageKey } from "../builder/builderConstants";
import { createWorkspaceBackup } from "./workspaceBackup";
import { decodeStoredWorkspaceSource, legacyWorkspaceStorageKey, readStoredWorkspaceSource, workspaceStorageKey, type StoredWorkspaceSource } from "./workspacePersistence";
import { isSavedObject } from "./workspaceStorageValidation";

// An isolated migration copy, not the active workspace adapter or a restore
// command. Persist the original source text, including unknown extensions and
// whitespace; reconstruct the validated view from it when reopening the copy.
interface LegacyWorkspaceCopy {
  kind: "ecofocus-legacy-workspace-copy";
  version: 1;
  workspaceId: string;
  source: StoredWorkspaceSource;
}

function inspectCopy(copy: LegacyWorkspaceCopy) {
  if (typeof copy.workspaceId !== "string" || !copy.workspaceId.trim()) throw new Error("A separate migration workspace ID is required.");
  const original = decodeStoredWorkspaceSource(copy.source);
  if (copy.workspaceId === original.id) throw new Error("Migration must use a separate workspace ID. The original save was not changed.");
  const workspace = { ...original, id: copy.workspaceId };
  return { workspace, inventory: createWorkspaceBackup(workspace).inventory };
}

export function prepareLegacyWorkspaceCopy(workspaceId: string, storage: Pick<Storage, "getItem"> = window.localStorage) {
  const source = readStoredWorkspaceSource(storage);
  if (!source) return null; // Do not fabricate a migration from a default report.
  const copy: LegacyWorkspaceCopy = { kind: "ecofocus-legacy-workspace-copy", version: 1, workspaceId, source };
  const inspected = inspectCopy(copy);
  return { ...inspected, payload: JSON.stringify(copy) };
}

export function inspectLegacyWorkspaceCopy(payload: string) {
  const value: unknown = JSON.parse(payload);
  if (!isSavedObject(value) || value.kind !== "ecofocus-legacy-workspace-copy" || value.version !== 1 || !isSavedObject(value.source) ||
      ![workspaceStorageKey, legacyWorkspaceStorageKey, storageKey].includes(value.source.key as string) || typeof value.source.raw !== "string") {
    throw new Error("The migration copy is incomplete or uses an unsupported format. Preserve the original save.");
  }
  const copy = value as unknown as LegacyWorkspaceCopy;
  return { ...inspectCopy(copy), source: { ...copy.source } };
}
