import {useCallback,useMemo,useRef,useState,type ComponentPropsWithoutRef,type RefObject} from 'react';
import type {DashboardTile} from '../../../../shared/types/dashboard';
import {withSafeInference,resultInferenceLabel} from '../../../../shared/analytics/inferenceSafety';
import {analysisSettingsMatch} from '../../../../shared/analytics/queryFreshness';
import {resultWeightingLabel} from '../../../../shared/analytics/weightingLabel';
import {ownAxisLabel} from '../../design-system/axisLabels';
import {buildExecutedColumnComparisonPresentation,getExecutedSignificanceCell} from './analysisSignificancePresentationModel';
import {recordedTableCell,tableExplorerWindow,type TableExplorerSelection} from './tableExplorerModel';
import './complete-table-dialog.css';

type FocusTarget=RefObject<HTMLElement|null>;
function useRemovalFocus(fallback:FocusTarget){
 const previous=useRef<HTMLElement|null>(null);
 return useCallback((node:HTMLElement|null)=>{
  if(!node&&previous.current&&document.activeElement===previous.current)fallback.current?.focus();
  previous.current=node;
 },[fallback]);
}
function FocusButton({fallback,...props}:{fallback:FocusTarget}&ComponentPropsWithoutRef<'button'>){const ref=useRemovalFocus(fallback);return <button {...props} ref={ref}/>;}
function FocusInput({fallback,...props}:{fallback:FocusTarget}&ComponentPropsWithoutRef<'input'>){const ref=useRemovalFocus(fallback);return <input {...props} ref={ref}/>;}
function FocusSelect({fallback,...props}:{fallback:FocusTarget}&ComponentPropsWithoutRef<'select'>){const ref=useRemovalFocus(fallback);return <select {...props} ref={ref}/>;}
function Pager({fallback,owner,kind,page,pages,onPage}:{fallback:FocusTarget;owner:object;kind:string;page:number;pages:number;onPage:(page:number)=>void}){
 const[draft,setDraft]=useState({owner,id:'',issue:''}),{id,issue}=draft.owner===owner?draft:{id:'',issue:''};
 function move(next:number){onPage(Math.min(pages-1,Math.max(0,next)));setDraft({owner,id:'',issue:''});}
 return <div className="complete-table-pager" role="group" aria-label={`${kind} pages`}>
  <FocusButton fallback={fallback} type="button" aria-disabled={page===0} onClick={()=>move(0)}>First {kind}</FocusButton><FocusButton fallback={fallback} type="button" aria-disabled={page===0} onClick={()=>move(page-1)}>Previous {kind}</FocusButton>
  <span>{kind} page {page+1} of {pages}</span><FocusButton fallback={fallback} type="button" aria-disabled={page===pages-1} onClick={()=>move(page+1)}>Next {kind}</FocusButton><FocusButton fallback={fallback} type="button" aria-disabled={page===pages-1} onClick={()=>move(pages-1)}>Last {kind}</FocusButton>
  <label>Go to {kind} page<FocusInput fallback={fallback} type="number" aria-invalid={!!issue} min="1" max={pages} step="1" value={id} onChange={event=>setDraft({owner,id:event.target.value,issue:''})}/></label><FocusButton fallback={fallback} type="button" onClick={()=>{const value=Number(id);if(id.trim()&&Number.isSafeInteger(value)&&value>=1&&value<=pages)move(value-1);else setDraft({owner,id,issue:`Enter a whole ${kind} page from 1 to ${pages}.`});}}>Go to {kind} page</FocusButton>{issue&&<span role="alert">{issue}</span>}
 </div>;
}
export function ResultTableBrowser({tile,fallback,preview=false}:{tile:DashboardTile;fallback:FocusTarget;preview?:boolean}){
 const scrollRef=useRemovalFocus(fallback);
 const columnTokens=useRef({ids:new WeakMap<object,number>(),next:1});
 const result=withSafeInference(tile.result),schema=JSON.stringify(result.columns.map(c=>{if(!c||typeof c!=='object')return null;let token=columnTokens.current.ids.get(c);if(!token){token=columnTokens.current.next++;columnTokens.current.ids.set(c,token);}return [token,c.id,c.label,typeof c.id==='string'?ownAxisLabel(tile.appearance,c.id):null];})),owner=useMemo(()=>({}),[tile.id,tile.result.table,tile.result.columns,schema]);
 const empty:TableExplorerSelection & {owner:object}={owner,rowSearch:'',columnSearch:'',rowPage:0,columnPage:0},[saved,setSaved]=useState(empty),selection=saved.owner===owner?saved:empty;
 const[clearEpoch,setClearEpoch]=useState(0);
 const[draft,setDraft]=useState({owner,column:'',status:'all',min:'',max:'',issue:''}),filterDraft=draft.owner===owner?draft:{owner,column:'',status:'all',min:'',max:'',issue:''};
 const[sortColumn,setSortColumn]=useState({owner,id:''}),sortId=sortColumn.owner===owner?sortColumn.id:'';
 const options=result.columns.filter(column=>column&&typeof column.id==='string').map(column=><option key={column.id} value={column.id}>{ownAxisLabel(tile.appearance,column.id)??column.label} · ID {JSON.stringify(column.id)}</option>);
 const valueUnit=result.metric.valueFormat==='percent'?'%':result.weighting.applied?'weighted value':result.query.weight?'recorded value (weighting unconfirmed)':result.metric.label;
 const columnName=(id:string)=>{const column=result.columns.find(c=>c.id===id);return column?`${ownAxisLabel(tile.appearance,id)??column.label} · ID ${JSON.stringify(id)}`:id;};
 function applyFilter(){const min=filterDraft.min.trim(),max=filterDraft.max.trim(),numberPattern=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  if(!filterDraft.column||[min,max].some(v=>v!==''&&(!numberPattern.test(v)||!Number.isFinite(Number(v))))||(min!==''&&max!==''&&Number(min)>Number(max))||(filterDraft.status==='unavailable'&&(min!==''||max!==''))){setDraft({...filterDraft,issue:'Choose a column and valid bounds (minimum no greater than maximum); unavailable cannot be combined with bounds.'});return;}
  change({filter:{columnId:filterDraft.column,status:filterDraft.status as 'all'|'available'|'unavailable',min:min===''?null:Number(min),max:max===''?null:Number(max)},rowPage:0});setDraft({...filterDraft,issue:''});
 }

 const view=tableExplorerWindow({...tile,result},selection),significance=buildExecutedColumnComparisonPresentation(result);
 function change(patch:Partial<TableExplorerSelection>){setSaved({...selection,...patch});}
 const rows=view.rows,columns=view.columns;
 return <div className="recorded-table-browser">
   <p>{result.table.length.toLocaleString()} {preview?'preview':'recorded'} answers × {result.columns.length.toLocaleString()} columns · {result.metric.label} · {resultWeightingLabel(result)}. Values show recorded numeric precision.</p>
   {!analysisSettingsMatch(tile.query,result.query)&&<p role="alert">Current editor settings differ from this recorded result. Rerun the analysis to apply those settings; this view shows the existing result.</p>}
   <p>{resultInferenceLabel(result)}</p>
   {saved.owner!==owner&&<p role="status">The recorded table or column labels changed. Table exploration was reset; choose columns again.</p>}
   {view.issue?<p role="alert">{view.issue}</p>:rows&&columns&&<>
    <div className="complete-table-search"><label>{preview?'Search preview answers':'Search recorded answers'}<FocusInput fallback={fallback} type="search" maxLength={256} value={selection.rowSearch} onChange={event=>change({rowSearch:event.target.value,rowPage:0})}/></label><label>{preview?'Search preview columns':'Search recorded columns'}<FocusInput fallback={fallback} type="search" maxLength={256} value={selection.columnSearch} onChange={event=>change({columnSearch:event.target.value,columnPage:0})}/></label></div>
    <section className="table-exploration" aria-label="Rank, filter and compare">
     <h3>Rank, filter and compare</h3><p>Display only: filtering and sorting do not recompute percentages, bases, totals or statistical comparisons. Unavailable values sort after available values.</p>
     <div className="table-exploration-controls"><label>Sort by<FocusSelect fallback={fallback} value={sortId} onChange={event=>{const id=event.target.value;setSortColumn({owner,id});change({sort:id==='label'?{kind:'label',direction:'asc'}:id?{kind:'value',columnId:id.slice(7),direction:'asc'}:null,rowPage:0});}}><option value="">Original order</option><option value="label">Answer label</option>{result.columns.map(column=><option key={column.id} value={`column:${column.id}`}>{columnName(column.id)}</option>)}</FocusSelect></label>
      <label>Sort direction<FocusSelect fallback={fallback} value={selection.sort?.direction??'asc'} disabled={!selection.sort} onChange={event=>{if(selection.sort)change({sort:{...selection.sort,direction:event.target.value as 'asc'|'desc'},rowPage:0});}}><option value="asc">Ascending</option><option value="desc">Descending</option></FocusSelect></label>
      <label>Filter column<FocusSelect fallback={fallback} value={filterDraft.column} onChange={event=>setDraft({...filterDraft,column:event.target.value,issue:''})}><option value="">Choose a column</option>{options}</FocusSelect></label>
      <label>Availability<FocusSelect fallback={fallback} value={filterDraft.status} onChange={event=>setDraft({...filterDraft,status:event.target.value,issue:''})}><option value="all">All values</option><option value="available">Available</option><option value="unavailable">Unavailable</option></FocusSelect></label>
      <label>Minimum ({valueUnit})<FocusInput fallback={fallback} type="text" inputMode="decimal" value={filterDraft.min} onChange={event=>setDraft({...filterDraft,min:event.target.value,issue:''})}/></label><label>Maximum ({valueUnit})<FocusInput fallback={fallback} type="text" inputMode="decimal" value={filterDraft.max} onChange={event=>setDraft({...filterDraft,max:event.target.value,issue:''})}/></label>
      <FocusButton fallback={fallback} type="button" onClick={applyFilter}>Apply row filter</FocusButton><FocusButton fallback={fallback} type="button" onClick={()=>{setDraft({owner,column:'',status:'all',min:'',max:'',issue:''});change({filter:null,rowPage:0});}}>Reset row filter</FocusButton>
     </div>{filterDraft.issue&&<p role="alert">{filterDraft.issue}</p>}
     <p>Sort: {selection.sort?`${selection.sort.kind==='label'?'Answer label':columnName(selection.sort.columnId)} · ${selection.sort.direction}`:'Original order'}. {selection.filter?`Active filter: ${columnName(selection.filter.columnId)} · ${selection.filter.status} · minimum ${selection.filter.min??'none'}, maximum ${selection.filter.max??'none'}.`:'No active row filter.'}</p>
     <div className="table-exploration-controls">{[0,1].map(index=><label key={index}>Pin comparison column {index+1}<FocusSelect fallback={fallback} value={selection.pins?.[index]??''} onChange={event=>{const pins=[...(selection.pins??[])];pins[index]=event.target.value;const next=pins.filter(Boolean);if(new Set(next).size===next.length)change({pins:next,columnPage:0});}}><option value="">None</option>{result.columns.map(column=><option key={column.id} value={column.id} disabled={selection.pins?.some((id,i)=>i!==index&&id===column.id)}>{columnName(column.id)}</option>)}</FocusSelect></label>)}</div><p>Pinned columns remain visible while paging; each window contains at most eight columns.</p>
    </section>
    <p role="status">Answers {rows.start}–{rows.end} of {rows.total.toLocaleString()} matching ({result.table.length.toLocaleString()} recorded); {selection.pins?.length?'unpinned columns':'columns'} {columns.start}–{columns.end} of {columns.total.toLocaleString()} matching ({result.columns.length.toLocaleString()} recorded).</p>
    <Pager fallback={fallback} owner={owner} key={`rows-${clearEpoch}-${selection.rowSearch}-${rows.pages}`} kind="answers" page={rows.page} pages={rows.pages} onPage={rowPage=>change({rowPage})}/><Pager fallback={fallback} owner={owner} key={`columns-${clearEpoch}-${selection.columnSearch}-${columns.pages}`} kind="columns" page={columns.page} pages={columns.pages} onPage={columnPage=>change({columnPage})}/>
    {!rows.total||!columns.positions.length?<p>No recorded cells match these display searches. Clear the searches to browse all cells.</p>:<div ref={scrollRef} className="complete-table-scroll" tabIndex={0} role="region" aria-label={preview?'Preview cells, scroll horizontally if needed':'Recorded cells, scroll horizontally if needed'}><table><caption>{preview?'Preview values and bases; current answer and column pages':"Recorded values and bases \u2014 current answer and column pages"}</caption><thead><tr><th scope="col" aria-sort={selection.sort?.kind==='label'?(selection.sort.direction==='asc'?'ascending':'descending'):undefined}>Answer</th>{columns.positions.map(position=>{const column=result.columns[position],label=ownAxisLabel(tile.appearance,column.id)??column.label;return <th scope="col" key={column.id} aria-sort={selection.sort?.kind==='value'&&selection.sort.columnId===column.id?(selection.sort.direction==='asc'?'ascending':'descending'):undefined}>{label||'(Blank display label)'}<small>Recorded label: {column.label}</small><small>Column {position+1} · ID {JSON.stringify(column.id)}{selection.pins?.includes(column.id)?' · Pinned':''}</small></th>;})}</tr></thead><tbody>{rows.positions.map(position=>{const row=result.table[position],label=ownAxisLabel(tile.appearance,row.optionId)??row.label;return <tr key={row.optionId}><th scope="row">{label||'(Blank display label)'}<small>Recorded label: {row.label}</small><small>Answer {position+1} · ID {JSON.stringify(row.optionId)}</small></th>{columns.positions.map(columnPosition=>{const column=result.columns[columnPosition],cell=recordedTableCell(result,row,column.id),annotation=result.annotations.find(item=>item.rowId===row.optionId&&item.columnId===column.id),comparison=getExecutedSignificanceCell(significance,row.optionId,column.id);return <td key={column.id}><span>{cell.value}</span><small>{cell.baseLabel}</small>{cell.reason&&<small>{cell.reason}</small>}{!cell.reason&&annotation&&<small>Recorded annotation: {annotation.direction}</small>}{!cell.reason&&comparison&&<small>{comparison.label}: {comparison.title}</small>}</td>;})}</tr>;})}</tbody></table></div>}
    <FocusButton fallback={fallback} type="button" onClick={()=>{setSaved(empty);setDraft({owner,column:'',status:'all',min:'',max:'',issue:''});setSortColumn({owner,id:''});setClearEpoch(value=>value+1);}}>Clear table searches and return to first pages</FocusButton><p>Clearing also resets ranking, row filters and pinned columns.</p>
   </>}
   <details><summary>{preview?'Preview notes and warnings':'Recorded notes and warnings'}</summary><p>{preview?'This temporary preview has not been placed or saved in the report. Creating runs a fresh calculation from the selected source. These searches only change the displayed cells.':'This is a view of the saved result, not a fresh query or a verification of the source. The complete result remains in report data and exports; file layout limits still apply.'}</p>{[...result.notes,...result.warnings].map((note,index)=><p key={index}>{note}</p>)}</details>
 </div>;
}
