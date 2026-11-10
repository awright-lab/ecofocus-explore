import { expect, it } from "vitest";
import { captureHistoryReceipt, historyCandidateDigest, historyReceiptMatches, type DurableHistoryCandidate } from "../durableHistoryRepository";
const candidate:DurableHistoryCandidate={version:1,id:"receipt-id",workspaceId:"synthetic",snapshotId:"snapshot",capturedAt:"2026-11-06T00:00:00Z",payload:"opaque\ud800\ud801\ufffdtext"};
it("captures a full retained receipt independently from caller mutation",async()=>{
 const receipt={version:2 as const,id:candidate.id,digest:await historyCandidateDigest(candidate),candidate:{...candidate}},copy=captureHistoryReceipt(receipt);receipt.candidate.payload="later mutation";expect(copy).toMatchObject({version:2,candidate});expect(copy).not.toBe(receipt);if(copy.version===2)expect(copy.candidate).not.toBe(receipt.candidate);
});
it("recognizes both legacy and retained receipts without fabricating or upgrading legacy payloads",async()=>{
 const digest=await historyCandidateDigest(candidate),legacy={version:1,id:candidate.id,digest},before=structuredClone(legacy);expect(historyReceiptMatches(legacy,candidate,digest)).toBe(true);expect(captureHistoryReceipt(legacy)).toEqual(legacy);expect(Object.hasOwn(captureHistoryReceipt(legacy),"candidate")).toBe(false);expect(legacy).toEqual(before);expect(historyReceiptMatches({version:2,id:candidate.id,digest,candidate},candidate,digest)).toBe(true);expect(historyReceiptMatches(undefined,candidate,digest)).toBe(false);
});
it.each([{payload:"another payload"},{workspaceId:"another-workspace"},{snapshotId:"another-snapshot"},{capturedAt:"2026-11-07T00:00:00Z"}])("rejects retained content differing from the exact requested operation (%j)",async update=>{
 const digest=await historyCandidateDigest(candidate),receipt={version:2,id:candidate.id,digest,candidate:{...candidate,...update}};expect(()=>historyReceiptMatches(receipt,candidate,digest)).toThrow("different content");
});
it.each([null,{},[],{version:3,id:"id",digest:"a".repeat(64)},{version:1,id:" ",digest:"a".repeat(64)},{version:1,id:"id",digest:"bad"},{version:1,id:"id",digest:"a".repeat(64),extra:true},{version:2,id:"id",digest:"a".repeat(64)},{version:2,id:"id",digest:"a".repeat(64),candidate:null}])("rejects unsupported or damaged receipt envelopes (%j)",value=>{expect(()=>captureHistoryReceipt(value)).toThrow();});
it("rejects mismatched retained IDs and inherited envelope fields",async()=>{
 const digest=await historyCandidateDigest(candidate);expect(()=>captureHistoryReceipt({version:2,id:"different-id",digest,candidate})).toThrow("disagree");expect(()=>captureHistoryReceipt(Object.assign(Object.create({version:1}),{id:candidate.id,digest,extra:true}))).toThrow("damaged");
});
it("rejects an incorrect digest even if the retained payload matches",async()=>{const digest=await historyCandidateDigest(candidate);expect(()=>historyReceiptMatches({version:2,id:candidate.id,digest:"0".repeat(64),candidate},candidate,digest)).toThrow("different content");});
