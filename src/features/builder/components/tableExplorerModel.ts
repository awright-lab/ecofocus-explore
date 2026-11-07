import type { AnalyticsQueryResponse, AnalyticsTableRow } from '../../../../shared/types/analytics';
import type { DashboardTile } from '../../../../shared/types/dashboard';
import { analyticalBase, analyticalCell } from '../../../../shared/analytics/resultCells';
import { resultIdentityIssue } from '../../../../shared/analytics/resultIdentities';
import { ownAxisLabel } from '../../design-system/axisLabels';

export const tablePreviewLimits={rows:50,columns:12} as const;
export const tableExplorerLimits={rows:25,columns:8} as const;
export function needsTableExplorer(result:AnalyticsQueryResponse){return result.table.length>tablePreviewLimits.rows||result.columns.length>tablePreviewLimits.columns;}
export interface TableExplorerSelection{rowSearch:string;columnSearch:string;rowPage:number;columnPage:number}
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
 const rows=positions(result.table,selection.rowSearch,row=>[row.label,row.optionId,ownAxisLabel(tile.appearance,row.optionId)??'']);
 const columns=positions(result.columns,selection.columnSearch,column=>[column.label,column.id,ownAxisLabel(tile.appearance,column.id)??'']);
 return {issue:null,rows:pageWindow(rows,selection.rowPage,tableExplorerLimits.rows),columns:pageWindow(columns,selection.columnPage,tableExplorerLimits.columns)};
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
