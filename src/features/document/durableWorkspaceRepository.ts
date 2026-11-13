// Isolated persistence foundation. The active application still uses its
// existing save adapter until migration and recovery UI have been verified.
export interface PendingWorkspaceDraft {
  workspaceId: string;
  editorId: string;
  sequence: number;
  expectedRevision: number | null;
  payload: string;
  recoveryPayload?: string;
}
export interface DurableWorkspaceHead {
  workspaceId: string;
  revision: number;
  payload: string;
}
export type DurableCommitResult = { kind: "saved"; revision: number } | { kind: "conflict"; revision: number | null } | { kind: "superseded" };

type DurableReceiptResult = Exclude<DurableCommitResult, { kind: "conflict" }>;

const headsStore = "workspaceHeads", pendingStore = "pendingDrafts", receiptsStore = "committedOperations";
interface CommitReceipt {
  workspaceId: string; editorId: string; sequence: number;
  expectedRevision: number | null; revision: number; payloadDigest: string;
}

// JSON escapes unpaired UTF-16 surrogates before UTF-8 encoding, preserving
// distinct opaque strings that TextEncoder alone would replace with U+FFFD.
export async function workspaceDraftDigest(draft: PendingWorkspaceDraft): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure hashing is unavailable. Keep the pending draft and original save.");
  const bytes = new TextEncoder().encode(JSON.stringify(draft.recoveryPayload === undefined ? [draft.expectedRevision, draft.payload] : [draft.expectedRevision, draft.payload, draft.recoveryPayload]));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}
function assertReceipt(value: unknown, draft: PendingWorkspaceDraft): asserts value is CommitReceipt | undefined {
  if (value === undefined) return;
  const receipt = value as Partial<CommitReceipt>;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || receipt.workspaceId !== draft.workspaceId || receipt.editorId !== draft.editorId ||
      !validRevision(receipt.sequence) || !validRevision(receipt.revision) || (receipt.expectedRevision !== null && !validRevision(receipt.expectedRevision)) ||
      (receipt.expectedRevision ?? 0) + 1 !== receipt.revision || typeof receipt.payloadDigest !== "string" || !/^[a-f0-9]{64}$/.test(receipt.payloadDigest)) {
    throw new Error("The workspace commit receipt is damaged. Preserve its storage and pending draft.");
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
function assertDraft(value: PendingWorkspaceDraft) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.workspaceId !== "string" || !value.workspaceId.trim() || typeof value.editorId !== "string" || !value.editorId.trim() ||
      !Number.isSafeInteger(value.sequence) || value.sequence < 1 || (value.expectedRevision !== null && !validRevision(value.expectedRevision)) || typeof value.payload !== "string" || (value.recoveryPayload !== undefined && typeof value.recoveryPayload !== "string")) {
    throw new Error("Invalid pending workspace draft. Existing storage was not changed.");
  }
}
function assertHead(value: unknown, workspaceId: string): asserts value is DurableWorkspaceHead | undefined {
  if (value === undefined) return;
  const head = value as Partial<DurableWorkspaceHead>;
  if (!head || typeof head !== "object" || Array.isArray(head) || head.workspaceId !== workspaceId || !validRevision(head.revision) || typeof head.payload !== "string") throw new Error("The durable workspace record is damaged. Preserve its storage and recover a separate copy.");
}
function sameDraft(a: PendingWorkspaceDraft, b: PendingWorkspaceDraft) {
  return a.workspaceId === b.workspaceId && a.editorId === b.editorId && a.sequence === b.sequence && a.expectedRevision === b.expectedRevision && a.payload === b.payload && a.recoveryPayload === b.recoveryPayload;
}

export function createDurableWorkspaceRepository(databaseName: string, factory: IDBFactory = globalThis.indexedDB) {
  if (typeof databaseName !== "string" || !databaseName.trim()) throw new Error("A separate database namespace is required.");
  if (!factory) throw new Error("IndexedDB is unavailable. Keep the existing workspace save and recovery copy.");
  let connection: Promise<IDBDatabase> | undefined;
  let closed = false;
  function database() {
    if (closed) return Promise.reject(new Error("This workspace repository is closed."));
    if (!connection) {
      const opening = new Promise<IDBDatabase>((resolve, reject) => {
        let abandoned = false;
        const request = factory.open(databaseName, 2);
        const fail = (error: unknown) => { abandoned = true; reject(error); };
        request.onblocked = () => fail(new Error("An older connection blocks this workspace database. Close that connection and retry."));
        request.onerror = () => fail(request.error ?? new Error("The workspace database could not open."));
        request.onupgradeneeded = () => {
          if (abandoned || closed) { request.transaction?.abort(); return; }
          const db = request.result;
          if (!db.objectStoreNames.contains(receiptsStore)) db.createObjectStore(receiptsStore, { keyPath: ["workspaceId", "editorId"] });
          if (!db.objectStoreNames.contains(headsStore)) db.createObjectStore(headsStore, { keyPath: "workspaceId" });
          if (!db.objectStoreNames.contains(pendingStore)) {
            const pending = db.createObjectStore(pendingStore, { keyPath: ["workspaceId", "editorId"] });
            pending.createIndex("workspaceId", "workspaceId");
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          if (abandoned || closed) { db.close(); reject(new Error("The workspace database open was canceled.")); return; }
          db.onversionchange = () => { db.close(); if (connection === opening) connection = undefined; };
          resolve(db);
        };
      });
      connection = opening;
      void opening.catch(() => { if (connection === opening) connection = undefined; });
    }
    return connection;
  }
  async function transaction<T>(stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, setResult: (value: T) => void) => void): Promise<T> {
    const db = await database();
    if (closed) throw new Error("This workspace repository is closed.");
    return new Promise<T>((resolve, reject) => {
      const tx = mode === "readwrite" ? db.transaction(stores, mode, { durability: "strict" }) : db.transaction(stores, mode);
      let result: T, ready = false, failure: unknown;
      const fail = (error: unknown) => { failure = error; try { tx.abort(); } catch { /* Transaction already finished. */ } };
      tx.oncomplete = () => ready ? resolve(result) : reject(new Error("The workspace transaction completed without a result."));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error("The workspace transaction was aborted."));
      try { work(tx, value => { result = value; ready = true; }); } catch (error) { fail(error); }
      // Event handlers use this wrapper so validation errors abort instead of
      // escaping the callback and accidentally committing earlier writes.
      guardedHandlers.set(tx, callback => { try { callback(); } catch (error) { fail(error); } });
    });
  }
  const guardedHandlers = new WeakMap<IDBTransaction, (callback: () => void) => void>();
  const guard = (tx: IDBTransaction, callback: () => void) => () => guardedHandlers.get(tx)!(callback);

  // A bounded receipt per editor/workspace establishes the latest accepted
  // operation even after the pending draft was cleared or another editor saved.
  // Hashing happens before opening a write transaction; no async gaps inside it.
  function reconcile(tx: IDBTransaction, draft: PendingWorkspaceDraft, digest: string, done: (result: DurableReceiptResult | null) => void) {
    const request = tx.objectStore(receiptsStore).get([draft.workspaceId, draft.editorId]);
    request.onsuccess = guard(tx, () => {
      const receipt: unknown = request.result; assertReceipt(receipt, draft);
      if (!receipt) { done(null); return; }
      if (receipt.sequence === draft.sequence && (receipt.payloadDigest !== digest || receipt.expectedRevision !== draft.expectedRevision)) {
        throw new Error("A committed draft sequence was reused with different content.");
      }
      const headRequest = tx.objectStore(headsStore).get(draft.workspaceId);
      headRequest.onsuccess = guard(tx, () => {
        assertHead(headRequest.result, draft.workspaceId);
        const head: DurableWorkspaceHead | undefined = headRequest.result;
        if (!head || head.revision < receipt.revision || (receipt.sequence === draft.sequence && head.revision === receipt.revision && head.payload !== draft.payload)) {
          throw new Error("The saved workspace and commit receipt disagree. Preserve storage and recover a separate copy.");
        }
        done(receipt.sequence < draft.sequence ? null : receipt.sequence === draft.sequence ? { kind: "saved", revision: receipt.revision } : { kind: "superseded" });
      });
    });
  }

  return {
    async inspect(workspaceId: string) {
      return transaction<{ head: DurableWorkspaceHead | null; pending: PendingWorkspaceDraft[] }>([headsStore, pendingStore], "readonly", (tx, done) => {
        const snapshot: { head: DurableWorkspaceHead | null; pending: PendingWorkspaceDraft[] } = { head: null, pending: [] };
        let remaining = 2;
        const finish = () => { if (--remaining === 0) done(snapshot); };
        const head = tx.objectStore(headsStore).get(workspaceId);
        head.onsuccess = guard(tx, () => { assertHead(head.result, workspaceId); snapshot.head = head.result ?? null; finish(); });
        const pending = tx.objectStore(pendingStore).index("workspaceId").getAll(workspaceId);
        pending.onsuccess = guard(tx, () => { const drafts = pending.result as PendingWorkspaceDraft[]; drafts.forEach(assertDraft); snapshot.pending = drafts; finish(); });
      });
    },
    async read(workspaceId: string) {
      return transaction<DurableWorkspaceHead | null>([headsStore], "readonly", (tx, done) => {
        const request = tx.objectStore(headsStore).get(workspaceId);
        request.onsuccess = guard(tx, () => { assertHead(request.result, workspaceId); done(request.result ?? null); });
      });
    },
    // Read-only discovery across workspaces, including when legacy startup fails.
    // Invalid metadata fails inspection rather than falsely reporting no copies.
    async pendingAll() {
      return transaction<PendingWorkspaceDraft[]>([pendingStore], "readonly", (tx, done) => {
        const request = tx.objectStore(pendingStore).getAll();
        request.onsuccess = guard(tx, () => { const values = request.result as PendingWorkspaceDraft[]; values.forEach(assertDraft); done(values); });
      });
    },
    async pending(workspaceId: string) {
      return transaction<PendingWorkspaceDraft[]>([pendingStore], "readonly", (tx, done) => {
        const request = tx.objectStore(pendingStore).index("workspaceId").getAll(workspaceId);
        request.onsuccess = guard(tx, () => { const values = request.result as PendingWorkspaceDraft[]; values.forEach(assertDraft); done(values); });
      });
    },
    async stage(value: PendingWorkspaceDraft, limits?: { maxDrafts: number; maxPayloadCharacters: number }) {
      if (limits && (!Number.isSafeInteger(limits.maxDrafts) || limits.maxDrafts < 1 || !Number.isSafeInteger(limits.maxPayloadCharacters) || limits.maxPayloadCharacters < 1)) throw new Error("Invalid recovery retention limits.");
      assertDraft(value); const draft = { ...value }, digest = await workspaceDraftDigest(draft);
      return transaction<{ kind: "staged" } | { kind: "superseded" } | { kind: "saved"; revision: number }>([headsStore, pendingStore, receiptsStore], "readwrite", (tx, done) => {
        reconcile(tx, draft, digest, result => {
          if (result) { done(result); return; }
          const store = tx.objectStore(pendingStore), request = store.get([draft.workspaceId, draft.editorId]);
          request.onsuccess = guard(tx, () => {
            const existing = request.result as PendingWorkspaceDraft | undefined;
            if (existing) {
              assertDraft(existing);
              if (existing.sequence > draft.sequence) { done({ kind: "superseded" }); return; }
              if (existing.sequence === draft.sequence) {
                if (!sameDraft(existing, draft)) throw new Error("A pending draft sequence was reused with different content.");
                done({ kind: "staged" }); return;
              }
            }
            if (!limits) { store.put(draft); done({ kind: "staged" }); return; }
            // Check capacity in the same transaction as the write. Never evict
            // another editor's unresolved copy to make space for this one.
            const inventory = store.getAll();
            inventory.onsuccess = guard(tx, () => {
              const drafts = inventory.result as PendingWorkspaceDraft[]; drafts.forEach(assertDraft);
              const others = drafts.filter(item => item.workspaceId !== draft.workspaceId || item.editorId !== draft.editorId);
              const characters = others.reduce((total, item) => total + item.payload.length + (item.recoveryPayload?.length ?? 0), draft.payload.length + (draft.recoveryPayload?.length ?? 0));
              if (others.length >= limits.maxDrafts || characters > limits.maxPayloadCharacters) throw new Error("Recovery storage limit reached. Existing copies were preserved; download a backup.");
              store.put(draft); done({ kind: "staged" });
            });
          });
        });
      });
    },
    async commit(value: PendingWorkspaceDraft): Promise<DurableCommitResult> {
      assertDraft(value); const draft = { ...value }, digest = await workspaceDraftDigest(draft);
      return transaction<DurableCommitResult>([headsStore, pendingStore, receiptsStore], "readwrite", (tx, done) => {
        reconcile(tx, draft, digest, result => {
          if (result) { done(result); return; }
          const pending = tx.objectStore(pendingStore), request = pending.get([draft.workspaceId, draft.editorId]);
          request.onsuccess = guard(tx, () => {
            const staged = request.result as PendingWorkspaceDraft | undefined;
            if (!staged) throw new Error("Stage this draft durably before committing it.");
            assertDraft(staged);
            if (!sameDraft(staged, draft)) { done({ kind: "superseded" }); return; }
            const heads = tx.objectStore(headsStore), headRequest = heads.get(draft.workspaceId);
            headRequest.onsuccess = guard(tx, () => {
              assertHead(headRequest.result, draft.workspaceId);
              const revision = headRequest.result?.revision ?? null;
              if (revision !== draft.expectedRevision) { done({ kind: "conflict", revision }); return; }
              const next = (revision ?? 0) + 1;
              if (!Number.isSafeInteger(next)) throw new Error("The workspace revision limit was reached.");
              heads.put({ workspaceId: draft.workspaceId, revision: next, payload: draft.payload } satisfies DurableWorkspaceHead);
              tx.objectStore(receiptsStore).put({ workspaceId: draft.workspaceId, editorId: draft.editorId, sequence: draft.sequence, expectedRevision: draft.expectedRevision, revision: next, payloadDigest: digest } satisfies CommitReceipt);
              pending.delete([draft.workspaceId, draft.editorId]);
              done({ kind: "saved", revision: next });
            });
          });
        });
      });
    },
    async close() {
      closed = true; const opening = connection; connection = undefined;
      if (opening) { try { (await opening).close(); } catch { /* A failed open owns no connection to release. */ } }
    },
  };
}
