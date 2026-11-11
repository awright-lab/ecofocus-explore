import type { AnalyticsQueryResponse, AnalyticsTableRow } from '../../../../shared/types/analytics';
import type { DashboardTile } from '../../../../shared/types/dashboard';
import { analyticalBase, analyticalCell } from '../../../../shared/analytics/resultCells';
import { resultIdentityIssue } from '../../../../shared/analytics/resultIdentities';
import { ownAxisLabel } from '../../design-system/axisLabels';

export const tablePreviewLimits={rows:50,columns:12} as const;
export const tableExplorerLimits={rows:25,columns:8} as const;
export function needsTableExplorer(result:AnalyticsQueryResponse){return result.table.length>tablePreviewLimits.rows||result.columns.length>tablePreviewLimits.columns;}
export type TableSort = {kind:'label';direction:'asc'|'desc'} | {kind:'value';columnId:string;direction:'asc'|'desc'};
export type TableFilter = {columnId:string;status:'all'|'available'|'unavailable';min:number|null;max:number|null};
export interface TableExplorerSelection{rowSearch:string;columnSearch:string;rowPage:number;columnPage:number;sort?:TableSort|null;filter?:TableFilter|null;pins?:string[]}
/** The same availability rules used by the rendered cell, without formatting. */
export function recordedNumericCell(result:AnalyticsQueryResponse,row:AnalyticsTableRow,columnId:string):number|null{
 if(!row.values||!row.bases||!Object.hasOwn(row.values,columnId))return null;
 if(['average','percent_selected','column_percent'].includes(result.metric.id)&&analyticalBase(result,row,columnId)===null)return null;
 const cell=analyticalCell(result,row,columnId);return cell.status==='available'?cell.value:null;
}

const normalized=(value:string)=>value.normalize('NFKC').toLowerCase();
function positions<T>(items:T[],search:string,label:(item:T)=>string[]){
 const terms=normalized(search.trim()).split(/\s+/).filter(Boolean),matches:number[]=[];
 for(let index=0;index<items.length;index++)if(!terms.length||terms.every(term=>label(items[index]).some(text=>normalized(text).includes(term))))matches.push(index);
 return matches;
}
function pageWindow(matches:number[],requested:number,size:number){const last=Math.max(0,Math.ceil(matches.length/size)-1),page=Number.isSafeInteger(requested)?Math.min(last,Math.max(0,requested)):0;return {page,pages:last+1,total:matches.length,start:matches.length?page*size+1:0,end:Math.min((page+1)*size,matches.length),positions:matches.slice(page*size,(page+1)*size)};}
/** Display-only windows. Never copies/recalculates the result matrix. */
export function tableExplorerWindow(tile:DashboardTile,selection:TableExplorerSelection){
 const result=tile.result,issue=resultIdentityIssue(result);
 if(issue)return {issue,rows:null,columns:null};
 if(result.table.some(row=>typeof row.label!=='string')||result.columns.some(column=>typeof column.label!=='string'))return {issue:'Recorded row or column labels are invalid. Rerun the analysis; the recorded result has not been changed.',rows:null,columns:null};
 const ids=new Set(result.columns.map(column=>column.id)),pins=selection.pins??[];
 if((selection.sort?.kind==='value'&&!ids.has(selection.sort.columnId))||(selection.filter&&!ids.has(selection.filter.columnId))||pins.length>2||new Set(pins).size!==pins.length||pins.some(id=>!ids.has(id)))return {issue:'A selected column is no longer available. Reset table exploration and choose again.',rows:null,columns:null};
 let rows=positions(result.table,selection.rowSearch,row=>[row.label,row.optionId,ownAxisLabel(tile.appearance,row.optionId)??'']);
 const filter=selection.filter;
 if(filter)rows=rows.filter(index=>{const value=recordedNumericCell(result,result.table[index],filter.columnId);if(value===null)return filter.status!=='available'&&filter.min===null&&filter.max===null;if(filter.status==='unavailable')return false;return (filter.min===null||value>=filter.min)&&(filter.max===null||value<=filter.max);});
 const sort=selection.sort;
 if(sort)rows.sort((a,b)=>{let cmp=0;if(sort.kind==='label'){const left=ownAxisLabel(tile.appearance,result.table[a].optionId)??result.table[a].label,right=ownAxisLabel(tile.appearance,result.table[b].optionId)??result.table[b].label;cmp=left<right?-1:left>right?1:0;}else{const left=recordedNumericCell(result,result.table[a],sort.columnId),right=recordedNumericCell(result,result.table[b],sort.columnId);if(left===null||right===null)return left===right?a-b:left===null?1:-1;cmp=left<right?-1:left>right?1:0;}return (sort.direction==='asc'?cmp:-cmp)||a-b;});
 const columns=positions(result.columns,selection.columnSearch,column=>[column.label,column.id,ownAxisLabel(tile.appearance,column.id)??'']);
 const pinPositions=pins.map(id=>result.columns.findIndex(column=>column.id===id));
 const window=pageWindow(columns.filter(position=>!pins.includes(result.columns[position].id)),selection.columnPage,tableExplorerLimits.columns-pins.length);
 return {issue:null,rows:pageWindow(rows,selection.rowPage,tableExplorerLimits.rows),columns:{...window,positions:[...pinPositions,...window.positions]}};
}
export function recordedTableCell(result:AnalyticsQueryResponse,row:AnalyticsTableRow,columnId:string){
 const values=row.values,bases=row.bases;
 const base=analyticalBase(result,row,columnId);
 const weighted=result.weighting.applied,unconfirmed=!weighted&&Boolean(result.query.weight);
 const baseValid=base!==null;
 const baseLabel=!baseValid?'Base unavailable':weighted?`Weighted base total ${base}`:unconfirmed?`Recorded base ${base} (weighting unconfirmed)`:`n=${base}`;
 if(!values||!bases||!Object.hasOwn(values,columnId))return {value:'Unavailable',reason:'No recorded value for this cell.',baseLabel};
 if(['average','percent_selected','column_percent'].includes(result.metric.id)&&!baseValid)return {value:'Unavailable',reason:'A valid own recorded base is required for this percentage or average.',baseLabel};
 const cell=analyticalCell(result,row,columnId);
 if(cell.status!=='available')return {value:'Unavailable',reason:cell.status==='no_observations'?'No valid observations in this cell.':cell.status==='rerun_required'?'Rerun to establish valid per-cell bases.':'The recorded value or base is invalid.',baseLabel};
 return {value:`${cell.value}${result.metric.valueFormat==='percent'?'%':''}`,reason:null,baseLabel};
}
