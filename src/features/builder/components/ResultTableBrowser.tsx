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
 const result=withSafeInference(tile.result),owner=useMemo(()=>({}),[tile.id,tile.result.table,tile.result.columns,tile.appearance.axisLabelOverrides]);
 const empty={owner,rowSearch:'',columnSearch:'',rowPage:0,columnPage:0},[saved,setSaved]=useState(empty),selection=saved.owner===owner?saved:empty;
 const[clearEpoch,setClearEpoch]=useState(0);
 const view=tableExplorerWindow({...tile,result},selection),significance=buildExecutedColumnComparisonPresentation(result);
 function change(patch:Partial<TableExplorerSelection>){setSaved({...selection,...patch});}
 const rows=view.rows,columns=view.columns;
 return <div className="recorded-table-browser">
   <p>{result.table.length.toLocaleString()} {preview?'preview':'recorded'} answers × {result.columns.length.toLocaleString()} columns · {result.metric.label} · {resultWeightingLabel(result)}. Values show recorded numeric precision.</p>
   {!analysisSettingsMatch(tile.query,result.query)&&<p role="alert">Current editor settings differ from this recorded result. Rerun the analysis to apply those settings; this view shows the existing result.</p>}
   <p>{resultInferenceLabel(result)}</p>
   {view.issue?<p role="alert">{view.issue}</p>:rows&&columns&&<>
    <div className="complete-table-search"><label>{preview?'Search preview answers':'Search recorded answers'}<FocusInput fallback={fallback} type="search" maxLength={256} value={selection.rowSearch} onChange={event=>change({rowSearch:event.target.value,rowPage:0})}/></label><label>{preview?'Search preview columns':'Search recorded columns'}<FocusInput fallback={fallback} type="search" maxLength={256} value={selection.columnSearch} onChange={event=>change({columnSearch:event.target.value,columnPage:0})}/></label></div>
    <p role="status">Answers {rows.start}–{rows.end} of {rows.total.toLocaleString()} matching ({result.table.length.toLocaleString()} recorded); columns {columns.start}–{columns.end} of {columns.total.toLocaleString()} matching ({result.columns.length.toLocaleString()} recorded).</p>
    <Pager fallback={fallback} owner={owner} key={`rows-${clearEpoch}-${selection.rowSearch}-${rows.pages}`} kind="answers" page={rows.page} pages={rows.pages} onPage={rowPage=>change({rowPage})}/><Pager fallback={fallback} owner={owner} key={`columns-${clearEpoch}-${selection.columnSearch}-${columns.pages}`} kind="columns" page={columns.page} pages={columns.pages} onPage={columnPage=>change({columnPage})}/>
    {!rows.total||!columns.total?<p>No recorded cells match these display searches. Clear the searches to browse all cells.</p>:<div ref={scrollRef} className="complete-table-scroll" tabIndex={0} role="region" aria-label={preview?'Preview cells, scroll horizontally if needed':'Recorded cells, scroll horizontally if needed'}><table><caption>{preview?'Preview values and bases; current answer and column pages':"Recorded values and bases \u2014 current answer and column pages"}</caption><thead><tr><th scope="col">Answer</th>{columns.positions.map(position=>{const column=result.columns[position],label=ownAxisLabel(tile.appearance,column.id)??column.label;return <th scope="col" key={column.id}>{label||'(Blank display label)'}<small>Recorded label: {column.label}</small><small>Column {position+1} · ID {JSON.stringify(column.id)}</small></th>;})}</tr></thead><tbody>{rows.positions.map(position=>{const row=result.table[position],label=ownAxisLabel(tile.appearance,row.optionId)??row.label;return <tr key={row.optionId}><th scope="row">{label||'(Blank display label)'}<small>Recorded label: {row.label}</small><small>Answer {position+1} · ID {JSON.stringify(row.optionId)}</small></th>{columns.positions.map(columnPosition=>{const column=result.columns[columnPosition],cell=recordedTableCell(result,row,column.id),annotation=result.annotations.find(item=>item.rowId===row.optionId&&item.columnId===column.id),comparison=getExecutedSignificanceCell(significance,row.optionId,column.id);return <td key={column.id}><span>{cell.value}</span><small>{cell.baseLabel}</small>{cell.reason&&<small>{cell.reason}</small>}{!cell.reason&&annotation&&<small>Recorded annotation: {annotation.direction}</small>}{!cell.reason&&comparison&&<small>{comparison.label}: {comparison.title}</small>}</td>;})}</tr>;})}</tbody></table></div>}
    <FocusButton fallback={fallback} type="button" onClick={()=>{setSaved(empty);setClearEpoch(value=>value+1);}}>Clear table searches and return to first pages</FocusButton>
   </>}
   <details><summary>{preview?'Preview notes and warnings':'Recorded notes and warnings'}</summary><p>{preview?'This temporary preview has not been placed or saved in the report. Creating runs a fresh calculation from the selected source. These searches only change the displayed cells.':'This is a view of the saved result, not a fresh query or a verification of the source. The complete result remains in report data and exports; file layout limits still apply.'}</p>{[...result.notes,...result.warnings].map((note,index)=><p key={index}>{note}</p>)}</details>
 </div>;
}
