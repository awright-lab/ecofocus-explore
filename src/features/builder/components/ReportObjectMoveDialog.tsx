import { useEffect,useId,useLayoutEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardDraft } from '../../../../shared/types/dashboard';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { inspectReportObjectMove,type ReportObjectMoveBinding } from './reportObjectMove';
import './report-object-move.css';
export function ReportObjectMoveDialog({report,binding,isContextCurrent,onClose,onApply,returnFocus}:{report:DashboardDraft;binding:ReportObjectMoveBinding;isContextCurrent:()=>boolean;onClose:()=>void;onApply:(targetId:string,reviewKey:string,reviewed:boolean)=>boolean;returnFocus?:HTMLElement}){
 const modal=useRef<HTMLElement|null>(null),restore=useRef(true),applying=useRef(false),preview=useRef<HTMLDivElement|null>(null),closeButton=useRef<HTMLButtonElement|null>(null),displaced=useRef<HTMLElement|null>(null),title=useId(),help=useId();
 function close(){restore.current=!!modal.current?.contains(document.activeElement);onClose();}
 const origin=useRef(document.activeElement instanceof HTMLElement?document.activeElement:null);
 useModalAccessibility(modal,close,()=>false);
 useEffect(()=>{const element=modal.current;
  const focusIn=(event:FocusEvent)=>{if(event.target instanceof Node&&!element?.contains(event.target))restore.current=false;};
  const focusOut=(event:FocusEvent)=>{if(event.relatedTarget===null&&event.target instanceof HTMLElement&&event.target.isConnected&&element?.contains(event.target))restore.current=false;};
  document.addEventListener('focusin',focusIn,true);document.addEventListener('focusout',focusOut,true);
  return()=>{document.removeEventListener('focusin',focusIn,true);document.removeEventListener('focusout',focusOut,true);const active=document.activeElement;
   if(!restore.current||(active&&active!==document.body&&active!==document.documentElement&&!element?.contains(active)))return;
   const target=returnFocus?.isConnected?returnFocus:origin.current?.isConnected?origin.current:null;target?.focus();
  };
 },[returnFocus]);
 const[portalTarget]=useState(()=>document.fullscreenElement??document.body);
 const orderedPages=[...report.pages].sort((a,b)=>a.order-b.order);
 const[targetId,setTargetId]=useState(()=>orderedPages.find(page=>page.id!==binding.page.id)?.id??''),[reviewedKey,setReviewedKey]=useState<string|null>(null),[issue,setIssue]=useState('');
 let info:ReturnType<typeof inspectReportObjectMove>|null=null,unavailable='';try{if(!isContextCurrent())throw Error('The editor context changed. Close this review and reopen Move to page.');info=inspectReportObjectMove(report,binding,targetId);}catch(error){unavailable=error instanceof Error?error.message:'This move cannot be reviewed safely.';}
 const reviewed=!!info&&reviewedKey===info.reviewKey,blocked=!info||info.reviewRequired&&!reviewed;
 if ((!info||!info.reviewRequired) && document.activeElement instanceof HTMLElement && preview.current?.contains(document.activeElement)) displaced.current=document.activeElement;
 useLayoutEffect(()=>{const owner=displaced.current;displaced.current=null;if(owner&&!owner.isConnected&&(!document.activeElement||document.activeElement===document.body||document.activeElement===owner))closeButton.current?.focus();});
 function apply(){if(applying.current||blocked||!info)return;if(!isContextCurrent()){setIssue('The editor context changed. Nothing was moved; close and reopen this review.');return;}applying.current=true;setIssue('');try{restore.current=!!modal.current?.contains(document.activeElement);if(onApply(targetId,info.reviewKey,reviewed))onClose();else{setIssue('The move was not accepted. Check the current report and reopen this review.');}}catch{setIssue('The move could not be confirmed. Check both pages before trying again.');}finally{applying.current=false;}}
 return createPortal(<div className="report-object-move-backdrop" data-canvas-keyboard-scope="controls" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}>
  <section ref={modal} role="dialog" aria-modal="true" aria-labelledby={title} aria-describedby={help} tabIndex={-1} className="report-object-move-dialog">
   <header><h2 id={title}>Move object to another page</h2><button ref={closeButton} type="button" onClick={close}>Close move review</button></header>
   <p id={help}>Move one selected object without changing its ID, analysis, content, box position, size or layer value. Related objects stay on their current pages. Undo restores the move. The destination opens after the move; saving uses the existing workspace save controls.</p>
   <p><strong>Selected:</strong> {binding.item.name||'Untitled object'} · page {binding.page.order}: {binding.page.title}</p>
   <label>Destination page<select value={targetId} onChange={event=>{setTargetId(event.target.value);setReviewedKey(null);setIssue('');}}>{orderedPages.filter(page=>page.id!==binding.page.id).map(page=><option key={page.id} value={page.id}>Page {page.order}: {page.title}</option>)}</select></label>
   {report.pages.length<2&&<p>Add another report page first, then reopen this review.</p>}
   {unavailable&&<p role="alert">{unavailable}</p>}
   {info&&<div ref={preview} className="report-object-move-preview" aria-label="Destination move review"><p>Position kept: X {info.item.layout.x}, Y {info.item.layout.y}; {info.item.layout.width} x {info.item.layout.height}. No existing object will be deleted or repositioned.</p>
    <p>{info.overlaps.length?`Possible box overlap with ${info.overlaps.length} destination object${info.overlaps.length===1?'':'s'}, including hidden objects.`:'No declared box overlap found.'} Visual effects and text overflow are not measured.</p>
    {info.offPage&&<p>The box may extend beyond the page. Its current coordinates will be kept.</p>}{info.uncertain&&<p>Some destination geometry could not be checked. Review the destination manually.</p>}
    {info.reviewRequired&&<label><input type="checkbox" checked={reviewed} onChange={event=>setReviewedKey(event.target.checked?info.reviewKey:null)}/> I reviewed the possible overlap or off-page placement.</label>}
   </div>}
   {issue&&<p role="alert">{issue}</p>}
   <footer><button type="button" onClick={close}>Cancel move</button><button type="button" aria-disabled={blocked} onClick={apply}>Move object</button></footer>
  </section>
 </div>,portalTarget);
}
