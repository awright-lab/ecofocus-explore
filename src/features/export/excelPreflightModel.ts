import type {DashboardDraft} from '../../../shared/types/dashboard';
import {assertJsonSize} from '../../../shared/jsonSizeBudget';
import {buildXlsxWorkbookPlan,type XlsxWorkbookSheet} from './xlsxWorkbookPlan';
import {assertSpreadsheetText,spreadsheetColumnName} from './exportIntegrity';

export const excelReviewLimits={pages:100,cells:100000,inputChars:8*1024*1024,issues:200} as const;
export interface ExcelReviewIssue {severity:'blocking'|'advisory';sheet:string;address:string;message:string;cell?:{sheetIndex:number;row:number;column:number}}
export interface ExcelReviewSheet {name:string;rows:number;columns:number;cells:number}
export interface ExcelPreflightResult {complete:true;sheets:XlsxWorkbookSheet[];inventory:ExcelReviewSheet[];issues:ExcelReviewIssue[];issueCount:number;blockingCount:number;advisoryCount:number;checkedCells:number;excludedTextObjects:number;excludedImagesAndShapes:number;generatedAt:string;sourceStillCurrent:()=>boolean}

/** Only workbook dependencies; raw respondent data and image payloads are not inspected. */
function excelSource(dashboard:DashboardDraft){
 if(!Array.isArray(dashboard.pages)||dashboard.pages.length>excelReviewLimits.pages)throw Error('This read-only Excel review supports at most 100 pages. Export has its own checks; no report data was changed.');
 let minimumCells=0;
 const pages=dashboard.pages.map(page=>{
  const linked=page.elements.some(e=>!e.hidden&&e.evidence!==undefined);
  const tiles=page.tiles.map(tile=>{const cells=tile.result.table.length*(2+2*tile.result.columns.length);minimumCells+=cells;if(!Number.isSafeInteger(minimumCells)||minimumCells>excelReviewLimits.cells)throw Error('The Excel inspection exceeds 100,000 planned cells, including hidden source analyses. This is an inspection limit, not a verdict about export.');return{id:tile.id,title:tile.title,name:tile.name,visualization:tile.visualization,hidden:tile.hidden,zIndex:tile.layout.zIndex,query:tile.query,result:tile.result,derivedOutput:tile.derivedOutput,labels:tile.appearance.axisLabelOverrides};});
  return{id:page.id,title:page.title,order:page.order,tiles,elementScope:page.elements.map(e=>({id:e.id,type:e.type,hidden:e.hidden,linked:e.evidence!==undefined})),elements:page.elements.filter(e=>!e.hidden&&(e.evidence!==undefined||linked&&e.type==='text')).map(e=>({id:e.id,name:e.name,type:e.type,content:e.content,evidence:e.evidence,layout:e.evidence!==undefined?e.layout:undefined}))};
 });
 const source={title:dashboard.title,status:dashboard.status,version:dashboard.publishMetadata.versionLabel,pages};
 try{assertJsonSize(source,{maxChars:excelReviewLimits.inputChars,maxNodes:1000000,maxDepth:96});}catch{throw Error('Excel inspection context exceeds its 8,388,608-character budget or contains unsupported data. The report and original export actions were kept.');}
 return JSON.stringify(source);
}
export function excelColumnLabel(index:number){return index<16384?spreadsheetColumnName(index):`Column ${index+1} (outside Excel limit)`;}
export function excelCellAddress(row:number,column:number){return row<1048576&&column<16384?`${spreadsheetColumnName(column)}${row+1}`:`R${row+1}C${column+1}`;}

/** Read-only format inspection; not a download, native rendering test or export approval. */
export async function checkExcelPreflight(dashboard:DashboardDraft,options:{signal:AbortSignal;getCurrentDashboard?:()=>DashboardDraft;onProgress?:(checked:number,total:number)=>void}):Promise<ExcelPreflightResult>{
 const abort=()=>{if(options.signal.aborted)throw new DOMException('Excel review canceled. Your report was not changed.','AbortError');};abort();
 const binding=excelSource(dashboard),generatedAt=new Date().toISOString(),sheets=buildXlsxWorkbookPlan(dashboard,dashboard.pages,generatedAt);
 const inventory=sheets.map(sheet=>({name:sheet.name,rows:sheet.rows.length,columns:sheet.rows.reduce((n,row)=>Math.max(n,row.length),0),cells:sheet.rows.reduce((n,row)=>n+row.length,0)}));
 const total=inventory.reduce((n,s)=>n+s.cells,0);if(!Number.isSafeInteger(total)||total>excelReviewLimits.cells)throw Error('The complete workbook plan exceeds the 100,000-cell inspection limit. Nothing was sampled or dropped; export retains its own checks.');
 const issues:ExcelReviewIssue[]=[];let issueCount=0,blockingCount=0,advisoryCount=0,checkedCells=0,lastYield=0;
 function issue(value:ExcelReviewIssue){issueCount++;if(value.severity==='blocking')blockingCount++;else advisoryCount++;if(issues.length<excelReviewLimits.issues)issues.push(value);else if(value.severity==='blocking'){let advisory=issues.length-1;while(advisory>=0&&issues[advisory].severity!=='advisory')advisory--;if(advisory>=0){issues.splice(advisory,1);issues.push(value);}}}
 let excludedTextObjects=0,excludedImagesAndShapes=0;
 for(const page of dashboard.pages){const linked=page.elements.some(e=>!e.hidden&&e.evidence!==undefined);for(const e of page.elements.filter(e=>!e.hidden)){if(e.type==='text'&&!linked)excludedTextObjects++;if(e.type!=='text')excludedImagesAndShapes++;}}
 options.onProgress?.(0,total);abort();
 for(let s=0;s<sheets.length;s++){
  const sheet=sheets[s],info=inventory[s];
  if(info.rows>1048576||info.columns>16384)issue({severity:'blocking',sheet:sheet.name,address:'Worksheet',message:'Excel supports at most 1,048,576 rows and 16,384 columns per worksheet. Choose a smaller result or preserve it as JSON.'});
  try{assertSpreadsheetText(sheet.name);}catch{issue({severity:'blocking',sheet:sheet.name,address:'Worksheet name',message:'The generated worksheet name contains unsupported XML text. Rename the source page or analysis before exporting.'});}
  for(let r=0;r<sheet.rows.length;r++)for(let c=0;c<sheet.rows[r].length;c++){
   abort();const cell=sheet.rows[r][c],address=excelCellAddress(r,c);
   if(typeof cell==='string'){try{assertSpreadsheetText(cell);}catch(error){issue({severity:'blocking',sheet:sheet.name,address,cell:{sheetIndex:s,row:r,column:c},message:error instanceof Error?error.message:'Cell text is unsupported in Excel.'});}}
   else if(typeof cell!=='number'||!Number.isFinite(cell))issue({severity:'blocking',sheet:sheet.name,address,cell:{sheetIndex:s,row:r,column:c},message:'A planned numeric cell is not finite or has an unsupported type. Review the source; it was not repaired.'});
   else if(cell!==0&&(Math.abs(cell)<2.2251e-308||Math.abs(cell)>9.99999999999999e307))issue({severity:'advisory',sheet:sheet.name,address,cell:{sheetIndex:s,row:r,column:c},message:'This value is outside Excel’s documented stored-number range. Verify the generated workbook or use JSON to preserve the original number.'});
   else if(Number(cell.toPrecision(15))!==cell)issue({severity:'advisory',sheet:sheet.name,address,cell:{sheetIndex:s,row:r,column:c},message:'This number may round beyond Excel’s documented 15-digit precision. Verify the generated workbook or preserve the original number as JSON.'});
   checkedCells++;if(checkedCells-lastYield>=1000){lastYield=checkedCells;options.onProgress?.(checkedCells,total);abort();await new Promise<void>(resolve=>setTimeout(resolve,0));}
  }
 }
 abort();const sourceStillCurrent=()=>{try{return excelSource(options.getCurrentDashboard?.()??dashboard)===binding;}catch{return false;}};
 if(!sourceStillCurrent())throw Error('The report or its Excel export context changed during review. Check the current workbook again.');
 options.onProgress?.(checkedCells,total);abort();
 if(!sourceStillCurrent())throw Error('The report or its Excel export context changed during review. Check the current workbook again.');
 issues.sort((a,b)=>Number(a.severity==='advisory')-Number(b.severity==='advisory'));
 return{complete:true,sheets,inventory,issues,issueCount,blockingCount,advisoryCount,checkedCells,excludedTextObjects,excludedImagesAndShapes,generatedAt,sourceStillCurrent};
}
