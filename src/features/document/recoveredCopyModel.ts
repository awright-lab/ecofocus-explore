import type {DashboardWorkspace,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import {assertRecoveryImportData,prepareRecoveredImports,recoveryImportSignature,redundantPreview} from './recoveredImportModel';
import {checkLocalStudyDuplicate,isLocalFileCopyCandidate} from '../data/localStudyDuplicate';
export const recoveredCopyLimits={checks:20,displayedIssues:20} as const;
export interface RecoveredCopyMatch {index:number;title:string;targetId:string;targetTitle:string;targetImportedAt:string}
export interface RecoveredCopyIssue {index:number;title:string;reason:string}
export interface RecoveredCopyPlan {next:DashboardWorkspace;matches:RecoveredCopyMatch[];unverified:RecoveredCopyIssue[];unverifiedCount:number;verifyRetained:(candidate:DashboardWorkspace)=>void}

/** Pure choice planning. Existing same-ID, unknown-metadata and reserved-ID
 * recovery rules run first; a different ID never silently rebinds a report. */
export function planRecoveredCopies(workspace:DashboardWorkspace,imports:readonly ImportedDatasetRecord[],reuse:boolean|readonly number[]=false):RecoveredCopyPlan{
 const all=prepareRecoveredImports(workspace,imports);
 const originals=imports.map(recoveryImportSignature);
 const selected=reuse===true?null:new Set(reuse===false?[]:reuse);
 if(selected&&([...selected].some(i=>!Number.isSafeInteger(i)||i<0||i>=imports.length)||Array.isArray(reuse)&&selected.size!==reuse.length))throw Error('The recovered-copy selection is invalid.');
 const skipped:RecoveredCopyMatch[]=[];
 const knownIds=new Set([...workspace.importedDatasets,...workspace.reports.flatMap(r=>r.draft.importedDatasets)].map(d=>d.id));
 const base=prepareRecoveredImports(workspace,imports.filter(d=>knownIds.has(d.id)));
 const pool=[...base.importedDatasets],keep:number[]=[],matches:RecoveredCopyMatch[]=[],unverified:RecoveredCopyIssue[]=[];
 let checks=0,unverifiedCount=0;
 function uncertain(index:number,reason:string){unverifiedCount++;if(unverified.length<recoveredCopyLimits.displayedIssues)unverified.push({index,title:imports[index].title,reason});}
 for(let index=0;index<imports.length;index++){
  const input=imports[index];
  if(!pool.some(d=>d.id===input.id)&&isLocalFileCopyCandidate(input)){
   if(checks++>=recoveredCopyLimits.checks)uncertain(index,'The recovered-copy check reached its 20-study comparison limit. This copy will remain separate.');
   else{
    const checked=checkLocalStudyDuplicate(input,pool);
    if(checked.status==='unverified')uncertain(index,checked.reason);
    if(checked.status==='match'){
     const target=pool.find(d=>d.id===checked.study.id)!;
     let redundant=false;
     try{assertRecoveryImportData([input,target]);redundant=redundantPreview(input)&&redundantPreview(target);}catch{/* Unknown preview/metadata stays separate. */}
     if(!redundant)uncertain(index,'A preview or metadata cannot be verified as redundant with the complete rows. Keep this copy separate.');
     else{const match={index,title:input.title,targetId:target.id,targetTitle:target.title,targetImportedAt:target.importedAt};matches.push(match);if(selected===null||selected.has(index)){skipped.push({...match});continue;}}
    }
   }
  }
  keep.push(index);if(!pool.some(d=>d.id===input.id))pool.push(input);
 }
 if(selected&&[...selected].some(i=>!skipped.some(m=>m.index===i)))throw Error('A selected recovered copy no longer matches its reviewed target.');
 const required=[...keep],approved=skipped.map(m=>({...m}));
 const next=skipped.length?prepareRecoveredImports(base,keep.map(i=>imports[i])):all;
 const verifyRetained=(candidate:DashboardWorkspace)=>{
  const restored=originals.map(text=>JSON.parse(text) as ImportedDatasetRecord);
  if(prepareRecoveredImports(candidate,required.map(i=>restored[i]))!==candidate)throw Error('A recovered copy is missing from the acknowledged workspace.');
  for(const match of approved){
   const targets=candidate.importedDatasets.filter(d=>d.id===match.targetId),input=restored[match.index];
   if(targets.length!==1||targets[0].importedAt!==match.targetImportedAt)throw Error('A reused study version changed before acknowledgement.');
   assertRecoveryImportData([input,targets[0]]);
   const checked=checkLocalStudyDuplicate(input,targets);
   if(checked.status!=='match'||!redundantPreview(input)||!redundantPreview(targets[0]))throw Error('A reused study no longer retains the reviewed source data.');
  }
 };
 return{next,matches:matches.map(m=>({...m})),unverified,unverifiedCount,verifyRetained};
}
