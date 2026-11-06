import { expect, it, vi } from "vitest";
import { createDurableHistoryRepository, historyCandidateDigest, type DurableHistoryCandidate } from "../durableHistoryRepository";
const valid: DurableHistoryCandidate = { version: 1, id: "history-id", workspaceId: "synthetic", snapshotId: "snapshot-id", capturedAt: "2026-11-06T00:00:00Z", payload: "opaque original text" };
it.each([{id:""}, {workspaceId:" "}, {snapshotId:""}, {version:2}, {payload:undefined}, {capturedAt:"not-a-date"}, {extra:"unsupported"}])("rejects unsupported envelopes before opening storage (%j)", async update => {
  const open = vi.fn(), repository = createDurableHistoryRepository("synthetic-history", {open} as unknown as IDBFactory), value = {...valid,...update} as DurableHistoryCandidate;
  await expect(repository.stage(value)).rejects.toThrow("incomplete or unsupported"); await expect(repository.reconcile(value)).rejects.toThrow("incomplete or unsupported"); expect(open).not.toHaveBeenCalled();
});
it("requires a separate namespace and available engine", () => { expect(() => createDurableHistoryRepository("", {} as IDBFactory)).toThrow("namespace"); expect(() => createDurableHistoryRepository("synthetic-history")).toThrow("unavailable"); });
it("does not cache failed opens and closes safely during failure", async () => {
  const open=vi.fn(() => {throw new Error("Synthetic blocked open");}), repository=createDurableHistoryRepository("synthetic-history",{open} as unknown as IDBFactory);
  await expect(repository.inspect()).rejects.toThrow("Synthetic blocked open"); await expect(repository.inspect()).rejects.toThrow("Synthetic blocked open"); expect(open).toHaveBeenCalledTimes(2); await repository.close(); await expect(repository.inspect()).rejects.toThrow("closed");
});
it("captures the caller before asynchronous hashing and distinguishes exact opaque data", async () => {
  const value={...valid}, digest=historyCandidateDigest(value); value.payload="later caller mutation";
  expect(await digest).toBe(await historyCandidateDigest(valid));
  const variants=[valid,{...valid,payload:"\ud800"},{...valid,payload:"\ud801"},{...valid,payload:"\ufffd"},{...valid,snapshotId:"another-snapshot"}];
  expect(new Set(await Promise.all(variants.map(historyCandidateDigest))).size).toBe(variants.length);
});

function archiveEngine(){
 const requests:any[]=[];const tx:any={objectStore:vi.fn((name:string)=>({openCursor(){const request:any={result:null};requests.push({name,request});return request;}}))};
 const db={transaction:vi.fn(()=>tx),close:vi.fn()};const open=vi.fn(()=>{const request:any={result:db};queueMicrotask(()=>request.onsuccess());return request;});
 return {repository:createDurableHistoryRepository("synthetic-export",{open} as unknown as IDBFactory),requests,tx,db};
}
it("exports both raw stores only after the read-only capture transaction completes",async()=>{
 const {repository,requests,tx,db}=archiveEngine();let settled=false;const promise=repository.exportRecoveryArchive().finally(()=>{settled=true;});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();expect(db.transaction).toHaveBeenCalledWith(["historyCandidates","reconciledHistory"],"readonly");expect(requests.map(x=>x.name)).toEqual(["historyCandidates","reconciledHistory"]);
 for(const {name,request} of requests){request.result={key:name+"-raw",value:{id:name+"-raw",payload:"bad\ud800"},continue(){request.result=null;request.onsuccess();}};request.onsuccess();}
 await Promise.resolve();expect(settled).toBe(false);tx.oncomplete();const archive=JSON.parse(await promise);expect(archive.records).toHaveLength(2);expect(archive.nodes.some((node:any)=>JSON.stringify(node).includes("bad\\ud800"))).toBe(true);await repository.close();
});
it("returns no archive when its capture transaction aborts after all records were read",async()=>{
 const {repository,requests,tx}=archiveEngine();const promise=repository.exportRecoveryArchive();const failure=expect(promise).rejects.toThrow("aborted");await Promise.resolve();await Promise.resolve();await Promise.resolve();
 for(const {request}of requests)request.onsuccess();tx.onabort();await failure;await repository.close();
});

it("closes an opening repository without exposing its late database connection",async()=>{
 const db={close:vi.fn()},request:any={result:db},open=vi.fn(()=>request),repo=createDurableHistoryRepository("synthetic-pending-open",{open}as unknown as IDBFactory);
 const inspecting=repo.inspect(),failure=expect(inspecting).rejects.toThrow("canceled"),closing=repo.close();request.onsuccess();await failure;await closing;expect(db.close).toHaveBeenCalledOnce();await expect(repo.inspect()).rejects.toThrow("closed");
});
it("abandons a blocked open, rejects its late success and allows a new opening attempt",async()=>{
 const db={close:vi.fn()},requests:any[]=[],open=vi.fn(()=>{const request:any={result:db};requests.push(request);return request;}),repo=createDurableHistoryRepository("synthetic-blocked",{open}as unknown as IDBFactory);
 const inspecting=repo.inspect(),failure=expect(inspecting).rejects.toThrow("blocks");requests[0].onblocked();await failure;requests[0].onsuccess();expect(db.close).toHaveBeenCalledOnce();const retry=repo.inspect(),closed=expect(retry).rejects.toThrow("canceled"),closing=repo.close();expect(open).toHaveBeenCalledTimes(2);requests[1].onsuccess();await closed;await closing;
});
it("refuses to stage when secure hashing is absent before opening storage",async()=>{
 vi.stubGlobal("crypto",{});try{const open=vi.fn(),repo=createDurableHistoryRepository("synthetic-no-hash",{open}as unknown as IDBFactory);await expect(repo.stage(valid)).rejects.toThrow("Secure hashing");expect(open).not.toHaveBeenCalled();await repo.close();}finally{vi.unstubAllGlobals();}
});
