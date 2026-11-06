import { encodeHistoryRecoveryArchive, type HistoryArchiveRecord } from "./historyRecoveryArchive";

export interface DurableHistoryCandidate {
  version: 1;
  id: string;
  workspaceId: string;
  snapshotId: string;
  capturedAt: string;
  payload: string;
}
export type DurableHistoryResult = { kind: "staged" } | { kind: "reconciled"; payloadRetained: boolean };
export type DurableHistoryReceipt = { version: 1; id: string; digest: string } | { version: 2; id: string; digest: string; candidate: DurableHistoryCandidate };
const candidatesStore = "historyCandidates", receiptsStore = "reconciledHistory";
const fields = ["version", "id", "workspaceId", "snapshotId", "capturedAt", "payload"];
function assertCandidate(value: unknown): asserts value is DurableHistoryCandidate {
  const record = value as Partial<DurableHistoryCandidate>;
  if (!record || typeof record !== "object" || Array.isArray(record) || Object.keys(record).length !== fields.length || !fields.every(field => Object.hasOwn(record, field)) ||
      record.version !== 1 || ![record.id, record.workspaceId, record.snapshotId].every(item => typeof item === "string" && Boolean(item.trim())) ||
      typeof record.payload !== "string" || typeof record.capturedAt !== "string" || !Number.isFinite(Date.parse(record.capturedAt))) {
    throw new Error("The saved history record is incomplete or unsupported. Preserve its original storage.");
  }
}
function capture(value: DurableHistoryCandidate): DurableHistoryCandidate {
  assertCandidate(value);
  return { version: 1, id: value.id, workspaceId: value.workspaceId, snapshotId: value.snapshotId, capturedAt: value.capturedAt, payload: value.payload };
}
function same(left: DurableHistoryCandidate, right: DurableHistoryCandidate) { return fields.every(field => left[field as keyof DurableHistoryCandidate] === right[field as keyof DurableHistoryCandidate]); }
export async function historyCandidateDigest(candidate: DurableHistoryCandidate): Promise<string> {
  const record = capture(candidate);
  if (!globalThis.crypto?.subtle) throw new Error("Secure hashing is unavailable. Keep the history recovery copy.");
  const bytes = new TextEncoder().encode(JSON.stringify(fields.map(field => record[field as keyof DurableHistoryCandidate])));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function captureHistoryReceipt(value: unknown): DurableHistoryReceipt {
  const receipt = value as Partial<{ version: number; id: string; digest: string; candidate: DurableHistoryCandidate }>;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) ||
      (receipt.version !== 1 && receipt.version !== 2) || Object.keys(receipt).length !== (receipt.version === 1 ? 3 : 4) ||
      !(receipt.version === 1 ? ["version", "id", "digest"] : ["version", "id", "digest", "candidate"]).every(field => Object.hasOwn(receipt, field)) ||
      typeof receipt.id !== "string" || !receipt.id.trim() || typeof receipt.digest !== "string" || !/^[a-f0-9]{64}$/.test(receipt.digest)) {
    throw new Error("The history reconciliation receipt is damaged. Preserve the original recovery data.");
  }
  if (receipt.version === 1) return { version: 1, id: receipt.id, digest: receipt.digest };
  const candidate = capture(receipt.candidate!);
  if (candidate.id !== receipt.id) throw new Error("The retained history receipt and candidate disagree. Preserve the original recovery data.");
  return { version: 2, id: receipt.id, digest: receipt.digest, candidate };
}
export function historyReceiptMatches(value: unknown, record: DurableHistoryCandidate, digest: string) {
  if (value === undefined) return false;
  const receipt = captureHistoryReceipt(value);
  if (receipt.id !== record.id || receipt.digest !== digest || receipt.version === 2 && !same(receipt.candidate, record)) throw new Error("A history record ID was reused with different content. Both copies require review.");
  return true;
}

// Separate recovery journal. It never writes active workspace storage. A receipt
// prevents an uncertain old stage from resurrecting an already reconciled copy.
export function createDurableHistoryRepository(databaseName: string, factory: IDBFactory = globalThis.indexedDB) {
  if (typeof databaseName !== "string" || !databaseName.trim()) throw new Error("A separate history database namespace is required.");
  if (!factory) throw new Error("IndexedDB is unavailable. Keep the history recovery copy.");
  let opening: Promise<IDBDatabase> | undefined, closed = false;
  function database() {
    if (closed) return Promise.reject(new Error("This history repository is closed."));
    if (!opening) {
      const attempt = new Promise<IDBDatabase>((resolve, reject) => {
        let abandoned = false;
        const request = factory.open(databaseName, 1);
        request.onblocked = () => { abandoned = true; reject(new Error("Another connection blocks the history database. Keep the recovery copy and retry.")); };
        request.onerror = () => { abandoned = true; reject(request.error ?? new Error("History storage could not open.")); };
        request.onupgradeneeded = () => {
          if (abandoned || closed) { request.transaction?.abort(); return; }
          if (!request.result.objectStoreNames.contains(candidatesStore)) request.result.createObjectStore(candidatesStore, { keyPath: "id" });
          if (!request.result.objectStoreNames.contains(receiptsStore)) request.result.createObjectStore(receiptsStore, { keyPath: "id" });
        };
        request.onsuccess = () => {
          const db = request.result;
          if (abandoned || closed) { db.close(); reject(new Error("The history database open was canceled.")); return; }
          db.onversionchange = () => { db.close(); if (opening === attempt) opening = undefined; };
          resolve(db);
        };
      });
      opening = attempt; void attempt.catch(() => { if (opening === attempt) opening = undefined; });
    }
    return opening;
  }
  async function transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction, done: (result: T) => void, guard: (callback: () => void) => () => void) => void): Promise<T> {
    const db = await database(); if (closed) throw new Error("This history repository is closed.");
    return new Promise<T>((resolve, reject) => {
      const tx = mode === "readwrite" ? db.transaction([candidatesStore, receiptsStore], mode, { durability: "strict" }) : db.transaction([candidatesStore, receiptsStore], mode);
      let result: T, ready = false, failure: unknown;
      const fail = (error: unknown) => { failure = error; try { tx.abort(); } catch { /* Already finished. */ } };
      const guard = (callback: () => void) => () => { try { callback(); } catch (error) { fail(error); } };
      tx.oncomplete = () => ready ? resolve(result) : reject(new Error("History storage completed without an acknowledgement."));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error("The history transaction was aborted."));
      try { work(tx, value => { result = value; ready = true; }, guard); } catch (error) { fail(error); }
    });
  }
  async function change(candidate: DurableHistoryCandidate, resolving: boolean): Promise<DurableHistoryResult> {
    const record = capture(candidate), digest = await historyCandidateDigest(record);
    return transaction("readwrite", (tx, done, guard) => {
      const receipts = tx.objectStore(receiptsStore), candidates = tx.objectStore(candidatesStore), receipt = receipts.get(record.id);
      receipt.onsuccess = guard(() => {
        if (historyReceiptMatches(receipt.result, record, digest)) {
          const payloadRetained = captureHistoryReceipt(receipt.result).version === 2;
          const remaining = candidates.get(record.id);
          remaining.onsuccess = guard(() => { if (remaining.result !== undefined) throw new Error("The history receipt and live candidate disagree. Preserve the original recovery data."); done({ kind: "reconciled", payloadRetained }); });
          return;
        }
        const existing = candidates.get(record.id);
        existing.onsuccess = guard(() => {
          if (existing.result !== undefined) {
            assertCandidate(existing.result);
            if (!same(existing.result, record)) throw new Error("A history record ID already contains different data. Preserve both copies.");
          }
          if (resolving) {
            // Keep the full original payload in the same transaction as removing
            // its pending entry. Legacy workspace save and this journal are not
            // one transaction; a digest alone cannot recover lost workspace data.
            receipts.add({ version: 2, id: record.id, digest, candidate: record });
            candidates.delete(record.id);
            done({ kind: "reconciled", payloadRetained: true });
          } else {
            if (existing.result === undefined) candidates.add(record);
            done({ kind: "staged" });
          }
        });
      });
    });
  }
  return {
    inspectRetained: async () => {
      const snapshot = await transaction<{ receipts: unknown[]; liveKeys: IDBValidKey[] }>("readonly", (tx, done, guard) => {
        const receipts = tx.objectStore(receiptsStore).getAll(), liveKeys = tx.objectStore(candidatesStore).getAllKeys();
        let remaining = 2;
        const finish = guard(() => { if (--remaining === 0) done({ receipts: receipts.result, liveKeys: liveKeys.result }); });
        receipts.onsuccess = finish; liveKeys.onsuccess = finish;
      });
      const liveIds = new Set(snapshot.liveKeys.filter(key => typeof key === "string"));
      const candidates: DurableHistoryCandidate[] = []; let legacyReceipts = 0, unreadableRecords = 0;
      for (const value of snapshot.receipts) {
        let receipt: DurableHistoryReceipt;
        try { receipt = captureHistoryReceipt(value); }
        catch { unreadableRecords += 1; continue; }
        if (liveIds.has(receipt.id)) { unreadableRecords += 1; continue; }
        if (receipt.version === 1) { legacyReceipts += 1; continue; }
        // Hash after the read-only transaction completes. A hashing/environment
        // failure rejects inspection rather than mislabelling records as damaged.
        if (await historyCandidateDigest(receipt.candidate) !== receipt.digest) { unreadableRecords += 1; continue; }
        candidates.push(capture(receipt.candidate));
      }
      return { candidates, legacyReceipts, unreadableRecords };
    },
    exportRecoveryArchive: async () => {
      const records = await transaction<HistoryArchiveRecord[]>("readonly", (tx, done, guard) => {
        const captured: HistoryArchiveRecord[] = []; let remaining = 2;
        for (const name of [candidatesStore, receiptsStore]) {
          const request = tx.objectStore(name).openCursor();
          request.onsuccess = guard(() => {
            const cursor = request.result;
            if (cursor) { captured.push({ store: name, key: cursor.key, value: cursor.value }); cursor.continue(); }
            else if (--remaining === 0) done(captured);
          });
        }
      });
      return encodeHistoryRecoveryArchive(databaseName, records);
    },
    stage: (candidate: DurableHistoryCandidate) => change(candidate, false),
    // Call only after the corresponding combined workspace save is acknowledged.
    reconcile: (candidate: DurableHistoryCandidate) => change(candidate, true),
    inspect: () => transaction<{ candidates: DurableHistoryCandidate[]; unreadableRecords: number }>("readonly", (tx, done, guard) => {
      const request = tx.objectStore(candidatesStore).getAll();
      request.onsuccess = guard(() => {
        const candidates: DurableHistoryCandidate[] = []; let unreadableRecords = 0, remaining = request.result.length;
        if (!remaining) { done({ candidates, unreadableRecords }); return; }
        const finish = () => { if (--remaining === 0) done({ candidates, unreadableRecords }); };
        for (const value of request.result as unknown[]) {
          try { assertCandidate(value); }
          catch { unreadableRecords += 1; finish(); continue; }
          const receipt = tx.objectStore(receiptsStore).get(value.id);
          receipt.onsuccess = guard(() => { if (receipt.result !== undefined) unreadableRecords += 1; else candidates.push(capture(value)); finish(); });
        }
      });
    }),
    async close() { closed = true; try { (await opening)?.close(); } catch { /* Preserve the original open error for its caller. */ } },
  };
}
