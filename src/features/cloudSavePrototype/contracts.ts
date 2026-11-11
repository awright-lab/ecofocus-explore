/** Synthetic-only protocol lab. Not an adapter for production workspaces. */
export type Owner = "synthetic-alice" | "synthetic-bob";
export interface SyntheticSnapshot {
  kind: "ecofocus-synthetic-cloud-lab";
  version: 1;
  edit: number;
  title: string;
  rows: { respondent: string; score: number }[];
}
export function syntheticSnapshot(edit = 0): SyntheticSnapshot {
  if (!Number.isSafeInteger(edit) || edit < 0 || edit > 1000) throw new Error("Invalid synthetic edit.");
  return { kind: "ecofocus-synthetic-cloud-lab", version: 1, edit,
    title: `Synthetic survey ${edit}`,
    rows: Array.from({ length: 4 }, (_, i) => ({ respondent: `fixture-${i + 1}`, score: (i + edit) % 5 })) };
}
export function encodeSnapshot(value: SyntheticSnapshot): string {
  // Exact fixture allowlist, not a caller-supplied 'synthetic' marker. No arbitrary
  // survey rows, labels, extensions, credentials or production backup envelopes.
  const canonical = syntheticSnapshot(value?.edit);
  if (JSON.stringify(value) !== JSON.stringify(canonical)) throw new CloudError("invalid", "Only generated synthetic fixtures are accepted.");
  return JSON.stringify(canonical);
}
export function decodeSnapshot(body: string): SyntheticSnapshot {
  try {
    if (body.length > 4096) throw new Error("Too large");
    const value = JSON.parse(body) as SyntheticSnapshot;
    if (body !== encodeSnapshot(value)) throw new Error("Non-canonical synthetic body");
    return value;
  } catch { throw new CloudError("integrity", "The cloud copy failed validation. Your local copy is unchanged."); }
}
export async function digest(body: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new CloudError("invalid", "Secure hashing is unavailable.");
  const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
export type ErrorCode = "auth" | "forbidden" | "offline" | "interrupted" | "conflict" | "idempotency" | "integrity" | "invalid" | "missing";
export class CloudError extends Error {
  constructor(readonly code: ErrorCode, message: string) { super(message); this.name = "CloudError"; }
}
export interface SaveIntent {
  owner: Owner;
  workspaceId: string;
  operationId: string;
  expectedHead: string | null;
  body: string;
  digest: string;
}
export interface Revision {
  owner: Owner;
  workspaceId: string;
  revisionId: string;
  parentId: string | null;
  operationId: string;
  objectKey: string;
  digest: string;
}
export interface CloudPort {
  owner(session: string | null): Owner;
  uploadImmutable(session: string | null, intent: SaveIntent): Promise<void>;
  publishRevision(session: string | null, intent: SaveIntent): Promise<Revision>;
  head(session: string | null, workspaceId: string): Promise<Revision | null>;
  download(session: string | null, key: string): Promise<string>;
}
export function assertIdentifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new CloudError("invalid", "Invalid resource identifier.");
}
export function objectKey(intent: Pick<SaveIntent, "owner" | "workspaceId" | "operationId">): string {
  assertIdentifier(intent.owner); assertIdentifier(intent.workspaceId); assertIdentifier(intent.operationId);
  return `${intent.owner}/${intent.workspaceId}/${intent.operationId}.json`;
}
