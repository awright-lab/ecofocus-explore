import { expect, it, vi } from "vitest";
import { createPersistentWorkspaceHistory } from "../persistentWorkspaceHistory";
import type { DurableHistoryCandidate, DurableHistoryResult } from "../durableHistoryRepository";
const source = { workspaceId: "synthetic", snapshotId: "snapshot", payload: "original captured bytes" };
function record(id = "stored-record", payload = source.payload): DurableHistoryCandidate { return { version: 1, id, ...source, payload, capturedAt: "2026-11-06T00:00:00Z" }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => {resolve=yes;}); return {promise,resolve}; }
function repository(initial: DurableHistoryCandidate[] = []) {
 const data = new Map(initial.map(value => [value.id, structuredClone(value)])), receipts = new Map<string,string>();
 const key = (value: DurableHistoryCandidate) => JSON.stringify(value);
 return { data, receipts,
  inspect: vi.fn(async () => ({ candidates: [...data.values()].map(value=>structuredClone(value)), unreadableRecords: 0 })),
  stage: vi.fn(async (value: DurableHistoryCandidate): Promise<DurableHistoryResult> => { const prior=receipts.get(value.id); if(prior!==undefined){if(prior!==key(value))throw Error("Receipt ID collision");return {kind:"reconciled",payloadRetained:true};} const current=data.get(value.id);if(current&&key(current)!==key(value))throw Error("Candidate ID collision");data.set(value.id,structuredClone(value));return {kind:"staged"}; }),
  reconcile: vi.fn(async (value: DurableHistoryCandidate): Promise<DurableHistoryResult> => { const current=data.get(value.id), prior=receipts.get(value.id); if(current&&key(current)!==key(value)||prior!==undefined&&prior!==key(value))throw Error("Reconcile ID collision");receipts.set(value.id,key(value));data.delete(value.id);return {kind:"reconciled",payloadRetained:true}; }),
  close: vi.fn(async () => {}),
 };
}
it("exposes memory first and marks stored only after the stage acknowledgement", async () => {
 const repo=repository(), stage=deferred<DurableHistoryResult>(); repo.stage.mockImplementation(()=>stage.promise); const store=createPersistentWorkspaceHistory(repo,()=>"new-record"), input={...source};
 const id=store.remember(input);input.payload="caller mutation";expect(store.getPending()[0].payload).toBe(source.payload);expect(store.getDurability(id)).toBe("memory");
 await vi.waitFor(()=>expect(repo.stage).toHaveBeenCalledOnce());expect(store.getDurability(id)).toBe("writing");stage.resolve({kind:"staged"});await vi.waitFor(()=>expect(store.getDurability(id)).toBe("stored"));await store.close();
});
it("shares startup inspection and hydrates stored candidates without rewriting them", async () => {
 const repo=repository([record()]), scan=deferred<Awaited<ReturnType<typeof repo.inspect>>>();repo.inspect.mockReturnValue(scan.promise);const store=createPersistentWorkspaceHistory(repo);
 const first=store.initialize(),second=store.initialize();expect(first).toBe(second);scan.resolve({candidates:[record()],unreadableRecords:1});await first;
 expect(store.getPending()).toHaveLength(1);expect(store.getDurability(store.getPending()[0].id)).toBe("stored");expect(store.getStorageState().unreadableRecords).toBe(1);expect(repo.stage).not.toHaveBeenCalled();await store.close();
});
it("merges a memory arrival during startup with its identical stored copy", async () => {
 const repo=repository(), scan=deferred<Awaited<ReturnType<typeof repo.inspect>>>();repo.inspect.mockReturnValue(scan.promise);const makeId=vi.fn(()=>"unneeded-new-id"),store=createPersistentWorkspaceHistory(repo,makeId);
 const id=store.remember(source);scan.resolve({candidates:[record()],unreadableRecords:0});await vi.waitFor(()=>expect(store.getDurability(id)).toBe("stored"));
 expect(store.getPending()).toHaveLength(1);expect(makeId).not.toHaveBeenCalled();expect(repo.stage.mock.calls[0][0].id).toBe("stored-record");await store.close();
});
it("preserves different arrivals while startup candidates are loading", async () => {
 const repo=repository([record()]),store=createPersistentWorkspaceHistory(repo,()=>"newer-record");store.remember({...source,payload:"different newer payload"});
 await vi.waitFor(()=>expect(store.getPending()).toHaveLength(2));expect(new Set(store.getPending().map(value=>value.payload))).toEqual(new Set([source.payload,"different newer payload"]));await store.close();
});
it("retries the same captured operation after a lost stage acknowledgement", async () => {
 const repo=repository(), stage=repo.stage.getMockImplementation()!;let lost=true;repo.stage.mockImplementation(async value=>{const result=await stage(value);if(lost){lost=false;throw Error("Lost acknowledgement");}return result;});
 const makeId=vi.fn(()=>"stable-operation"),store=createPersistentWorkspaceHistory(repo,makeId),id=store.remember(source);await vi.waitFor(()=>expect(store.getDurability(id)).toBe("failed"));
 const first=structuredClone(repo.stage.mock.calls[0][0]);await store.retryStorage();expect(store.getDurability(id)).toBe("stored");expect(makeId).toHaveBeenCalledOnce();expect(repo.stage.mock.calls.at(-1)![0]).toEqual(first);await store.close();
});
it("never clears memory before durable reconciliation completes", async () => {
 const repo=repository([record()]),receipt=deferred<DurableHistoryResult>();repo.reconcile.mockReturnValue(receipt.promise);const store=createPersistentWorkspaceHistory(repo);await store.initialize();const id=store.getPending()[0].id,clearing=store.acknowledge(id);
 await vi.waitFor(()=>expect(repo.reconcile).toHaveBeenCalledOnce());expect(store.getPending()).toHaveLength(1);receipt.resolve({kind:"reconciled",payloadRetained:true});await clearing;expect(store.getPending()).toHaveLength(0);await store.close();
});
it("keeps candidates and the same identity after failed reconciliation", async () => {
 const repo=repository([record()]),reconcile=repo.reconcile.getMockImplementation()!;repo.reconcile.mockRejectedValueOnce(Error("Abort"));const store=createPersistentWorkspaceHistory(repo);await store.initialize();const id=store.getPending()[0].id;
 await expect(store.acknowledge(id)).rejects.toThrow("Abort");expect(store.getPending()).toHaveLength(1);expect(store.getDurability(id)).toBe("failed");repo.reconcile.mockImplementation(reconcile);await store.acknowledge(id);expect(repo.reconcile.mock.calls[1][0]).toEqual(repo.reconcile.mock.calls[0][0]);expect(store.getPending()).toHaveLength(0);await store.close();
});
it("deduplicates identical content without hiding multiple durable records", async () => {
 const repo=repository([record("first"),record("second")]),store=createPersistentWorkspaceHistory(repo);await store.initialize();expect(store.getPending()).toHaveLength(1);await store.acknowledge(store.getPending()[0].id);expect(repo.reconcile).toHaveBeenCalledTimes(2);expect(repo.data.size).toBe(0);await store.close();
});
it("does not use a receipt for a different payload sharing an ID", async () => {
 const repo=repository(),store=createPersistentWorkspaceHistory(repo,()=>"colliding-id"),first=store.remember(source);await vi.waitFor(()=>expect(store.getDurability(first)).toBe("stored"));
 const second=store.remember({...source,payload:"different data"});await vi.waitFor(()=>expect(store.getDurability(second)).toBe("failed"));await store.acknowledge(first);
 await expect(store.acknowledge(second)).rejects.toThrow("collision");expect(store.getPending().map(value=>value.payload)).toEqual(["different data"]);await store.close();
});
it("preserves data if unique record IDs are unavailable, then retries safely", async () => {
 const repo=repository(),makeId=vi.fn<() => string>(()=>{throw Error("No secure ID");}),store=createPersistentWorkspaceHistory(repo,makeId),id=store.remember(source);await vi.waitFor(()=>expect(store.getDurability(id)).toBe("failed"));expect(repo.stage).not.toHaveBeenCalled();makeId.mockImplementation(()=>"available-id");await store.retryStorage();expect(store.getDurability(id)).toBe("stored");await store.close();
});
it("does not publish a false durable acknowledgement after closing during a stage", async () => {
 const repo=repository(),stage=deferred<DurableHistoryResult>();repo.stage.mockReturnValue(stage.promise);const store=createPersistentWorkspaceHistory(repo,()=>"closing-id"),id=store.remember(source);await vi.waitFor(()=>expect(repo.stage).toHaveBeenCalledOnce());await store.close();stage.resolve({kind:"staged"});await vi.waitFor(()=>expect(store.getStorageState().phase).toBe("closed"));expect(store.getPending()).toHaveLength(1);expect(store.getDurability(id)).not.toBe("stored");
});
it("cannot discard persistent candidates with a memory reset", async () => {
 const store=createPersistentWorkspaceHistory(repository([record()]));await store.initialize();expect(()=>store.clear()).toThrow("cannot be discarded");expect(store.getPending()).toHaveLength(1);await store.close();
});
it("keeps memory data and exposes an unavailable startup read", async () => {
 const repo=repository();repo.inspect.mockRejectedValue(Error("Blocked storage"));const store=createPersistentWorkspaceHistory(repo,()=>"pending-id"),id=store.remember(source);await vi.waitFor(()=>expect(store.getDurability(id)).toBe("failed"));expect(store.getPending()[0].payload).toBe(source.payload);expect(store.getStorageState().phase).toBe("failed");expect(repo.stage).not.toHaveBeenCalled();await store.close();
});

it("keeps a recoverable memory copy when the repository constructor itself throws",async()=>{
 const make=vi.fn(()=>{throw new DOMException("Synthetic storage access denied","SecurityError");});const store=createPersistentWorkspaceHistory(make,()=>"stable-id");const id=store.remember(source);
 await expect(store.initialize()).rejects.toThrow("denied");await expect(store.retryStorage()).rejects.toThrow("denied");
 expect(store.getPending()).toEqual([{id,...source}]);expect(store.getDurability(id)).toBe("failed");expect(store.getStorageState()).toMatchObject({phase:"failed",error:expect.stringContaining("could not be confirmed")});await store.close();
});
it("retries constructor failure without replacing memory identity or inventing a stored acknowledgement",async()=>{
 const repo=repository(),make=vi.fn<()=>typeof repo>().mockImplementation(()=>{throw Error("Synthetic constructor failure");});const store=createPersistentWorkspaceHistory(make,()=>"stable-retry-id"),id=store.remember({...source,payload:"opaque\ud800text"});
 await expect(store.retryStorage()).rejects.toThrow("constructor failure");const before=store.getPending();make.mockReturnValue(repo);await store.retryStorage();
 expect(store.getPending()).toBe(before);expect(store.getDurability(id)).toBe("stored");expect(repo.stage).toHaveBeenCalledTimes(1);expect(repo.stage.mock.calls[0][0]).toMatchObject({id:"stable-retry-id",payload:"opaque\ud800text"});expect(repo.reconcile).not.toHaveBeenCalled();await store.close();
});
it("can close an unopened factory without touching browser storage",async()=>{
 const make=vi.fn(()=>repository()),store=createPersistentWorkspaceHistory(make);await store.close();expect(make).not.toHaveBeenCalled();await expect(store.initialize()).rejects.toThrow("closed");expect(()=>store.remember(source)).toThrow("closed");
});
it("retains memory when secure ID generation is unavailable and retries after it returns",async()=>{
 const repo=repository(),makeId=vi.fn<()=>string>().mockImplementation(()=>{throw Error("Secure ID generation unavailable");}),store=createPersistentWorkspaceHistory(()=>repo,makeId),id=store.remember(source);
 await expect(store.retryStorage()).rejects.toThrow("Secure ID");expect(store.getPending()).toEqual([{id,...source}]);expect(store.getDurability(id)).toBe("failed");expect(repo.stage).not.toHaveBeenCalled();makeId.mockReturnValue("safe-retry-id");await store.retryStorage();expect(store.getDurability(id)).toBe("stored");expect(repo.stage).toHaveBeenCalledTimes(1);await store.close();
});

it("retains duplicate physical copies after a later receipt abort and finishes safely after cold reopen",async()=>{
 const repo=repository([record("first"),record("second")]),commit=repo.reconcile.getMockImplementation()!;
 repo.reconcile.mockImplementation(async value=>{if(value.id==="second")throw Error("Second transaction aborted");return commit(value);});
 const store=createPersistentWorkspaceHistory(repo);await store.initialize();const id=store.getPending()[0].id;
 await expect(store.acknowledge(id)).rejects.toThrow("Second transaction aborted");expect(repo.receipts.has("first")).toBe(true);expect(repo.data.has("first")).toBe(false);expect(repo.data.get("second")?.payload).toBe(source.payload);expect(store.getPending()).toHaveLength(1);await store.close();
 repo.reconcile.mockImplementation(commit);const reopened=createPersistentWorkspaceHistory(repo);await reopened.initialize();expect(reopened.getPending()).toHaveLength(1);await reopened.acknowledge(reopened.getPending()[0].id);expect(repo.data.size).toBe(0);expect(repo.receipts.size).toBe(2);expect(reopened.getPending()).toHaveLength(0);await reopened.close();
});
it("retries a partial duplicate reconciliation without reusing a receipt for missing content",async()=>{
 const repo=repository([record("first"),record("second")]),commit=repo.reconcile.getMockImplementation()!,store=createPersistentWorkspaceHistory(repo);let fail=true;
 repo.reconcile.mockImplementation(async value=>{if(value.id==="second"&&fail)throw Error("Second receipt unavailable");return commit(value);});await store.initialize();const id=store.getPending()[0].id;
 await expect(store.acknowledge(id)).rejects.toThrow("Second receipt");fail=false;await store.retryStorage();expect(store.getPending()).toHaveLength(1);await store.acknowledge(id);
 expect(repo.reconcile.mock.calls.filter(([value])=>value.id==="first")).toHaveLength(1);expect(repo.data.size).toBe(0);expect(store.getPending()).toHaveLength(0);await store.close();
});
it("recognizes a committed reconciliation whose acknowledgement was lost without resurrecting its payload",async()=>{
 const repo=repository([record()]),commit=repo.reconcile.getMockImplementation()!,store=createPersistentWorkspaceHistory(repo);
 repo.reconcile.mockImplementation(async value=>{await commit(value);throw Error("Synthetic lost receipt acknowledgement");});await store.initialize();const id=store.getPending()[0].id;
 await expect(store.acknowledge(id)).rejects.toThrow("lost receipt acknowledgement");expect(store.getPending()).toHaveLength(1);expect(repo.data.size).toBe(0);expect(repo.receipts.size).toBe(1);
 await store.retryStorage();expect(store.getPending()).toHaveLength(0);expect(repo.data.size).toBe(0);expect(repo.stage).toHaveBeenCalledTimes(1);expect(repo.stage.mock.calls[0][0]).toEqual(repo.reconcile.mock.calls[0][0]);await store.close();
});
it("serializes retry behind an uncertain reconciliation and never exposes an obsolete inspection result",async()=>{
 const repo=repository([record()]),commit=repo.reconcile.getMockImplementation()!,held=deferred<DurableHistoryResult>();repo.reconcile.mockImplementation(async value=>{await commit(value);return held.promise;});const store=createPersistentWorkspaceHistory(repo);await store.initialize();
 const ack=store.acknowledge(store.getPending()[0].id),retry=store.retryStorage();await vi.waitFor(()=>expect(repo.receipts.size).toBe(1));expect(repo.inspect).toHaveBeenCalledTimes(1);expect(store.getPending()).toHaveLength(1);
 held.resolve({kind:"reconciled",payloadRetained:true});await Promise.all([ack,retry]);expect(repo.inspect).toHaveBeenCalledTimes(2);expect(store.getPending()).toHaveLength(0);expect(repo.data.size).toBe(0);await store.close();
});

it("keeps the original memory payload when an older stage receipt protects replay but retains no data",async()=>{
 const repo=repository();repo.stage.mockResolvedValue({kind:"reconciled",payloadRetained:false});const store=createPersistentWorkspaceHistory(repo,()=>"legacy-receipt-id"),id=store.remember(source);
 await expect(store.retryStorage()).rejects.toThrow("retained recovery payload");expect(store.getPending()).toEqual([{id,...source}]);expect(store.getDurability(id)).toBe("failed");expect(repo.reconcile).not.toHaveBeenCalled();await store.close();
});
it("does not clear a memory copy after acknowledging a legacy digest-only receipt",async()=>{
 const repo=repository([record()]);repo.reconcile.mockResolvedValue({kind:"reconciled",payloadRetained:false});const store=createPersistentWorkspaceHistory(repo);await store.initialize();const entry=store.getPending()[0];
 await expect(store.acknowledge(entry.id)).rejects.toThrow("retained recovery payload");expect(store.getPending()).toEqual([entry]);expect(store.getDurability(entry.id)).toBe("failed");await store.close();
});

it.each(["stage","reconcile"] as const)("retains memory when an untyped older adapter omits retention proof from %s",async operation=>{
 const repo=repository(operation==="reconcile"?[record()]:[]);repo[operation].mockResolvedValue({kind:"reconciled"} as DurableHistoryResult);const store=createPersistentWorkspaceHistory(repo,()=>"missing-proof");
 if(operation==="stage"){store.remember(source);await expect(store.retryStorage()).rejects.toThrow("retained recovery payload");}else{await store.initialize();await expect(store.acknowledge(store.getPending()[0].id)).rejects.toThrow("retained recovery payload");}
 expect(store.getPending()).toHaveLength(1);expect(store.getPending()[0].payload).toBe(source.payload);await store.close();
});

it("inspects retained copies only on demand and exposes immutable results without hydrating pending history",async()=>{
 const original=record(),scan={candidates:[original],legacyReceipts:2,unreadableRecords:1},repo={...repository(),inspectRetained:vi.fn(async()=>scan)},store=createPersistentWorkspaceHistory(repo);await store.initialize();expect(repo.inspectRetained).not.toHaveBeenCalled();const result=await store.inspectRetained!();expect(result).toEqual(scan);expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.candidates)).toBe(true);expect(Object.isFrozen(result.candidates[0])).toBe(true);original.payload="changed adapter object";expect(result.candidates[0].payload).toBe(source.payload);expect(store.getPending()).toHaveLength(0);expect(repo.stage).not.toHaveBeenCalled();expect(repo.reconcile).not.toHaveBeenCalled();await store.close();
});
it("does not return a late retained inspection after the coordinator closes",async()=>{
 const held=deferred<{candidates:DurableHistoryCandidate[];legacyReceipts:number;unreadableRecords:number}>(),repo={...repository(),inspectRetained:vi.fn(()=>held.promise)},store=createPersistentWorkspaceHistory(repo),inspection=store.inspectRetained!(),failure=expect(inspection).rejects.toThrow("closed");await store.close();held.resolve({candidates:[record()],legacyReceipts:0,unreadableRecords:0});await failure;expect(store.getPending()).toHaveLength(0);
});
