import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import {assertRecoveryImportData,recoveryImportSignature} from './recoveredImportModel';

export interface CapturedDeferredImport {readonly token:number;readonly dataset:ImportedDatasetRecord;readonly signature:string}
export function createDeferredWorkspaceImports(){
 let sequence=0,entries:Array<{token:number;dataset:ImportedDatasetRecord}>=[];
 let pending:readonly ImportedDatasetRecord[]=Object.freeze([]);
 const listeners=new Set<()=>void>();
 function notify(){pending=Object.freeze(entries.map(entry=>entry.dataset));listeners.forEach(listener=>listener());}
 return{
  getPending:()=>pending,
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  remember(dataset:ImportedDatasetRecord){
   const prior=entries.find(entry=>entry.dataset===dataset);if(prior)return prior.token;
   if(!Number.isSafeInteger(sequence+1))throw Error('The recovery sequence limit was reached. Keep this tab open.');
   const token=++sequence;entries=[...entries,{token,dataset}];notify();return token;
  },
  capture():readonly CapturedDeferredImport[]{
   assertRecoveryImportData(pending);
   return entries.map(entry=>{const signature=JSON.stringify(entry.dataset);return{token:entry.token,dataset:JSON.parse(signature),signature};});
  },
  acknowledge(captured:readonly CapturedDeferredImport[]){
   const wanted=new Map(captured.map(entry=>[entry.token,entry.signature]));let removed=0;
   entries=entries.filter(entry=>{if(!wanted.has(entry.token))return true;try{if(recoveryImportSignature(entry.dataset)!==wanted.get(entry.token))return true;}catch{return true;}removed++;return false;});
   if(removed)notify();return removed;
  },
  clear(){entries=[];notify();}
 };
}
export const deferredWorkspaceImports=createDeferredWorkspaceImports();
