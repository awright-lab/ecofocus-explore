import {analysisChangeSettings} from "../../analytics/analysisChangeReview";
import {useCallback,useId,useLayoutEffect,useRef,useState} from "react";
import type {AnalyticsQueryResponse} from "../../../../shared/types/analytics";
import type {DashboardTile,SavedVariableSet} from "../../../../shared/types/dashboard";
import {pendingQueryPreviewSnapshot,runPendingQueryPreview} from "../../analytics/pendingQueryPreview";
import {useInspectorQueryRequest} from "../hooks/useInspectorQueryRequest";
import {useRemovedControlFocus} from "../hooks/useRemovedControlFocus";
import {AnalysisEditPreview} from "./AnalysisEditPreview";

export function PendingTileQueryPreview({tile,savedVariableSets,isLoading,getEditorContextVersion}:{tile:DashboardTile;savedVariableSets:SavedVariableSet[];isLoading:boolean;getEditorContextVersion?:()=>string|number}){
  const latest=useRef({tile,savedVariableSets,isLoading});latest.current={tile,savedVariableSets,isLoading};
  let snapshot:ReturnType<typeof pendingQueryPreviewSnapshot>|undefined,issue:string|undefined;
  try{snapshot=pendingQueryPreviewSnapshot(tile,savedVariableSets);}catch(error){issue=error instanceof Error?error.message:"The pending query cannot be checked safely.";}
  const request=useInspectorQueryRequest(JSON.stringify([snapshot?.key??issue,isLoading]),getEditorContextVersion);
  const[preview,setPreview]=useState<{key:string;before:AnalyticsQueryResponse;after:AnalyticsQueryResponse;current:()=>boolean}|null>(null);
  const[notice,setNotice]=useState<string|null>(null),id=useId();
  const group=useRef<HTMLElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null),panel=useRef<HTMLDivElement|null>(null),departing=useRef(false);
  const focus=useRemovedControlFocus();
  const flight=useRef<{token:symbol;current:()=>boolean}|null>(null);
  const bindTrigger=useCallback((node:HTMLButtonElement|null)=>{trigger.current=node;},[]);
  const bindGroup=useCallback((node:HTMLElement|null)=>{group.current=node;focus.targetRef(node);},[focus.targetRef]);
  const bindPanel=useCallback((node:HTMLDivElement|null)=>{if(!node&&panel.current?.contains(document.activeElement))departing.current=true;panel.current=node;},[]);
  useLayoutEffect(()=>{if(!departing.current)return;departing.current=false;if(!document.activeElement||document.activeElement===document.body)(trigger.current&&!trigger.current.disabled?trigger.current:group.current)?.focus();});
  const onDialogUnmount=useCallback((owned:boolean)=>{
    if(!owned||panel.current?.isConnected||!group.current?.isConnected||document.activeElement&&document.activeElement!==document.body)return;
    (trigger.current&&!trigger.current.disabled?trigger.current:group.current)?.focus();
  },[]);
  const active=preview&&preview.key===snapshot?.key&&preview.current()&&!isLoading?preview:null;
  async function run(){
    if(!snapshot||isLoading||request.busy||flight.current?.current())return;
    const captured=snapshot;
    try{if(pendingQueryPreviewSnapshot(latest.current.tile,latest.current.savedVariableSets).key!==captured.key){setNotice("The query data changed. Review the current settings before requesting a fresh preview.");return;}}
    catch{setNotice("The recorded query data cannot be checked safely. No preview query was sent.");return;}
    const operation=request.begin();if(!operation)return;
    setPreview(null);setNotice(null);
    const current=()=>{if(!operation.isCurrent()||latest.current.isLoading)return false;try{return pendingQueryPreviewSnapshot(latest.current.tile,latest.current.savedVariableSets).key===captured.key;}catch{return false;}};
    const token=Symbol("pending-query-preview");flight.current={token,current};
    try{const result=await runPendingQueryPreview(captured,operation.signal);if(current())setPreview({key:captured.key,before:captured.before,after:result,current});}
    catch(error){operation.fail(error);}finally{if(flight.current?.token===token)flight.current=null;operation.finish();}
  }
  return <section ref={bindGroup} tabIndex={-1} role="group" aria-label="Pending query preview" data-canvas-keyboard-scope="controls">
    <p>Preview the pending filter, measure or weight before replacing the current result. This runs one query through the same source route and saved-row rules as Refresh analysis. Refresh runs a fresh query; results and the configured server provider can change between requests.</p>
    {issue&&<p role="status">{issue}</p>}
    <button ref={bindTrigger} type="button" className="secondary" aria-disabled={!!issue||isLoading||request.busy} aria-expanded={!!active} aria-controls={id} onClick={()=>void run()}>{request.busy?"Loading query preview...":"Preview pending query"}</button>
    {request.busy&&<><p role="status">Loading preview. The current result has not been replaced.</p><button ref={focus.controlRef} type="button" onClick={()=>{request.invalidate();setPreview(null);setNotice("Query preview canceled. No result from it was applied.");}}>Cancel query preview</button></>}
    {request.error&&<p role="alert">{request.error}</p>}{notice&&<p role="status">{notice}</p>}
    {preview&&!active&&!request.busy&&<p role="status">The query preview is out of date. Request a fresh preview of the current settings.</p>}
    {active&&<div ref={bindPanel} id={id}><p>Current weight: {analysisChangeSettings(active.before).Weight}. Proposed weight: {analysisChangeSettings(active.after).Weight}.</p><AnalysisEditPreview before={active.before} after={active.after} onDismiss={()=>setPreview(null)} applyActionLabel="Refresh analysis" onDialogUnmount={onDialogUnmount}/></div>}
  </section>;
}
