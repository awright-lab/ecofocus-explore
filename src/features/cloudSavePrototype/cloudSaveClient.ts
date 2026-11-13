import { CloudError, decodeSnapshot, digest, encodeSnapshot, objectKey, syntheticSnapshot } from "./contracts";
import type { CloudPort, Owner, Revision, SaveIntent, SyntheticSnapshot } from "./contracts";

export type SaveState = "local-only" | "saving" | "cloud-copy-saved" | "local-changes" | "offline" | "sign-in-required" | "interrupted" | "conflict" | "error";
export interface RestoredCopy { id: string; sourceRevision: string; owner: Owner; snapshot: SyntheticSnapshot; }
/** In-memory device/journal fixture, survives client recreation only, NOT reload. */
export class MemoryDevice {
  snapshot = syntheticSnapshot();
  pending = new Map<string, SaveIntent>();
  heads = new Map<string, string>();
  restoredCopies: RestoredCopy[] = [];
}
export class CloudSaveClient {
  session: string | null = null;
  state: SaveState = "local-only";
  message = "Local synthetic copy only. Nothing has been sent to a real cloud.";
  private generation = 0;
  private flight: Promise<void> | null = null;
  private restoreFlight: Promise<RestoredCopy | null> | null = null;
  constructor(readonly cloud: CloudPort, readonly device = new MemoryDevice(), readonly workspaceId = "synthetic-workspace",
    private id: () => string = () => crypto.randomUUID()) {}

  setSession(session: string | null) {
    this.session = session; this.generation++;
    this.state = "local-only";
    this.message = "Account changed. Local synthetic work is unchanged; cloud status must be checked for this account.";
  }
  edit() {
    this.device.snapshot = syntheticSnapshot((this.device.snapshot.edit + 1) % 1001);
    this.state = "local-changes";
    this.message = "New local synthetic edit. It has not been acknowledged by the cloud simulator.";
  }
  private scope(owner: Owner) { return `${owner}/${this.workspaceId}`; }
  private failure(error: unknown) {
    const code = error instanceof CloudError ? error.code : "invalid";
    this.state = code === "auth" ? "sign-in-required" : ["offline", "interrupted", "conflict"].includes(code) ? code as SaveState : "error";
    this.message = error instanceof CloudError ? error.message : "The operation could not complete. Your local copy is unchanged.";
  }
  save(): Promise<void> {
    if (this.flight) return this.flight; // Repeated clicks use one frozen intent.
    this.flight = this.performSave().finally(() => { this.flight = null; });
    return this.flight;
  }
  private async performSave() {
    const generation = this.generation, session = this.session;
    try {
      const owner = this.cloud.owner(session), scope = this.scope(owner);
      this.state = "saving"; this.message = "Saving a synthetic cloud copy…";
      let intent = this.device.pending.get(scope);
      if (!intent) {
        const body = encodeSnapshot(this.device.snapshot);
        intent = { owner, workspaceId: this.workspaceId, operationId: this.id(), expectedHead: this.device.heads.get(scope) ?? null,
          body, digest: await digest(body) };
        // A switch during hashing must not start an upload for the old account.
        if (generation !== this.generation) return;
        this.device.pending.set(scope, Object.freeze(intent));
      }
      await this.cloud.uploadImmutable(session, intent);
      if (generation !== this.generation) return; // Keep the old account's intent for reconciliation.
      const revision = await this.cloud.publishRevision(session, intent);
      // Keep pending when an acknowledgement belongs to a departed UI context.
      if (generation !== this.generation) return;
      this.cloud.owner(session); // Never report success under an expired session.
      if (revision.owner !== intent.owner || revision.workspaceId !== intent.workspaceId || revision.operationId !== intent.operationId ||
          revision.parentId !== intent.expectedHead || revision.objectKey !== objectKey(intent) || revision.digest !== intent.digest || !revision.revisionId) {
        throw new CloudError("integrity", "The acknowledgement does not match the pending copy. Keep it for reconciliation.");
      }
      this.device.heads.set(scope, revision.revisionId);
      this.device.pending.delete(scope);
      const unchanged = encodeSnapshot(this.device.snapshot) === intent.body;
      this.state = unchanged ? "cloud-copy-saved" : "local-changes";
      this.message = unchanged ? "Synthetic cloud copy acknowledged. Local work is unchanged." : "Earlier synthetic edit acknowledged. Newer local changes still need a cloud copy.";
    } catch (error) { if (generation === this.generation) this.failure(error); }
  }
  restoreSeparateCopy(): Promise<RestoredCopy | null> {
    if (this.restoreFlight) return this.restoreFlight;
    this.restoreFlight = this.performRestore().finally(() => { this.restoreFlight = null; });
    return this.restoreFlight;
  }
  private async performRestore(): Promise<RestoredCopy | null> {
    const generation = this.generation, session = this.session;
    try {
      const owner = this.cloud.owner(session);
      const head: Revision | null = await this.cloud.head(session, this.workspaceId);
      if (generation !== this.generation) return null;
      if (!head) throw new CloudError("missing", "No cloud copy exists for this account. Your local copy is unchanged.");
      const body = await this.cloud.download(session, head.objectKey);
      if (await digest(body) !== head.digest) throw new CloudError("integrity", "The cloud copy failed its checksum. Your local copy is unchanged.");
      const snapshot = decodeSnapshot(body);
      if (generation !== this.generation) return null;
      if (this.cloud.owner(session) !== owner || head.owner !== owner || head.workspaceId !== this.workspaceId) {
        throw new CloudError("forbidden", "The cloud copy does not belong to this account and workspace.");
      }
      const copy: RestoredCopy = { id: `restored-${this.id()}`, sourceRevision: head.revisionId, owner, snapshot };
      if (this.device.restoredCopies.some(existing => existing.id === copy.id)) throw new CloudError("invalid", "A new copy ID could not be allocated. Your copies are unchanged.");
      this.device.restoredCopies.push(copy);
      // Deliberately do not change the active snapshot, expected head or pending
      // intent. Restore is not permission to rebase or overwrite either version.
      this.message = "Restored a separate synthetic copy. The active local copy and cloud head are unchanged.";
      return copy;
    } catch (error) { if (generation === this.generation) this.failure(error); return null; }
  }
}
