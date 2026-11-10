import { ReportMappingPanel, MappingCategoryReview } from './ReportMappingPanel';
import { referencedWaveFields, type WaveFieldMapping } from './reportRefreshMapping';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardDraft, ImportedDatasetRecord } from '../../../shared/types/dashboard';
import { useModalAccessibility } from '../builder/hooks/useModalAccessibility';
import { recoveryImportSignature } from '../document/recoveredImportModel';
import { previewReportRefresh, reportRefreshPreviewIsCurrent, type ReportRefreshContext, type ReportRefreshPreview } from './reportRefreshModel';
import './report-refresh.css';

export default function ReportRefresh({draft,studies,onClose,onCreate}:{draft:DashboardDraft;studies:ImportedDatasetRecord[];onClose:()=>void;onCreate:(preview:ReportRefreshPreview)=>Promise<boolean>}) {
  const [target,setTarget]=useState(''),[title,setTitle]=useState(`${draft.title} — new wave`.slice(0,160)),[preview,setPreview]=useState<ReportRefreshPreview|null>(null),[reviewed,setReviewed]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [mappingState,setMappingState]=useState<{binding:string;values:WaveFieldMapping[]}|undefined>();
  const sourceId=draft.pages.flatMap(page=>page.tiles)[0]?.query.sourceIdentity;
  const source=studies.find(study=>sourceId?.kind==='imported' && study.id===sourceId.datasetId), destination=studies.find(study=>study.id===target);
  let mappingBinding='', mappingError='';let fields:ImportedDatasetRecord['fields']=[];
  try {
    mappingBinding=recoveryImportSignature({source,destination,reportId:draft.id,queries:draft.pages.flatMap(page=>page.tiles.map(tile=>tile.query))});
    if(source)fields=referencedWaveFields(draft,source);
    else if(mappingState)mappingError='The source study is unavailable. Restore it and review the original report before mapping.';
  } catch(error) {mappingError=error instanceof Error?error.message:'Mapping sources could not be inspected.';}
  const mappingStale=!!mappingState && (mappingState.binding!==mappingBinding || !!mappingError || !source || !destination);
  const mappings=mappingStale?undefined:mappingState?.values;
  const modal=useRef<HTMLElement|null>(null),flight=useRef(false),controller=useRef<AbortController|null>(null),current=useRef<ReportRefreshContext>({draft,studies});current.current={draft,studies};
  const [portalTarget]=useState(()=>document.fullscreenElement??document.body);
  let binding='';try{binding=recoveryImportSignature(current.current);}catch{binding='unavailable';}
  const currentPreview=!mappingStale && preview && reportRefreshPreviewIsCurrent(current.current,preview)?preview:null;
  function close(){controller.current?.abort();onClose();}
  useModalAccessibility(modal,close);
  useEffect(()=>()=>{controller.current?.abort();},[]);
  useEffect(()=>{if(!currentPreview)setReviewed(false);},[binding,currentPreview]);
  function change(){controller.current?.abort();setPreview(null);setReviewed(false);setMessage('');}
  async function run(){
    if(flight.current)return;
    if(mappingState && (mappingStale || mappingError)){change();setMessage(mappingError || 'The report or mapping sources changed. Reopen the mapping editor and map the current fields and categories before previewing.');return;}
    flight.current=true;const abort=new AbortController();controller.current=abort;setBusy(true);setMessage('');setPreview(null);setReviewed(false);
    try{const result=await previewReportRefresh(current.current,target,title,{signal:abort.signal,getCurrentContext:()=>current.current,mappings});if(!abort.signal.aborted){setPreview(result);}}
    catch(error){if(!abort.signal.aborted)setMessage(error instanceof Error?error.message:'Preview failed. The original report is unchanged.');}
    finally{controller.current=null;flight.current=false;setBusy(false);}
  }
  async function create(){
    if(flight.current||!currentPreview||!reviewed)return;flight.current=true;setBusy(true);setMessage('');
    try{if(!await onCreate(currentPreview))setMessage('The refreshed copy was not acknowledged as saved. Keep this tab open and use Retry save or retry creating the same copy; no second copy will be added.');}
    catch(error){setMessage(error instanceof Error?error.message:'The draft could not be created. Keep this tab open and preserve a backup.');}
    finally{flight.current=false;setBusy(false);}
  }
  return createPortal(<div className="report-refresh-backdrop"><section ref={modal} className="report-refresh-dialog" role="dialog" aria-modal="true" aria-labelledby="report-refresh-title" tabIndex={-1} data-builder-shortcuts="off">
    <header><div><p>Repeat a local report</p><h2 id="report-refresh-title">Refresh with a new study wave</h2></div><button type="button" onClick={close}>Close</button></header>
    <p>Create a separate draft after reviewing every analysis. Existing reports, studies and published versions are retained. This does not publish an online report.</p>
    <p>Supports 1–20 ordinary unweighted analyses from one complete original local study. Applied audiences, derived results, prepared or remote studies, category-bound styling and recorded chart intervals require separate review. The input workspace is limited to 16 MiB of expanded JSON. Matching metadata does not establish that populations or collection methods are comparable.</p>
    <div className="report-refresh-inputs"><label>New study wave<select value={target} disabled={busy} onChange={event=>{change();setTarget(event.target.value);setMappingState(undefined);}}><option value="">Choose an imported study</option>{studies.map(study=><option key={study.id} value={study.id}>{study.title} · {study.rowCount.toLocaleString()} rows</option>)}</select></label><label>New draft name<input value={title} maxLength={160} disabled={busy} onChange={event=>{change();setTitle(event.target.value);}}/></label></div>
    {mappingStale&&<p role="alert">The report or mapping sources changed. Previous mapping selections are stale. Reopen the mapping editor to review the current fields and categories.</p>}
    {mappingError&&<p role="alert">{mappingError}</p>}
    {source&&destination&&!mappingError&&<ReportMappingPanel {...{source,fields,mappings,busy}} target={destination} binding={mappingBinding}
      onEdit={()=>{change();setMappingState(previous=>previous?.binding===mappingBinding?previous:{binding:mappingBinding,values:fields.map(field=>({sourceFieldId:field.id,targetFieldId:'',categories:[]}))});}}
      onUpdate={entry=>{change();setMappingState(previous=>previous?.binding===mappingBinding?{...previous,values:[...previous.values.filter(item=>item.sourceFieldId!==entry.sourceFieldId),entry]}:previous);}}/>}
    <div className="report-refresh-actions"><button type="button" aria-disabled={busy} onClick={()=>void run()}>Preview all analyses</button><button type="button" aria-disabled={!busy||!controller.current} onClick={()=>controller.current?.abort()}>Cancel preview</button></div>
    {busy&&<p role="status">Reviewing or saving the new-wave draft… Individual calculations may briefly occupy this tab.</p>}
    {preview&&!currentPreview&&<p role="status">The source or report changed. Preview again before creating a draft.</p>}
    {message&&<p role="alert">{message}</p>}
    {currentPreview&&<div className="report-refresh-review"><h3>{currentPreview.sourceTitle} → {currentPreview.targetTitle}</h3><p>{currentPreview.analyses.length} analyses · {currentPreview.mappings.length} reviewed field mappings · {currentPreview.linkedClaims} linked text objects will need evidence review in the new draft.</p>
      <details><summary>Review question mappings</summary><ul>{currentPreview.mappings.map(mapping=><li key={mapping.column}>{mapping.label} → {mapping.targetLabel} — {mapping.column}<MappingCategoryReview categories={mapping.categories}/></li>)}</ul></details>
      {currentPreview.analyses.map((analysis,index)=><WaveAnalysisReview key={index} analysis={analysis} index={index}/>)}
      <details><summary>Review retained text and original-wave libraries</summary><p>Written claims, titles and library definitions are retained, not rewritten. Linked evidence remains recorded against its original source and must be reviewed or relinked. Unlinked text cannot be checked automatically.</p>{currentPreview.retainedText.map((text,index)=><p key={index}>{text||'(empty text)'}</p>)}<ul>{currentPreview.retainedLibraryReferences.map((reference,index)=><li key={index}>{reference}: remains bound to its original recorded study.</li>)}</ul></details>
      <label className="report-refresh-confirm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event=>setReviewed(event.target.checked)}/>I reviewed all mappings, result changes, retained claims and libraries, and the question meanings, sampling and populations. Create a draft for further review; do not publish.</label>
    </div>}
    <footer><button type="button" aria-disabled={!currentPreview||!reviewed||busy} onClick={()=>void create()}>Create reviewed draft copy</button></footer>
  </section></div>,portalTarget);
}

function WaveAnalysisReview({analysis,index}:{analysis:ReportRefreshPreview['analyses'][number];index:number}) {
  const [page,setPage]=useState(0),offset=page*50;
  const display=(value:number|null)=>value===null?'Unavailable / absent':value.toLocaleString(undefined,{maximumSignificantDigits:8});
  return <details><summary>{analysis.title} · {analysis.changes.length} cells</summary><p>Absent categories are not zero. Differences are descriptive; no significance or population equivalence is inferred.</p><div className="report-refresh-table"><table><caption>{analysis.title}: old and new recorded values</caption><thead><tr><th>Answer / group</th><th>Before</th><th>After</th><th>Change</th><th>Before n</th><th>After n</th></tr></thead><tbody>{analysis.changes.slice(offset,offset+50).map((cell,i)=><tr key={i}><th scope="row">{cell.label}</th><td>{display(cell.before)}</td><td>{display(cell.after)}</td><td>{cell.before===null||cell.after===null?'Not comparable':Number.isFinite(cell.after-cell.before)?`${display(cell.after-cell.before)} ${cell.unit}`:"Change outside numeric range"}</td><td>{display(cell.beforeBase)}</td><td>{display(cell.afterBase)}</td></tr>)}</tbody></table></div><nav aria-label={`Analysis ${index+1} cell pages`}><button type="button" aria-disabled={page===0} onClick={()=>setPage(value=>Math.max(0,value-1))}>Previous cells</button><span role="status"> Cells {offset+1}–{Math.min(offset+50,analysis.changes.length)} of {analysis.changes.length} </span><button type="button" aria-disabled={offset+50>=analysis.changes.length} onClick={()=>setPage(value=>Math.min(Math.ceil(analysis.changes.length/50)-1,value+1))}>Next cells</button></nav></details>;
}
