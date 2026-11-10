import { expect, it } from "vitest";
import { encodeHistoryRecoveryArchive } from "../historyRecoveryArchive";

// Independent reader for the documented tagged graph; never used to restore.
function read(text: string) {
 const archive=JSON.parse(text), values: unknown[]=[];
 function decode(node: any): any {
  const [type,value]=node;
  if(type==="null") return null;
  if(type==="undefined") return undefined;
  if(type==="string"||type==="boolean")return value;
  if(type==="bigint")return BigInt(value);
  if(type==="number")return typeof value==="number"?value:value==="-0"?-0:value==="NaN"?NaN:value==="Infinity"?Infinity:-Infinity;
  if(type!=="ref")throw Error("Unexpected tag");
  if(Object.hasOwn(values,value))return values[value];
  const stored=archive.nodes[value];
  if(stored[0]==="date")return values[value]=new Date(decode(stored[1]));
  if(stored[0]==="array-buffer")return values[value]=Uint8Array.from(stored[1]).buffer;
  const result=stored[0]==="array"?new Array(stored[1]):{};values[value]=result;
  for(const [key,entry] of stored[stored[0]==="array"?2:1])Object.defineProperty(result,key,{value:decode(entry),enumerable:true,writable:true,configurable:true});
  return result;
 }
 return {archive,records:archive.records.map((entry:any)=>({store:entry.store,key:decode(entry.key),value:decode(entry.value)}))};
}
it("preserves malformed records, receipt keys, opaque UTF16 and explicit unsupported numbers",()=>{
 const value={id:"bad",version:999,payload:"raw\ud800\ud801\ufffd",missing:undefined,nan:NaN,negativeZero:-0,infinite:Infinity,big:12345678901234567890n};
 const records=[{store:"historyCandidates",key:["bad",new Date("2026-11-06T00:00:00Z")],value},{store:"reconciledHistory",key:"orphan",value:{digest:null}}];
 const before=structuredClone(records),text=encodeHistoryRecoveryArchive("synthetic",records),restored=read(text);
 expect(restored.archive).toMatchObject({kind:"ecofocus-history-storage-archive",version:1,encoding:"tagged-graph-v1",databaseName:"synthetic"});
 expect(restored.records).toEqual(before);expect(Object.is(restored.records[0].value.negativeZero,-0)).toBe(true);expect(records).toEqual(before);
});
it("preserves shared references, cycles, sparse arrays, dangerous-looking keys and binary keys",()=>{
 const value:any={};value.self=value;value.items=new Array(3);value.items[2]=value;Object.defineProperty(value,"__proto__",{value:"raw",enumerable:true});
 const key=Uint8Array.from([0,255,42]).buffer,restored=read(encodeHistoryRecoveryArchive("synthetic",[{store:"historyCandidates",key,value}])).records[0];
 expect(restored.value.self).toBe(restored.value);expect(restored.value.items[2]).toBe(restored.value);expect(0 in restored.value.items).toBe(false);expect(restored.value.items.length).toBe(3);
 expect(Object.getOwnPropertyDescriptor(restored.value,"__proto__")?.value).toBe("raw");expect(new Uint8Array(restored.key)).toEqual(new Uint8Array(key));
});
it.each([new Map([["a",1]]),new Set([1]),new Uint8Array([1]),/raw/,()=>1])("refuses unsupported values instead of producing a silently incomplete archive (%s)",value=>{
 expect(()=>encodeHistoryRecoveryArchive("synthetic",[{store:"historyCandidates",key:"bad",value}])).toThrow("unsupported");
});
it("does not invoke accessors",()=>{let invoked=false;const value=Object.defineProperty({},"payload",{enumerable:true,get(){invoked=true;return "not original";}});expect(()=>encodeHistoryRecoveryArchive("synthetic",[{store:"historyCandidates",key:"bad",value}])).toThrow("accessor");expect(invoked).toBe(false);});
it("handles an empty journal without inventing a workspace",()=>{expect(read(encodeHistoryRecoveryArchive("synthetic",[])).records).toEqual([]);});
