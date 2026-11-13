import { assertIdentifier, CloudError, decodeSnapshot, digest, objectKey } from "./contracts";
import type { CloudPort, Owner, Revision, SaveIntent } from "./contracts";

export type Fault = "before-upload" | "after-upload" | "before-publish" | "after-publish" | "before-download" | "corrupt-download";
/** A deliberately fake server. Maps model server-side authority, NOT real RLS. */
export class FakeCloudServer {
  private sessions = new Map<string, { owner: Owner; expires: number }>();
  private objects = new Map<string, { owner: Owner; body: string; digest: string }>();
  private heads = new Map<string, Revision>();
  private receipts = new Map<string, { intent: SaveIntent; revision: Revision }>();
  private clock = 0;
  private serial = 0;

  signIn(owner: Owner): string {
    if (owner !== "synthetic-alice" && owner !== "synthetic-bob") throw new CloudError("auth", "Unknown synthetic identity.");
    const token = `fake-session-${++this.serial}`;
    this.sessions.set(token, { owner, expires: this.clock + 60_000 });
    return token;
  }
  revoke(token: string) { this.sessions.delete(token); }
  advanceTime(ms: number) { this.clock += ms; }
  authenticate(token: string | null): Owner {
    const session = token ? this.sessions.get(token) : undefined;
    if (!session || session.expires <= this.clock) throw new CloudError("auth", "Sign in again. Your local copy and pending operation are unchanged.");
    return session.owner;
  }
  private authorize(token: string | null, intent: SaveIntent): Owner {
    const owner = this.authenticate(token);
    if (intent.owner !== owner) throw new CloudError("forbidden", "This operation belongs to a different account.");
    objectKey(intent);
    if (intent.expectedHead !== null) assertIdentifier(intent.expectedHead);
    return owner;
  }
  async upload(token: string | null, intent: SaveIntent) {
    // Snapshot arguments before awaiting so a caller cannot alter a checked plan.
    const checked = { ...intent };
    this.authorize(token, checked);
    decodeSnapshot(checked.body);
    if (await digest(checked.body) !== checked.digest) throw new CloudError("integrity", "Upload checksum mismatch.");
    const owner = this.authorize(token, checked); // Session may expire during upload.
    const key = objectKey(checked), existing = this.objects.get(key);
    if (existing && (existing.body !== checked.body || existing.digest !== checked.digest)) {
      throw new CloudError("idempotency", "An immutable object cannot be replaced with different content.");
    }
    if (!existing) this.objects.set(key, { owner, body: checked.body, digest: checked.digest });
  }
  publish(token: string | null, intent: SaveIntent): Revision {
    this.authorize(token, intent);
    const key = objectKey(intent), receipt = this.receipts.get(key);
    if (receipt) {
      if (Object.keys(receipt.intent).some(key => receipt.intent[key as keyof SaveIntent] !== intent[key as keyof SaveIntent])) throw new CloudError("idempotency", "A request ID was reused for a different operation.");
      return { ...receipt.revision }; // Reconcile a lost acknowledgement, even if head has advanced.
    }
    const object = this.objects.get(key);
    if (!object || object.owner !== intent.owner || object.digest !== intent.digest || object.body !== intent.body) {
      throw new CloudError("integrity", "A complete, verified immutable upload is required before publication.");
    }
    const scope = `${intent.owner}/${intent.workspaceId}`;
    const current = this.heads.get(scope);
    if ((current?.revisionId ?? null) !== intent.expectedHead) {
      throw new CloudError("conflict", "Another editor saved first. Both versions are kept; restore a separate copy to compare.");
    }
    const revision: Revision = { owner: intent.owner, workspaceId: intent.workspaceId,
      revisionId: `revision-${++this.serial}`, parentId: intent.expectedHead,
      operationId: intent.operationId, objectKey: key, digest: intent.digest };
    // One synchronous critical section models ONE database transaction. Real
    // Supabase must use row locking/CAS + a unique receipt in a single RPC.
    // Never replace this with separate browser insert/update HTTP requests.
    this.receipts.set(key, { intent: { ...intent }, revision });
    this.heads.set(scope, revision);
    return { ...revision };
  }
  head(token: string | null, workspaceId: string): Revision | null {
    const owner = this.authenticate(token); assertIdentifier(workspaceId);
    const head = this.heads.get(`${owner}/${workspaceId}`);
    return head ? { ...head } : null;
  }
  download(token: string | null, key: string): string {
    const owner = this.authenticate(token);
    if (key.split("/")[0] !== owner) throw new CloudError("forbidden", "This private object belongs to a different account.");
    const object = this.objects.get(key);
    if (!object || object.owner !== owner) throw new CloudError("missing", "Private object not found.");
    return object.body;
  }
  /** Aggregate lab diagnostics expose no payloads, keys or identities. */
  diagnostics() { return { objects: this.objects.size, publishedRevisions: this.receipts.size, heads: this.heads.size }; }
}

/** One device's transport; faults are injected once at named request boundaries. */
export class FakeCloudConnection implements CloudPort {
  online = true;
  private nextFault: Fault | null = null;
  constructor(readonly server: FakeCloudServer) {}
  failNext(fault: Fault) { this.nextFault = fault; }
  armedFault() { return this.nextFault; }
  owner(session: string | null) { return this.server.authenticate(session); }
  private check() { if (!this.online) throw new CloudError("offline", "Offline. Your local copy and pending operation are unchanged."); }
  private fault(point: Fault) {
    if (this.nextFault !== point) return false;
    this.nextFault = null;
    if (point === "corrupt-download") return true;
    throw new CloudError("interrupted", "Connection interrupted. Retry the same operation to check whether it completed.");
  }
  async uploadImmutable(session: string | null, intent: SaveIntent) {
    this.check(); this.fault("before-upload");
    await this.server.upload(session, intent);
    this.fault("after-upload");
  }
  async publishRevision(session: string | null, intent: SaveIntent) {
    this.check(); this.fault("before-publish");
    const revision = this.server.publish(session, intent);
    this.fault("after-publish");
    return revision;
  }
  async head(session: string | null, workspaceId: string) {
    this.check(); return this.server.head(session, workspaceId);
  }
  async download(session: string | null, key: string) {
    this.check(); this.fault("before-download");
    const body = this.server.download(session, key);
    return this.fault("corrupt-download") ? body + "damaged" : body;
  }
}
