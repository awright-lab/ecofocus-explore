import { useEffect,useMemo,useRef,useState } from "react";
import { createPortal } from "react-dom";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";
import type { DashboardTile,ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import type { SavedImportedAudience } from "../../../../shared/types/audience";
import { runMockAnalyticsQuery } from "../../../../shared/mock/analytics";
import { analyticalCell } from "../../../../shared/analytics/resultCells";
import { findingFollowUps,followUpPreviewRows } from "../../analytics/findingFollowUps";
import { researchSearchMatcher } from "../../data/researchSearch";
import { runSavedImportedQuery } from "../../data/savedImportedQuery";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import "./researchQuestionCatalog.css";
import "./findingFollowUps.css";

export type CreateFindingFollowUp = (tileId:string,rowId:string,columnId:string,optionId:string,isCurrent:()=>boolean)=>Promise<string|null>;
type Props={tile:DashboardTile;studies:ImportedDatasetRecord[];audiences?:SavedImportedAudience[];onCreate:CreateFindingFollowUp;isLoading?:boolean};
export default function FindingFollowUps(props:Props){
 const[open,setOpen]=useState(false);
 useEffect(()=>setOpen(false),[props.tile.result]);
 return <div className="finding-followups-entry"><button type="button" onClick={()=>setOpen(true)}>Investigate a finding</button><p>Explore a recorded answer across groups, audiences or supported sample waves.</p>{open&&<FindingFollowUpDialog {...props} onClose={()=>setOpen(false)}/>}</div>;
}
function FindingFollowUpDialog({tile,studies,audiences=[],onCreate,isLoading,onClose}:Props&{onClose:()=>void}){
 const modal=useRef<HTMLElement|null>(null),active=useRef(true),request=useRef(0),latest=useRef("");
 useModalAccessibility(modal,onClose);
 useEffect(()=>{active.current=true;return()=>{active.current=false;request.current+=1;};},[]);
 const[rowId,setRowId]=useState(tile.result.table[0]?.optionId??""),[columnId,setColumnId]=useState(tile.result.columns[0]?.id??""),[choice,setChoice]=useState(""),[search,setSearch]=useState("");
 const[rowSearch,setRowSearch]=useState(""),[columnSearch,setColumnSearch]=useState("");
 const rowLabels=new Map<string,number>(),columnLabels=new Map<string,number>();
 tile.result.table.forEach(row=>rowLabels.set(row.label,(rowLabels.get(row.label)??0)+1));
 tile.result.columns.forEach(column=>columnLabels.set(column.label,(columnLabels.get(column.label)??0)+1));
 const rowPositions=new Map(tile.result.table.map((row,index)=>[row.optionId,index+1])),columnPositions=new Map(tile.result.columns.map((column,index)=>[column.id,index+1]));
 const matchesRow=researchSearchMatcher(rowSearch),matchesColumn=researchSearchMatcher(columnSearch);
 const matchedRows=tile.result.table.filter(row=>matchesRow([row.label])),shownRows=matchedRows.slice(0,200),currentRow=tile.result.table.find(row=>row.optionId===rowId);
 if(currentRow&&!shownRows.includes(currentRow))shownRows.push(currentRow);
 const matchedColumns=tile.result.columns.filter(column=>matchesColumn([column.label])),shownColumns=matchedColumns.slice(0,200),currentColumn=tile.result.columns.find(column=>column.id===columnId);
 if(currentColumn&&!shownColumns.includes(currentColumn))shownColumns.push(currentColumn);
 const[busy,setBusy]=useState<"preview"|"create"|null>(null),[error,setError]=useState(""),[preview,setPreview]=useState<{key:string;result:AnalyticsQueryResponse}|null>(null);
 const model=useMemo(()=>findingFollowUps(tile,rowId,columnId,studies,audiences),[tile,rowId,columnId,studies,audiences]);
 const matches=researchSearchMatcher(search),options=model.options.filter(option=>matches([option.question,option.change])),visible=options.slice(0,12),plan=model.options.find(option=>option.id===choice)??null;
 const key=plan?JSON.stringify([rowId,columnId,model.finding,plan.query]):"";latest.current=key;
 const shownPreview=preview?.key===key?preview.result:null;
 const previewRows=shownPreview?followUpPreviewRows(tile,rowId,shownPreview):null;
 function dismiss(){active.current=false;request.current+=1;onClose();}
 function changeFinding(action:()=>void){request.current+=1;setBusy(null);setChoice("");setPreview(null);setError("");action();}
 async function runPreview(){
  if(!plan)return;const token=++request.current,captured=key;setBusy("preview");setError("");
  try{const result=plan.query.sourceIdentity?.kind==="imported"?await runSavedImportedQuery(plan.query,studies):runMockAnalyticsQuery(plan.query);if(active.current&&token===request.current&&latest.current===captured)setPreview({key:captured,result});}
  catch(error){if(active.current&&token===request.current)setError(error instanceof Error?error.message:"The follow-up preview failed. The original is unchanged.");}
  finally{if(active.current&&token===request.current)setBusy(null);}
 }
 async function create(){
  if(!plan||!shownPreview)return;const token=++request.current,captured=key;setBusy("create");setError("");
  const isCurrent=()=>active.current&&token===request.current&&latest.current===captured;
  try{const id=await onCreate(tile.id,rowId,columnId,plan.id,isCurrent);if(isCurrent()){if(id)dismiss();else setError("The follow-up was not created. Your original analysis is unchanged. Close this dialog to review workspace status and retry.");}}
  catch(error){if(isCurrent())setError(error instanceof Error?error.message:"The follow-up could not be created. The original is unchanged.");}
  finally{if(isCurrent())setBusy(null);}
 }
 return createPortal(<div className="research-catalog-backdrop" onClick={event=>{if(event.target===event.currentTarget)dismiss();}}><section className="research-catalog finding-followups-dialog" ref={modal} role="dialog" aria-modal="true" aria-labelledby="followups-title" tabIndex={-1}>
  <header><div><span className="research-catalog-eyebrow">Investigate, then conclude</span><h2 id="followups-title">Where does this finding lead?</h2><p>Choose a recorded finding and review a follow-up before creating a separate analysis.</p></div><button type="button" aria-label="Close follow-up questions" onClick={dismiss}>Close</button></header>
  <div className="research-catalog-filters"><label>Recorded answer{tile.result.table.length>200&&<input aria-label="Find recorded answer" value={rowSearch} onChange={event=>setRowSearch(event.target.value)}/>}<select value={rowId} onChange={event=>changeFinding(()=>setRowId(event.target.value))}>{shownRows.map((row,index)=><option key={row.optionId+index} value={row.optionId}>{!row.label.trim()||rowLabels.get(row.label)!>1?`${row.label||"Unnamed answer"} (row ${rowPositions.get(row.optionId)})`:row.label}</option>)}</select>{matchedRows.length>200&&<small>First 200 matches; search to narrow.</small>}</label><label>Recorded group{tile.result.columns.length>200&&<input aria-label="Find recorded group" value={columnSearch} onChange={event=>setColumnSearch(event.target.value)}/>}<select value={columnId} onChange={event=>changeFinding(()=>setColumnId(event.target.value))}>{shownColumns.map((column,index)=><option key={column.id+index} value={column.id}>{!column.label.trim()||columnLabels.get(column.label)!>1?`${column.label||"Unnamed group"} (column ${columnPositions.get(column.id)})`:column.label}</option>)}</select>{matchedColumns.length>200&&<small>First 200 matches; search to narrow.</small>}</label><label>Find a follow-up<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="e.g. generation or an audience"/></label></div>
  <div className="research-catalog-body"><div className="research-catalog-results"><h3>{model.finding||"Choose a reliable finding"}</h3><p>{model.sourceLabel}</p>{model.unavailable&&<p role="status">{model.unavailable}</p>}<ul aria-label="Suggested follow-up questions">{visible.map(option=><li key={option.id}><button type="button" className={choice===option.id?"selected":""} aria-pressed={choice===option.id} onClick={()=>{request.current+=1;setChoice(option.id);setPreview(null);setBusy(null);setError("");}}><strong>{option.question}</strong><span>{option.change}</span></button></li>)}</ul>{options.length>12&&<p>Showing 12 of {options.length} follow-ups. Search to find another grouping or audience.</p>}{!options.length&&!model.unavailable&&<p>No follow-ups match. Clear the search to see available questions.</p>}{model.notices.map(note=><p className="finding-followups-note" key={note}>{note}</p>)}</div>
  <aside className="research-catalog-detail" aria-label="Follow-up analysis plan">{plan?<><span className="research-catalog-eyebrow">Review the plan</span><h3>{plan.question}</h3><p>{plan.rationale}</p><h4>What changes</h4><p>{plan.change}</p><h4>What stays</h4><ul>{model.kept.filter(fact=>!plan.id.startsWith("audience:")||!fact.startsWith("Audience:")).map(fact=><li key={fact}>{fact}</li>)}</ul><p>Creates a new page. Existing analyses and their saved values are preserved.</p><button type="button" onClick={()=>void runPreview()} disabled={!!busy||isLoading}>{busy==="preview"?"Calculating preview…":"Preview follow-up"}</button>{shownPreview&&<section aria-label="Follow-up result preview"><h4>Result preview</h4><div className="finding-followups-table"><table><thead><tr><th>Answer</th>{shownPreview.columns.slice(0,4).map(column=><th key={column.id}>{column.label}</th>)}</tr></thead><tbody>{previewRows!.rows.map(row=><tr key={row.optionId} className={row===previewRows!.selected?"finding-followups-selected-row":""}><th>{row.label}</th>{shownPreview.columns.slice(0,4).map(column=>{const cell=analyticalCell(shownPreview,row,column.id);return <td key={column.id}>{cell.value===null?"Unavailable":`${cell.value}${shownPreview.metric.valueFormat==="percent"?"%":""}`}<small>Recorded base {row.bases[column.id]}</small></td>;})}</tr>)}</tbody></table></div><small>Up to eight answers and four groups shown, including the selected answer when available. The created analysis retains the complete result.</small>{previewRows?.selectionIssue&&<p role="status">{previewRows.selectionIssue}</p>}{shownPreview.warnings.length>0&&<ul aria-label="Follow-up data quality notices">{shownPreview.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul>}</section>}<button type="button" className="research-catalog-create" disabled={!shownPreview||!!busy||isLoading} onClick={()=>void create()}>{busy==="create"?"Creating follow-up…":"Create follow-up on a new page"}</button>{error&&<p role="alert">{error}</p>}</>:<div className="research-catalog-empty"><h3>Follow the evidence</h3><p>Select a question to inspect what changes and what stays. Preview it before creating a new analysis.</p></div>}</aside></div>
 </section></div>,document.body);
}
