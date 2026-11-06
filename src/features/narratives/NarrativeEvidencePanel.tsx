import { useId, useMemo, useState } from "react";
import type { DashboardCanvasElement, DashboardPage } from "../../../shared/types/dashboard";
import { captureNarrativeCell, narrativeEvidenceIssue, narrativeState, reviewNarrative } from "./narrativeEvidence";
import "./narrativeEvidence.css";

export function NarrativeEvidencePanel({element,pages,onUpdate,onNavigate}: {
  element: DashboardCanvasElement;
  pages: DashboardPage[];
  onUpdate: (updates: Partial<DashboardCanvasElement>)=>void;
  onNavigate?: (tileId: string)=>void;
}) {
  const prefix=useId(), sources=useMemo(()=>pages.flatMap(page=>page.tiles.map(tile=>({page,tile}))),[pages]);
  const [tileId,setTileId]=useState(sources[0]?.tile.id??""),[rowId,setRowId]=useState(""),[columnId,setColumnId]=useState("");
  const [rowSearch,setRowSearch]=useState(""),[columnSearch,setColumnSearch]=useState(""),[message,setMessage]=useState("");
  const source=sources.find(item=>item.tile.id===tileId), result=source?.tile.result;
  const row=result?.table.find(row=>row.optionId===rowId)??(rowId?undefined:result?.table[0]);
  const column=result?.columns.find(column=>column.id===columnId)??(columnId?undefined:result?.columns[0]);
  const state=narrativeState(element,pages), issue=element.evidence!==undefined?narrativeEvidenceIssue(element.evidence):null;
  const links=issue?[]:element.evidence?.links??[];
  const matchingRows=(result?.table??[]).filter(item=>item.label.toLocaleLowerCase().includes(rowSearch.trim().toLocaleLowerCase()));
  const rows=matchingRows.slice(0,200);if(row&&!rows.some(item=>item.optionId===row.optionId))rows.push(row);
  const matchingColumns=(result?.columns??[]).filter(item=>item.label.toLocaleLowerCase().includes(columnSearch.trim().toLocaleLowerCase()));
  const columns=matchingColumns.slice(0,200);if(column&&!columns.some(item=>item.id===column.id))columns.push(column);
  let selectedIssue: string|null=null;
  try { if (!row||!column) throw new Error("Choose an available source cell.");captureNarrativeCell(pages,{tileId,rowId:row.optionId,columnId:column.id}); }
  catch(error) { selectedIssue=error instanceof Error?error.message:"This source cannot be checked."; }
  function add() {
    if (!row||!column||issue) return;
    try { onUpdate({evidence:reviewNarrative(element,pages,[...links,{tileId,rowId:row.optionId,columnId:column.id}])});setMessage("Evidence linked to this text. All linked cells were reviewed against the current written claim; the claim itself was kept."); }
    catch(error) { setMessage(error instanceof Error?error.message:"The evidence could not be linked; existing text and links were kept."); }
  }
  function review() {
    try { onUpdate({evidence:reviewNarrative(element,pages,links)});setMessage("Review recorded against the current text and linked results. The claim was not rewritten or independently validated."); }
    catch(error) { setMessage(error instanceof Error?error.message:"The current links could not be reviewed; the previous evidence was kept."); }
  }
  return <section className="narrative-evidence-panel" data-canvas-keyboard-scope="controls" aria-label="Evidence for this text">
    <h2>Evidence for this text</h2>
    <p>Link every result your claim depends on. Links track recorded numbers and context; they do not establish that a conclusion is true or authenticate its source.</p>
    {state&&<div role="status" className={state.current?"narrative-current":"narrative-warning"}><strong>{state.current?"Linked evidence unchanged":"Evidence needs review"}</strong>{state.reasons.map(reason=><p key={reason}>{reason}</p>)}</div>}
    {links.length>0&&<><p>Reviewed {element.evidence!.reviewedAt}. Current scope: {links.length} linked cell{links.length===1?"":"s"}.</p>
      <button type="button" onClick={review}>I reviewed the claim and current linked results</button>
      <ul>{links.map((link,index)=>{
        let current;let error="";try{current=captureNarrativeCell(pages,link).snapshot;}catch(value){error=value instanceof Error?value.message:"Source unavailable";}
        return <li key={JSON.stringify([link.tileId,link.rowId,link.columnId])}>
          <strong>{link.snapshot.tileTitle} / {link.snapshot.rowLabel} / {link.snapshot.columnLabel}</strong>
          <p>At review: {link.snapshot.displayValue}; recorded base {link.snapshot.base}. {current?`Now: ${current.displayValue}; recorded base ${current.base}.`:error}</p>
          {onNavigate&&<button type="button" disabled={!sources.some(item=>item.tile.id===link.tileId)} onClick={()=>onNavigate(link.tileId)}>Open source {index+1}</button>}
          <button type="button" onClick={()=>{onUpdate({evidence:links.length===1?undefined:{...element.evidence!,links:links.filter((_,n)=>n!==index)}});setMessage("Link removed. Text was kept. Unlinked results no longer trigger review; Undo restores the link.");}}>Remove evidence link {index+1}</button>
          <details><summary>Recorded analysis context {index+1}</summary><p>{link.snapshot.pageTitle} / {link.snapshot.tileTitle}</p><pre>{link.snapshot.context}</pre></details>
        </li>;
      })}</ul></>}
    <details><summary>Link another result cell</summary>
      <label htmlFor={`${prefix}-source`}>Source analysis<select id={`${prefix}-source`} value={tileId} onChange={event=>{setTileId(event.target.value);setRowId("");setColumnId("");setRowSearch("");setColumnSearch("");setMessage("");}}><option value="">Choose an analysis</option>{sources.map(({page,tile})=><option key={`${page.id}:${tile.id}`} value={tile.id}>{page.title} — {tile.title||tile.name}</option>)}</select></label>
      {(result?.table.length??0)>20&&<label>Find evidence row<input value={rowSearch} onChange={event=>setRowSearch(event.target.value)}/></label>}
      <label htmlFor={`${prefix}-row`}>Evidence row<select id={`${prefix}-row`} value={row?.optionId??""} onChange={event=>setRowId(event.target.value)}><option value="">Choose a row</option>{rows.map(item=><option key={item.optionId} value={item.optionId}>{item.label||"Unnamed row"} (row {(result?.table.indexOf(item)??0)+1})</option>)}</select></label>
      {matchingRows.length>200&&<p>Showing the first 200 matching rows; search to find others. The current selection is retained.</p>}
      {(result?.columns.length??0)>20&&<label>Find evidence column<input value={columnSearch} onChange={event=>setColumnSearch(event.target.value)}/></label>}
      <label htmlFor={`${prefix}-column`}>Evidence column<select id={`${prefix}-column`} value={column?.id??""} onChange={event=>setColumnId(event.target.value)}><option value="">Choose a column</option>{columns.map(item=><option key={item.id} value={item.id}>{item.label||"Unnamed column"} (column {(result?.columns.indexOf(item)??0)+1})</option>)}</select></label>
      {matchingColumns.length>200&&<p>Showing the first 200 matching columns; search to find others. The current selection is retained.</p>}
      {selectedIssue&&<p role="status">{selectedIssue}</p>}
      <button type="button" disabled={Boolean(issue||selectedIssue)||links.length>=12||!element.content.trim()} onClick={add}>Link cell and record review</button>
      <p>Up to 12 cells per text object. Adding a link also records your review of all its existing links and current text. Recorded citations appear with the text and in formatted exports; enlarge the text object if needed.</p>
    </details>
    {message&&<p role="status">{message}</p>}
  </section>;
}
