import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { AudienceExpression, SavedImportedAudience } from "../../../shared/types/audience";
import type { DashboardDraft, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { useModalAccessibility } from "../builder/hooks/useModalAccessibility";
import { resolveSavedImportedQuery } from "../data/savedImportedQuery";
import { runImportedDatasetQueryForRuntime } from "../data/importedDatasetRuntimeQuery";
import { ImportedSourceColumnAmbiguityError } from "../data/importedRawValue";
import { assertSavedAudiences, audienceCategoryChoices, audienceDefinitionIssue, audienceSourceIssue, compileAudience, previewAudienceAsync, type AudiencePreview } from "./audienceModel";
import "./audienceBuilder.css";
type Change=(update:(current:DashboardDraft)=>DashboardDraft)=>boolean;
function newId(){return `audience_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}
function firstRule(dataset:ImportedDatasetRecord):AudienceExpression {
 const field=dataset.fields.find(field=>field.eligibleForSegment)??dataset.fields[0];
 return {kind:"category",fieldId:field?.id??"",sourceColumn:field?.sourceColumn??"",exclude:false,values:[]};
}
function newExpression(dataset:ImportedDatasetRecord):AudienceExpression{return {kind:"group",match:"all",exclude:false,children:[firstRule(dataset)]};}
export function AudienceControl({dashboard,importedDatasets=dashboard.importedDatasets,selectedTileId,onChange}:{dashboard:DashboardDraft;importedDatasets?:ImportedDatasetRecord[];selectedTileId?:string|null;onChange:Change}) {
 const [open,setOpen]=useState(false);
 return <><button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}>Audiences</button>{open&&<AudienceDialog dashboard={dashboard} importedDatasets={importedDatasets} selectedTileId={selectedTileId} onChange={onChange} onClose={()=>setOpen(false)}/>}</>;
}
function AudienceDialog({dashboard,importedDatasets,selectedTileId,onChange,onClose}:{dashboard:DashboardDraft;importedDatasets:ImportedDatasetRecord[];selectedTileId?:string|null;onChange:Change;onClose:()=>void}) {
 const modal=useRef<HTMLElement|null>(null),title=useId();useModalAccessibility(modal,onClose);
 const tiles=dashboard.pages.flatMap(page=>page.tiles),initialSelected=tiles.find(tile=>tile.id===selectedTileId),source=initialSelected?.query.sourceIdentity;
 const [targetId,setTargetId]=useState(selectedTileId??"");
 const selected=tiles.find(tile=>tile.id===targetId);
 const [datasetId,setDatasetId]=useState(source?.kind==="imported"?source.datasetId:importedDatasets[0]?.id??"");
 const dataset=importedDatasets.find(item=>item.id===datasetId);
 const [importedAt,setImportedAt]=useState(dataset?.importedAt??"");
 const [id,setId]=useState(newId),[name,setName]=useState("New audience"),[expression,setExpression]=useState<AudienceExpression>(()=>dataset?newExpression(dataset):{kind:"group",match:"all",exclude:false,children:[]});
 const [libraryId,setLibraryId]=useState("new"),[message,setMessage]=useState(""),[busy,setBusy]=useState<"preview"|"apply"|null>(null),[progress,setProgress]=useState(0);
 const [preview,setPreview]=useState<{counts:AudiencePreview;dataset:ImportedDatasetRecord;stamp:string}|null>(null);
 const operation=useRef(0),controller=useRef<AbortController|null>(null),latest=useRef({dashboard,selectedTileId,importedDatasets});latest.current={dashboard,selectedTileId,importedDatasets};
 const reportId=useRef(dashboard.id);
 function invalidate(){operation.current++;controller.current?.abort();setBusy(null);setPreview(null);setMessage("");}
 useEffect(()=>()=>{operation.current++;controller.current?.abort();},[]);
 useEffect(()=>{if(dashboard.id!==reportId.current)onClose();},[dashboard.id,onClose]);
 const definition=useMemo<SavedImportedAudience>(()=>({version:1,id,label:name.trim(),datasetId,importedAt,expression}),[id,name,datasetId,importedAt,expression]);
 const stamp=JSON.stringify(definition);
 let issue=audienceSourceIssue(dataset)??audienceDefinitionIssue(definition);
 if(!issue&&dataset){try{compileAudience(definition,dataset);}catch(error){issue=error instanceof Error?error.message:"Review this audience.";}}
 const fresh=Boolean(preview&&preview.dataset===dataset&&preview.stamp===stamp&&!issue);
 const canApply=selected?.query.sourceIdentity?.kind==="imported"&&selected.query.sourceIdentity.datasetId===datasetId;
 function resetStudy(nextId:string){invalidate();setDatasetId(nextId);setId(newId());setLibraryId("new");setName("New audience");const next=importedDatasets.find(item=>item.id===nextId);setImportedAt(next?.importedAt??"");setExpression(next?newExpression(next):{kind:"group",match:"all",exclude:false,children:[]});}
 function loadAudience(nextId:string){
  invalidate();if(nextId==="new"){resetStudy(datasetId);return;}
  const saved=dashboard.savedAudiences?.find(item=>item.id===nextId);if(!saved)return;
  setLibraryId(saved.id);setId(saved.id);setName(saved.label);setDatasetId(saved.datasetId);setImportedAt(saved.importedAt);setExpression(structuredClone(saved.expression));
 }
 async function runPreview(){
  if(!dataset||issue)return;invalidate();const current=operation.current,study=dataset,report=dashboard.id,abort=new AbortController();controller.current=abort;setBusy("preview");setProgress(0);
  try{const counts=await previewAudienceAsync(structuredClone(definition),study,abort.signal,(done,total)=>{if(current===operation.current)setProgress(total?Math.round(done/total*100):100);});
   if(current!==operation.current)return;
   if(latest.current.dashboard.id!==report||latest.current.importedDatasets.find(item=>item.id===study.id)!==study)throw new Error("The report or study changed. Run a fresh audience preview.");
   setPreview({counts,dataset:study,stamp});setMessage("Preview complete. No study rows or analysis results were changed.");
  }catch(error){if(current===operation.current)setMessage(error instanceof Error?error.message:"Preview failed.");}finally{if(current===operation.current)setBusy(null);}
 }
 function withLibrary(current:DashboardDraft,saved:SavedImportedAudience){
  if(current.savedAudiences?.some(item=>item.id!==saved.id&&item.datasetId===saved.datasetId&&item.importedAt===saved.importedAt&&item.label.toLowerCase()===saved.label.toLowerCase()))throw new Error("Another audience in this study already uses that name. Choose a different name; the existing audience was kept.");
  const library=[...(current.savedAudiences??[]).filter(item=>item.id!==saved.id),structuredClone(saved)];assertSavedAudiences(library);return {...current,status:"draft" as const,savedAudiences:library};
 }
 function save(){
  if(!dataset||!fresh)return;
  try{const saved=structuredClone(definition);const changed=onChange(current=>current.id===reportId.current&&latest.current.importedDatasets.find(item=>item.id===dataset.id)===dataset?withLibrary(current,saved):current);
   if(!changed)throw new Error("The report or study changed; no audience was saved. Preview it again.");setLibraryId(saved.id);setMessage("Audience added to the report. Close this dialog to check the editor's save status.");
  }catch(error){setMessage(error instanceof Error?error.message:"Audience save failed.");}
 }
 function removeSaved(){
  if(libraryId==="new")return;
  const removing=libraryId;
  const changed=onChange(current=>current.id===reportId.current&&current.savedAudiences?.some(item=>item.id===removing)?{...current,status:"draft",savedAudiences:current.savedAudiences.filter(item=>item.id!==removing)}:current);
  if(!changed){setMessage("The report or audience library changed; nothing was removed.");return;}
  invalidate();setLibraryId("new");setId(newId());setMessage("Audience removed from the library. Existing analyses retain their recorded rules. Use Undo to restore the library entry.");
 }
 async function apply(){
  if(!dataset||!fresh||!selected||!canApply)return;
  const current=++operation.current,captured=selected,study=dataset,saved=structuredClone(definition),queryStamp=JSON.stringify(captured.query),backgroundSelection=selectedTileId;setBusy("apply");setMessage("");
  try{
   const identity=captured.query.sourceIdentity;if(identity?.kind!=="imported")throw new Error("Select an imported analysis.");
   const query={...captured.query,sourceIdentity:{...identity,audience:saved}};
   const result=await runImportedDatasetQueryForRuntime(resolveSavedImportedQuery(query,importedDatasets));
   if(current!==operation.current)return;
   if(latest.current.selectedTileId!==backgroundSelection)throw new Error("Selection changed. The original analysis has been kept.");
   const changed=onChange(document=>{
    const currentTile=document.pages.flatMap(page=>page.tiles).find(tile=>tile.id===captured.id);
    if(document.id!==reportId.current||latest.current.importedDatasets.find(item=>item.id===study.id)!==study||currentTile?.result!==captured.result||JSON.stringify(currentTile.query)!==queryStamp)return document;
    const next=withLibrary(document,saved);return {...next,pages:next.pages.map(page=>({...page,tiles:page.tiles.map(tile=>tile.id===captured.id?{...tile,query:result.query,result}:tile)}))};
   });
   if(!changed)throw new Error("The report, study or analysis changed. The original result has been kept; preview and apply again.");
   setLibraryId(saved.id);setMessage(`Audience applied to ${captured.title||captured.name}. The report now contains the saved definition and exact result; check the editor's save status.`);
  }catch(error){if(current===operation.current)setMessage(error instanceof Error?error.message:"The audience could not be applied; the current result was kept.");}finally{if(current===operation.current)setBusy(null);}
 }
 return <div className="export-preflight-backdrop"><section className="export-preflight-dialog audience-dialog" role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1} ref={modal} data-canvas-keyboard-scope="controls">
  <header><div><h2 id={title}>Build an audience</h2><p>Combine rules, preview the exact population, then save and reuse it.</p></div><button onClick={onClose}>Close audiences</button></header>
  <div className="audience-sources"><label>Saved audience<select value={libraryId} onChange={event=>loadAudience(event.target.value)}><option value="new">New audience</option>{(dashboard.savedAudiences??[]).map(item=><option key={item.id} value={item.id}>{item.label} — {importedDatasets.find(study=>study.id===item.datasetId)?.title??"Study unavailable"}</option>)}</select></label><label>Study<select value={datasetId} onChange={event=>resetStudy(event.target.value)}><option value="">Choose a study</option>{importedDatasets.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Audience name<input value={name} maxLength={160} onChange={event=>{invalidate();setName(event.target.value);}}/></label></div>
  <label>Apply audience to analysis<select value={targetId} onChange={event=>{operation.current++;controller.current?.abort();setBusy(null);setMessage("");setTargetId(event.target.value);}}><option value="">Save only — choose an analysis to apply</option>{tiles.filter(tile=>tile.query.sourceIdentity?.kind==="imported"&&tile.query.sourceIdentity.datasetId===datasetId).map(tile=><option key={tile.id} value={tile.id}>{dashboard.pages.find(page=>page.tiles.some(item=>item.id===tile.id))?.title} — {tile.title||tile.name}</option>)}</select></label>
  <p>Counts use complete local study data and are unweighted. Blank or invalid numeric values do not become matches through exclusion. Other source codes retain their meaning; exclude them explicitly when required.</p>
  {dataset&&<RuleEditor dataset={dataset} expression={expression} path="1" onChange={next=>{invalidate();setExpression(next);}}/>}
  {issue&&<p role="status" className="audience-issue">{issue}</p>}
  <div className="audience-actions"><button disabled={Boolean(issue)||busy!==null} onClick={()=>void runPreview()}>Preview audience</button>{busy==="preview"&&<button onClick={()=>{invalidate();setMessage("Audience preview cancelled. Existing data and results were kept.");}}>Cancel preview</button>}<button disabled={!fresh||busy!==null} onClick={save}>Save audience</button>{libraryId!=="new"&&<button disabled={busy!==null} onClick={removeSaved}>Remove from library</button>}<button disabled={!fresh||!canApply||busy!==null} onClick={()=>void apply()}>Save and apply audience</button></div>
  {!canApply&&<p>Choose an imported analysis from this study above to apply this audience. You can also save it for later reuse.</p>}
  {busy==="preview"&&<p role="status">Previewing audience: {progress}%</p>}
  {fresh&&preview&&<div className="audience-preview" aria-label="Audience population preview"><strong>{preview.counts.included.toLocaleString()} matching responses (unweighted n)</strong><p>Complete study: {preview.counts.total.toLocaleString()} rows. Excluded by rules: {preview.counts.excluded.toLocaleString()}. Unknown because required values are blank or invalid: {preview.counts.unknown.toLocaleString()}.</p><p>Analysis cell bases may be smaller when the selected measure is missing.</p></div>}
  {message&&<p role="status">{message}</p>}
 </section></div>;
}
function RuleEditor({dataset,expression,path,onChange,onRemove}:{dataset:ImportedDatasetRecord;expression:AudienceExpression;path:string;onChange:(next:AudienceExpression)=>void;onRemove?:()=>void}) {
 const [search,setSearch]=useState("");
 const field=expression.kind==="group"?undefined:dataset.fields.find(field=>field.id===expression.fieldId&&field.sourceColumn===expression.sourceColumn);
 const choiceResult=useMemo(()=>{try{return {choices:field&&expression.kind==="category"?audienceCategoryChoices(dataset,field):[],issue:null};}catch(error){if(error instanceof ImportedSourceColumnAmbiguityError)return {choices:[],issue:error.message};throw error;}},[dataset,field,expression.kind]);
 const choices=choiceResult.choices;
 if(expression.kind==="group")return <fieldset className="audience-group"><legend>Rule group {path}</legend><div className="audience-group-tools"><label>Match rules in group {path}<select value={expression.match} onChange={event=>onChange({...expression,match:event.target.value as "all"|"any"})}><option value="all">All rules (AND)</option><option value="any">Any rule (OR)</option></select></label><label><input type="checkbox" checked={expression.exclude} onChange={event=>onChange({...expression,exclude:event.target.checked})}/>Exclude matches for group {path}</label>{onRemove&&<button onClick={onRemove}>Remove group {path}</button>}</div>
 {expression.children.map((child,index)=><RuleEditor key={index} dataset={dataset} expression={child} path={`${path}.${index+1}`} onChange={next=>onChange({...expression,children:expression.children.map((item,i)=>i===index?next:item)})} onRemove={()=>onChange({...expression,children:expression.children.filter((_,i)=>i!==index)})}/>)}
 <div className="audience-actions"><button disabled={expression.children.length>=12} onClick={()=>onChange({...expression,children:[...expression.children,firstRule(dataset)]})}>Add rule to group {path}</button><button disabled={path.split(".").length>=6||expression.children.length>=12} onClick={()=>onChange({...expression,children:[...expression.children,newExpression(dataset)]})}>Add nested group to {path}</button></div></fieldset>;
 const fieldReference={fieldId:expression.fieldId,sourceColumn:expression.sourceColumn};
 const visible=choices.filter(choice=>`${choice.value} ${choice.label}`.toLowerCase().includes(search.toLowerCase()));
 const shown=visible.slice(0,200),selected=expression.kind==="category"?expression.values:[];
 const retained=selected.filter(value=>!choices.some(choice=>choice.value===value)).map(value=>({value,label:choiceResult.issue?`${value} (saved value; source unavailable)`:`${value} (no current responses)`}));
 const displayed=[...retained,...choices.filter(choice=>selected.includes(choice.value)&&!shown.some(item=>item.value===choice.value)),...shown];
 function changeKind(kind:"category"|"range"|"blank"){const common={...fieldReference,exclude:expression.exclude};onChange(kind==="category"?{...common,kind,values:[]}:kind==="range"?{...common,kind,min:null,max:null}:{...common,kind});}
 return <fieldset className="audience-rule"><legend>Rule {path}</legend><div className="audience-rule-fields"><label>Field for rule {path}<select value={field?.id??""} onChange={event=>{const next=dataset.fields.find(field=>field.id===event.target.value);if(next){setSearch("");onChange({kind:"category",fieldId:next.id,sourceColumn:next.sourceColumn,exclude:expression.exclude,values:[]});}}}><option value="">Choose a field</option>{dataset.fields.map(field=><option key={field.id} value={field.id}>{field.variableLabel||field.label} ({field.sourceColumn})</option>)}</select></label>
 <label>Condition for rule {path}<select value={expression.kind} onChange={event=>changeKind(event.target.value as "category"|"range"|"blank")}><option value="category">Is one of these values</option><option value="range" disabled={field?.type!=="numeric"&&field?.modelingRole!=="candidate_measure"}>Is between (inclusive)</option><option value="blank">Is blank</option></select></label><label><input type="checkbox" checked={expression.exclude} onChange={event=>onChange({...expression,exclude:event.target.checked})}/>Exclude matches for rule {path}</label>{onRemove&&<button onClick={onRemove}>Remove rule {path}</button>}</div>
 {choiceResult.issue&&<p role="alert">{choiceResult.issue}</p>}
 {expression.kind==="category"&&<div className="audience-values"><label>Search values for rule {path}<input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></label><div role="group" aria-label={`Values for rule ${path}`} className="audience-choice-list">{displayed.map(choice=><label key={choice.value} className={selected.includes(choice.value)?"selected":""}><input type="checkbox" value={choice.value} checked={selected.includes(choice.value)} onChange={event=>onChange({...expression,values:event.target.checked?[...expression.values,choice.value]:expression.values.filter(value=>value!==choice.value)})}/>{choice.label}</label>)}{!displayed.length&&!choiceResult.issue&&<p>No values match this search.</p>}</div><small>{selected.length} values selected. {visible.length>200?`Showing 200 of ${visible.length} matching values; search to find others. Selected values remain visible.`:"Check one or more values to include them in this rule."}</small></div>}
 {expression.kind==="range"&&<div className="audience-range"><label>Minimum for rule {path}<input type="number" step="any" value={expression.min??""} onChange={event=>onChange({...expression,min:event.target.value===""?null:Number(event.target.value)})}/></label><label>Maximum for rule {path}<input type="number" step="any" value={expression.max??""} onChange={event=>onChange({...expression,max:event.target.value===""?null:Number(event.target.value)})}/></label><small>Bounds are inclusive. Leave one bound empty for an open-ended range.</small></div>}
 </fieldset>;
}
