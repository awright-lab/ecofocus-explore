import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardDraft } from '../../../shared/types/dashboard';
import { checkEmbeddedImages, imageInventory, sameImageInventory, type ImageCheckResult, type ImageInventory } from './embeddedImageCheck';

export function EmbeddedImageReview({dashboard}:{dashboard:DashboardDraft}) {
  const latest=useRef(dashboard);latest.current=dashboard;
  const checkButton=useRef<HTMLButtonElement|null>(null);
  const cancelButton=useRef<HTMLButtonElement|null>(null);
  const ownCancelButton=useCallback((node:HTMLButtonElement|null)=>{
    // Ref detachment precedes removal: restore only focus owned by the
    // disappearing control. Reading elsewhere must not move the user's focus.
    if(!node&&cancelButton.current&&document.activeElement===cancelButton.current)checkButton.current?.focus();
    cancelButton.current=node;
  },[]);
  const run=useRef<{controller:AbortController;inventory:ImageInventory}|null>(null),epoch=useRef(0);
  const[result,setResult]=useState<{inventory:ImageInventory;checks:ImageCheckResult[]}|null>(null);
  const[progress,setProgress]=useState<{done:number;total:number}|null>(null),[message,setMessage]=useState('');
  const inventory=imageInventory(dashboard),current=result&&sameImageInventory(result.inventory,inventory);
  useEffect(()=>()=>{epoch.current++;run.current?.controller.abort();},[]);
  useEffect(()=>{if(run.current&&!run.current.inventory.overflow&&!sameImageInventory(run.current.inventory,inventory)){epoch.current++;run.current.controller.abort();run.current=null;setProgress(null);setMessage('Images changed while checking. Run the image check again.');}});
  async function start(){
    if(run.current)return;
    const token=++epoch.current,controller=new AbortController(),snapshot=imageInventory(latest.current);
    run.current={controller,inventory:snapshot};setResult(null);setMessage('');setProgress({done:0,total:0});
    try{
      const checks=await checkEmbeddedImages(snapshot,{signal:controller.signal,onProgress:(done,total)=>{if(epoch.current===token)setProgress({done,total});}});
      if(epoch.current!==token)return;
      if(!sameImageInventory(snapshot,imageInventory(latest.current))) {setMessage('Images changed while checking. Run the image check again.');return;}
      setResult({inventory:snapshot,checks});
    }catch(error){if(epoch.current===token)setMessage(error instanceof Error?error.message:'Image readiness could not be verified.');}
    finally{if(epoch.current===token){run.current=null;setProgress(null);}}
  }
  function cancel(){epoch.current++;run.current?.controller.abort();run.current=null;setProgress(null);setResult(null);setMessage('Image check canceled. No report data changed.');checkButton.current?.focus();}
  function list(checks:ImageCheckResult[]){return <ul>{checks.map((check,index)=><li key={index}><strong>{check.pageTitle} — {check.name}</strong><p>{check.ready?'Decoded':'Not verified'}: {check.message}</p></li>)}</ul>;}
  return <section aria-label="Embedded image readiness">
    <h3>Check embedded images</h3>
    <p>Check that visible pictures and page backgrounds can decode on this device. External URLs are never requested. Your report stays unchanged.</p>
    <details><summary>Check coverage and limits</summary><p>Limits: 512 placements, 64 distinct images, 8 Mi-characters per image and 32 Mi-characters total; static PNG/JPEG/WebP up to 8,192 pixels per side and 16 million pixels. Images decode one at a time with a five-second timeout each.</p><p>This checks image decoding only. It does not certify final PDF, PowerPoint, Excel, clipping, color or font fidelity.</p></details>
    <button ref={checkButton} type="button" aria-disabled={progress!==null} onClick={()=>void start()}>{result?'Check embedded images again':'Check embedded images now'}</button>
    {progress&&<><p role="status">Checking embedded images: {progress.done} / {progress.total} distinct sources.</p><progress aria-label="Embedded image check progress" value={progress.done} max={progress.total||1}/><button ref={ownCancelButton} type="button" onClick={cancel}>Cancel image check</button></>}
    {message&&<p role="alert">{message}</p>}
    {result&&!current&&<p role="alert">Images changed after this check. The previous results are hidden; check again.</p>}
    {current&&result&&<><p role="status">{result.checks.length===0?'No visible image objects or image backgrounds to check.':`${result.checks.filter(check=>check.ready).length} of ${result.checks.length} image placements decoded; ${result.checks.filter(check=>!check.ready).length} need review.`}</p>
      {list(result.checks.filter(check=>!check.ready))}
      {result.checks.some(check=>check.ready)&&<details><summary>Decoded image placements</summary>{list(result.checks.filter(check=>check.ready))}</details>}
    </>}
  </section>;
}
