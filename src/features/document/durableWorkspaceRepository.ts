// Isolated persistence foundation. The active application still uses its
// existing save adapter until migration and recovery UI have been verified.
export interface PendingWorkspaceDraft {
  workspaceId: string;
  editorId: string;
  sequence: number;
  expectedRevision: number | null;
  payload: string;
}
export interface DurableWorkspaceHead {
  workspaceId: string;
  revision: number;
  payload: string;
}
export type DurableCommitResult = { kind: "saved"; revision: number } | { kind: "conflict"; revision: number | null } | { kind: "superseded" };

const headsStore = "workspaceHeads", pendingStore = "pendingDrafts";

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}
function assertDraft(value: PendingWorkspaceDraft) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.workspaceId !== "string" || !value.workspaceId.trim() || typeof value.editorId !== "string" || !value.editorId.trim() ||
      !Number.isSafeInteger(value.sequence) || value.sequence < 1 || (value.expectedRevision !== null && !validRevision(value.expectedRevision)) || typeof value.payload !== "string") {
    throw new Error("Invalid pending workspace draft. Existing storage was not changed.");
  }
}
function assertHead(value: unknown, workspaceId: string): asserts value is DurableWorkspaceHead | undefined {
  if (value === undefined) return;
  const head = value as Partial<DurableWorkspaceHead>;
  if (!head || typeof head !== "object" || Array.isArray(head) || head.workspaceId !== workspaceId || !validRevision(head.revision) || typeof head.payload !== "string") throw new Error("The durable workspace record is damaged. Preserve its storage and recover a separate copy.");
}
function sameDraft(a: PendingWorkspaceDraft, b: PendingWorkspaceDraft) {
  return a.workspaceId === b.workspaceId && a.editorId === b.editorId && a.sequence === b.sequence && a.expectedRevision === b.expectedRevision && a.payload === b.payload;
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
        const request = factory.open(databaseName, 1);
        const fail = (error: unknown) => { abandoned = true; reject(error); };
        request.onblocked = () => fail(new Error("An older connection blocks this workspace database. Close that connection and retry."));
        request.onerror = () => fail(request.error ?? new Error("The workspace database could not open."));
        request.onupgradeneeded = () => {
          if (abandoned || closed) { request.transaction?.abort(); return; }
          const db = request.result;
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

  return {
    async read(workspaceId: string) {
      return transaction<DurableWorkspaceHead | null>([headsStore], "readonly", (tx, done) => {
        const request = tx.objectStore(headsStore).get(workspaceId);
        request.onsuccess = guard(tx, () => { assertHead(request.result, workspaceId); done(request.result ?? null); });
      });
    },
    async pending(workspaceId: string) {
      return transaction<PendingWorkspaceDraft[]>([pendingStore], "readonly", (tx, done) => {
        const request = tx.objectStore(pendingStore).index("workspaceId").getAll(workspaceId);
        request.onsuccess = guard(tx, () => { const values = request.result as PendingWorkspaceDraft[]; values.forEach(assertDraft); done(values); });
      });
    },
    async stage(value: PendingWorkspaceDraft) {
      assertDraft(value); const draft = { ...value };
      return transaction<{ kind: "staged" | "superseded" }>([pendingStore], "readwrite", (tx, done) => {
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
          store.put(draft); done({ kind: "staged" });
        });
      });
    },
    async commit(value: PendingWorkspaceDraft): Promise<DurableCommitResult> {
      assertDraft(value); const draft = { ...value };
      return transaction<DurableCommitResult>([headsStore, pendingStore], "readwrite", (tx, done) => {
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
            pending.delete([draft.workspaceId, draft.editorId]);
            done({ kind: "saved", revision: next });
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
