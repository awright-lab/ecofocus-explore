import {isLocalFileCopyCandidate} from "../data/localStudyDuplicate";
import {planRecoveredCopies,type RecoveredCopyMatch,type RecoveredCopyIssue} from "./recoveredCopyModel";
import {useCallback,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {DashboardWorkspace} from '../../../shared/types/dashboard';
import {deferredWorkspaceImports} from './deferredWorkspaceImports';
import {prepareRecoveredImports} from './recoveredImportModel';
import {workspaceSaveSession} from './workspaceSaveSession';
import {WorkspaceBackupButton} from './WorkspaceBackupButton';
import {useRemovedControlFocus} from '../builder/hooks/useRemovedControlFocus';

export function DeferredWorkspaceImportRecovery({workspace,onWorkspaceChange,getWorkspaceRevision}:{
 workspace:DashboardWorkspace|null;onWorkspaceChange:(workspace:DashboardWorkspace)=>number|void;getWorkspaceRevision?:()=>number;
}){
 const pending=useSyncExternalStore(deferredWorkspaceImports.subscribe,deferredWorkspaceImports.getPending);
 const [working,setWorking]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
 const latest=useRef(workspace),mounted=useRef(true),owner=useRef<{token:symbol;workspace:DashboardWorkspace;revision?:number}|null>(null);
 latest.current=workspace;
 const revisionReader=useRef(getWorkspaceRevision);revisionReader.current=getWorkspaceRevision;
 const focus=useRemovedControlFocus();
 type Review={copies:Array<{token:number;signature:string}>;matches:RecoveredCopyMatch[];unverified:RecoveredCopyIssue[];unverifiedCount:number};
 const[review,setReview]=useState<Review|null>(null);
 const trigger=useRef<HTMLButtonElement|null>(null),status=useRef<HTMLParagraphElement|null>(null),reviewPanel=useRef<HTMLElement|null>(null),departing=useRef(false),startOwner=useRef<HTMLElement|null>(null);
 const bindTrigger=useCallback((node:HTMLButtonElement|null)=>{trigger.current=node;focus.controlRef(node);},[focus.controlRef]);
 const bindStatus=useCallback((node:HTMLParagraphElement|null)=>{status.current=node;focus.targetRef(node);},[focus.targetRef]);
 const bindReview=useCallback((node:HTMLElement|null)=>{if(!node&&reviewPanel.current?.contains(document.activeElement))departing.current=true;reviewPanel.current=node;},[]);
 useLayoutEffect(()=>{const previous=startOwner.current;startOwner.current=null;if(previous&&document.activeElement===previous)reviewPanel.current?.focus();if(departing.current){departing.current=false;if(!document.activeElement||document.activeElement===document.body)(trigger.current??status.current)?.focus();}});
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;owner.current=null;};},[]);
 useEffect(()=>{
  if(!pending.length)return;
  const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);
 },[pending.length]);
 async function addStudies(choice?:"reuse"|"separate"|"refresh"){
  if(!latest.current||owner.current)return;
  const token=Symbol('recovered-import-save');
  let next:DashboardWorkspace,captured:ReturnType<typeof deferredWorkspaceImports.capture>,copyPlan:ReturnType<typeof planRecoveredCopies>|undefined;
  try{
   captured=deferredWorkspaceImports.capture();if(!captured.length)return;
   const current=workspaceSaveSession.getPending()??latest.current;
   if(current.id!==latest.current.id)throw Error('The pending save belongs to another workspace. Recovery copies were not rebound.');
   const imports=captured.map(entry=>entry.dataset);
   if(imports.some(isLocalFileCopyCandidate))copyPlan=planRecoveredCopies(current,imports);
   const summary:Review={copies:captured.map(({token,signature})=>({token,signature})),matches:copyPlan?.matches??[],unverified:copyPlan?.unverified??[],unverifiedCount:copyPlan?.unverifiedCount??0};
   if(choice==="reuse"||choice==="separate"){
    if(!review||review.copies.length!==summary.copies.length||review.copies.some((entry,i)=>entry.token!==summary.copies[i].token||entry.signature!==summary.copies[i].signature)||JSON.stringify([review.matches,review.unverified,review.unverifiedCount])!==JSON.stringify([summary.matches,summary.unverified,summary.unverifiedCount]))throw Error('The recovery copies or matching study changed. Refresh the copy review before choosing; no studies were added.');
   }else if(choice==="refresh"||summary.matches.length||summary.unverifiedCount){
    startOwner.current=document.activeElement===trigger.current?trigger.current:null;
    setReview(summary);setError(null);setNotice(null);return;
   }
   if(choice==="reuse")copyPlan=planRecoveredCopies(current,imports,summary.matches.map(m=>m.index));
   next=copyPlan?.next??prepareRecoveredImports(current,imports);
  }catch(problem){setError(problem instanceof Error?problem.message:'Recovery copies could not be checked safely. Keep this tab open and download a backup.');return;}
  const checkedRevision=Boolean(revisionReader.current);
  owner.current={token,workspace:next,revision:revisionReader.current?.()};setReview(null);setWorking(true);setError(null);setNotice(null);latest.current=next;
  const owns=()=>mounted.current&&owner.current?.token===token&&latest.current===next&&Boolean(revisionReader.current)===checkedRevision&&(revisionReader.current===undefined||revisionReader.current()===owner.current.revision);
  try{
   const revision=onWorkspaceChange(next);if(owner.current?.token===token)owner.current.revision=typeof revision==='number'?revision:revisionReader.current?.();
   const saved=await workspaceSaveSession.saveAsync(next);
   if(!owns())return;
   if(!saved){setError('The recovered studies were not confirmed saved. Existing work and import copies are kept. Keep this tab open and retry adding recovered studies when saving is available.');return;}
   // The optimistic candidate can share row references with its UI copy. Verify
   // against the immutable captured text, not a possibly mutated object alias.
   const originalCopies=captured.map(entry=>JSON.parse(entry.signature));
   if(copyPlan)copyPlan.verifyRetained(next);else if(prepareRecoveredImports(next,originalCopies)!==next)throw Error('An acknowledged candidate is missing a recovered study.');
   const removed=deferredWorkspaceImports.acknowledge(captured);
   if(removed===captured.length)setNotice(deferredWorkspaceImports.getPending().length?'Reviewed recovery copies saved in this browser. Additional copies remain below.':'Recovered studies saved in this browser.');
   else setError('The save finished, but a recovery copy changed. Remaining copies are kept for separate review; nothing newer was cleared.');
  }catch{
   // Never replace a newer shared pending save with this older workspace.
   if(owns())setError('The recovered-study save could not be confirmed. Import copies remain available for retry or backup.');
  }finally{if(owner.current?.token===token){owner.current=null;if(mounted.current)setWorking(false);}}
 }
 return <>
  <p ref={bindStatus} tabIndex={-1} role="status" data-canvas-keyboard-scope="controls" hidden={!notice&&!pending.length}>{notice??'Recovery copies remain in this tab.'}</p>
  {pending.length>0&&<aside className="workspace-import-recovery" role="alert" aria-label="Import ready to recover" data-canvas-keyboard-scope="controls">
   <div><strong>Your imported study is ready to recover.</strong><p>An import finished after you left its screen. {pending.map(item=>item.title).join(', ')} is kept in this tab. Keep this tab open until its save is acknowledged. Conflicting identities are kept for review.</p>{error&&<p>{error}</p>}</div>
   {workspace&&review&&<section ref={bindReview} tabIndex={-1} aria-label="Recovered study copy choices">
    <h3>Choose how to keep these recovered studies</h3><p>{review.matches.length} verified identical copies; {review.unverifiedCount} copies could not be checked. Only complete, unprepared local Excel/SPSS studies are compared. Other sources keep their existing recovery checks.</p>
    <p>These are the last checked matches. Your choice rechecks every queued copy and target version. Reuse keeps the matching study's identity; choose separate studies for a distinct wave even when its answers match. Existing report links are not rebound.</p>
    {review.matches.length>0&&<ul>{review.matches.map(match=><li key={match.index}>{match.title} matches {match.targetTitle}, imported {match.targetImportedAt}.</li>)}</ul>}
    {review.unverifiedCount>0&&<><p>Showing {review.unverified.length} of {review.unverifiedCount} unchecked copies. Every unchecked copy will be kept separately; nothing is sampled out of recovery.</p><ul>{review.unverified.map(issue=><li key={issue.index}>{issue.title}: {issue.reason}</li>)}</ul></>}
    <p>Both choices wait for a confirmed workspace save before clearing recovery copies. Copies already retained under their original identity are only acknowledged. Conflicting data under one identity blocks recovery.</p>
    {review.matches.length>0&&<button type="button" onClick={()=>void addStudies("reuse")}>Reuse matching studies and add the rest</button>}
    <button type="button" onClick={()=>void addStudies("separate")}>Keep separate imported studies</button>
    <button type="button" onClick={()=>setReview(null)}>Review recovered copies later</button>
   </section>}
   {workspace?<><button ref={bindTrigger} type="button" aria-disabled={working} aria-expanded={Boolean(review)} onClick={()=>{void addStudies(review?"refresh":undefined);}}>{working?'Saving recovered studies...':review?'Refresh recovered-copy review':'Add recovered studies'}</button><WorkspaceBackupButton getWorkspace={()=>latest.current}/></>:<a href="#/">Return to workspace</a>}
  </aside>}
 </>;
}
