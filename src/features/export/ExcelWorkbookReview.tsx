import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {DashboardDraft} from '../../../shared/types/dashboard';
import {checkExcelPreflight,excelCellAddress,excelColumnLabel,type ExcelPreflightResult} from './excelPreflightModel';
import './excel-workbook-review.css';

const cellText=(value:unknown)=>value===undefined?'Empty cell':typeof value==='string'?value:typeof value==='number'?String(value):'Unsupported cell type';

export function ExcelWorkbookReview({dashboard}:{dashboard:DashboardDraft}){
 const latest=useRef(dashboard);latest.current=dashboard;
 const checkButton=useRef<HTMLButtonElement|null>(null),viewer=useRef<HTMLElement|null>(null),displaced=useRef<HTMLElement|null>(null),inspector=useRef<HTMLElement|null>(null);
 const findingFocusOwner=useRef<HTMLButtonElement|null|undefined>(undefined);
 const owner=useRef<AbortController|null>(null),epoch=useRef(0),previousDashboard=useRef(dashboard);
 const[result,setResult]=useState<ExcelPreflightResult|null>(null),[progress,setProgress]=useState<{checked:number;total:number}|null>(null),[message,setMessage]=useState('');
 const[sheetIndex,setSheetIndex]=useState(0),[rowStart,setRowStart]=useState(0),[columnStart,setColumnStart]=useState(0),[jump,setJump]=useState('1'),[selectedCell,setSelectedCell]=useState<{row:number;column:number}|null>(null);
 useLayoutEffect(()=>{const requestedOwner=findingFocusOwner.current;findingFocusOwner.current=undefined;if(requestedOwner!==undefined&&(!requestedOwner||document.activeElement!==requestedOwner))return;if(selectedCell&&inspector.current){inspector.current.focus();inspector.current.scrollIntoView?.({block:'nearest'});}},[selectedCell]);
 const current=result?.sourceStillCurrent()??false;
 if(viewer.current?.contains(document.activeElement))displaced.current=document.activeElement as HTMLElement;
 useLayoutEffect(()=>{const node=displaced.current;displaced.current=null;if(node&&!node.isConnected&&(!document.activeElement||document.activeElement===document.body))checkButton.current?.focus();});
 useEffect(()=>()=>{epoch.current++;owner.current?.abort();},[]);
 useEffect(()=>{if(previousDashboard.current===dashboard)return;previousDashboard.current=dashboard;if(owner.current&&!owner.current.signal.aborted){epoch.current++;owner.current.abort();setProgress(null);}},[dashboard]);
 async function check(){owner.current?.abort();const controller=new AbortController(),attempt=++epoch.current;owner.current=controller;setResult(null);setMessage('');setProgress({checked:0,total:0});setSheetIndex(0);setRowStart(0);setColumnStart(0);setJump('1');setSelectedCell(null);let last=-1;
  try{const accepted=await checkExcelPreflight(latest.current,{signal:controller.signal,getCurrentDashboard:()=>latest.current,onProgress:(checked,total)=>{const percent=total?Math.floor(checked/total*100):0;if(epoch.current===attempt&&(percent>=last+5||checked===total)){last=percent;setProgress({checked,total});}}});if(epoch.current===attempt&&!controller.signal.aborted)setResult(accepted);}
  catch(error){if(epoch.current===attempt&&!controller.signal.aborted)setMessage(error instanceof Error?error.message:'No Excel review was accepted.');}
  finally{if(epoch.current===attempt&&!controller.signal.aborted)setProgress(null);}
 }
 function cancel(){epoch.current++;owner.current?.abort();setProgress(null);setMessage('Excel review canceled. The report and export actions were kept.');}
 const sheet=current?result!.sheets[sheetIndex]:undefined,info=current?result!.inventory[sheetIndex]:undefined;
 const rowEnd=sheet?Math.min(sheet.rows.length,rowStart+25):0,columnEnd=info?Math.min(info.columns,columnStart+8):0;
 function pageRows(start:number){setRowStart(start);setJump(String(start+1));setSelectedCell(null);}
 function chooseSheet(index:number){setSheetIndex(index);setRowStart(0);setColumnStart(0);setJump('1');setSelectedCell(null);}
 function inspectFinding(cell:{sheetIndex:number;row:number;column:number},trigger:HTMLButtonElement){
  if(!result?.sourceStillCurrent()){setMessage('The report changed. Check the current Excel workbook again before inspecting this finding.');return;}
  const target=result.sheets[cell.sheetIndex];
  if(!Number.isSafeInteger(cell.sheetIndex)||!Number.isSafeInteger(cell.row)||!Number.isSafeInteger(cell.column)||cell.sheetIndex<0||cell.row<0||cell.column<0||!target||cell.row>=target.rows.length||cell.column>=target.rows[cell.row].length){setMessage('This finding has no current cell location. Check the Excel workbook again.');return;}
  findingFocusOwner.current=document.activeElement===trigger?trigger:null;
  const start=Math.floor(cell.row/25)*25;
  setSheetIndex(cell.sheetIndex);setRowStart(start);setColumnStart(Math.floor(cell.column/8)*8);setJump(String(start+1));setMessage('');setSelectedCell({row:cell.row,column:cell.column});
 }
 const inspected=sheet&&selectedCell?sheet.rows[selectedCell.row]?.[selectedCell.column]:undefined;
 return <section className="excel-workbook-review" aria-label="Excel workbook review" data-canvas-keyboard-scope="controls">
  <h3>Review Excel worksheets</h3><p>Inspect the same table plan used by Excel export: worksheet names, values, bases, recorded context and included narrative text. This checks the whole bounded plan, not a sample. Canvas layout, charts as pictures, images, shapes and page backgrounds are not reproduced in the workbook.</p>
  <button ref={checkButton} type="button" onClick={()=>progress?cancel():void check()}>{progress?'Cancel Excel review':'Check Excel workbook'}</button>
  {progress&&<p role="status">Checking planned workbook cells: {progress.checked.toLocaleString()}{progress.total?` of ${progress.total.toLocaleString()}`:''}.</p>}
  {message&&<p role="alert">{message}</p>}{result&&!current&&<p role="status">The report or its Excel context changed. Run the review again before relying on these findings.</p>}
  {result&&current&&<section ref={viewer} aria-label="Checked Excel plan">
   <p role="status">{result.sheets.length} worksheets; {result.checkedCells.toLocaleString()} cells checked. {result.blockingCount} format problems and {result.advisoryCount} numeric compatibility advisories. {result.blockingCount?'Resolve the format problems before exporting.':'No format problems found in these checks.'}</p>
   <p>{result.excludedTextObjects} visible standalone text objects on pages without recorded evidence links are not included. {result.excludedImagesAndShapes} visible image/shape objects are not reproduced. Linked-story pages include their visible authored text and evidence worksheets. Hidden objects are excluded from output; their data may still be checked as evidence dependencies.</p>
   <p>This is a read-only inspection, not native Excel verification or export approval. Export recalculates its table plan and checks the current report again. Excel’s numeric range/15-digit precision can affect values; numeric advisories do not rewrite them. String cells are exported as literal inline text, not executable formulas. <a href="https://support.microsoft.com/en-us/excel/excel-specifications-and-limits" target="_blank" rel="noreferrer">Microsoft Excel limits</a>.</p>
   {result.issueCount>0&&<details open><summary>Excel findings ({result.issueCount})</summary><p>Showing {result.issues.length} of {result.issueCount} findings; format problems take priority in this bounded list.</p><ul>{result.issues.map((issue,index)=><li key={index}><strong>{issue.severity==='blocking'?'Format problem':'Numeric advisory'} - {issue.sheet}, {issue.address}</strong><p>{issue.message}</p>{issue.cell&&<button type="button" aria-label={`Inspect affected cell ${issue.sheet}, ${issue.address}`} onClick={event=>inspectFinding(issue.cell!,event.currentTarget)}>Inspect affected cell</button>}</li>)}</ul></details>}
   <label>Excel worksheet<select value={sheetIndex} onChange={e=>chooseSheet(Number(e.target.value))}>{result.inventory.map((s,i)=><option key={s.name} value={i}>{s.name} — {s.rows.toLocaleString()} rows × {s.columns.toLocaleString()} columns</option>)}</select></label>
   {sheet&&info&&<><p>Rows {rowStart+1}–{rowEnd} of {info.rows.toLocaleString()}; columns {columnStart+1}–{columnEnd} of {info.columns.toLocaleString()}. Up to 25 rows × 8 columns are rendered at once; navigate to inspect the rest.</p>
    <div className="excel-plan-controls"><button type="button" aria-disabled={rowStart===0} onClick={()=>rowStart>0&&pageRows(Math.max(0,rowStart-25))}>Previous worksheet rows</button><button type="button" aria-disabled={rowEnd>=info.rows} onClick={()=>rowEnd<info.rows&&pageRows(rowStart+25)}>Next worksheet rows</button><button type="button" aria-disabled={columnStart===0} onClick={()=>columnStart>0&&(setColumnStart(Math.max(0,columnStart-8)),setSelectedCell(null))}>Previous worksheet columns</button><button type="button" aria-disabled={columnEnd>=info.columns} onClick={()=>columnEnd<info.columns&&(setColumnStart(columnStart+8),setSelectedCell(null))}>Next worksheet columns</button>
     <label>Start at worksheet row<input type="number" min={1} max={info.rows} step={1} value={jump} onChange={e=>setJump(e.target.value)}/></label><button type="button" onClick={()=>{const n=Number(jump);if(!jump.trim()||!Number.isInteger(n)||n<1||n>info.rows){setMessage(`Enter a whole worksheet row from 1 to ${info.rows}.`);return;}setMessage('');pageRows(n-1);}}>Go to worksheet row</button></div>
    <div className="excel-plan-table" role="region" tabIndex={0} aria-label="Planned Excel cells"><table><caption>{sheet.name}: stored cell values; blank positions are empty cells, not zero</caption><thead><tr><th scope="col">Row</th>{Array.from({length:columnEnd-columnStart},(_,i)=><th key={i} scope="col">{excelColumnLabel(columnStart+i)}</th>)}</tr></thead><tbody>{sheet.rows.slice(rowStart,rowEnd).map((row,index)=><tr key={rowStart+index}><th scope="row">{rowStart+index+1}</th>{Array.from({length:columnEnd-columnStart},(_,i)=>{const column=columnStart+i,value=row[column],text=cellText(value);return <td key={column}><button type="button" aria-label={`Inspect planned cell ${excelCellAddress(rowStart+index,column)}`} data-excel-cell={excelCellAddress(rowStart+index,column)} onClick={()=>setSelectedCell({row:rowStart+index,column})}>{text.length>96?`${text.slice(0,96)}…`:text}</button></td>;})}</tr>)}</tbody></table></div>
    <section ref={inspector} tabIndex={-1} aria-label="Planned cell inspector"><h4>Inspect one cell</h4>{selectedCell?<><p>{excelCellAddress(selectedCell.row,selectedCell.column)}: {inspected===undefined?'Empty cell':typeof inspected==='number'?'Number':typeof inspected==='string'?'Literal text':'Unsupported cell type'}{typeof inspected==='string'?`; ${inspected.length.toLocaleString()} UTF-16 characters`:''}.</p>{typeof inspected==='string'&&inspected.length>32767?<p>The complete text exceeds this viewer’s 32,767-character display limit and Excel’s cell limit. It remains unchanged in the report; use JSON to preserve it.</p>:<label>Complete planned cell value<textarea readOnly value={inspected===undefined?'':cellText(inspected)}/></label>}<button type="button" onClick={()=>{const address=excelCellAddress(selectedCell.row,selectedCell.column),node=Array.from(viewer.current?.querySelectorAll<HTMLButtonElement>("button[data-excel-cell]")??[]).find(n=>n.dataset.excelCell===address);(node??checkButton.current)?.focus();}}>Return to worksheet cell</button></>:<p>Choose a cell above to inspect its complete stored value and type.</p>}</section>
   </>}
  </section>}
  <small>Inspection limits: 100 pages, 100,000 planned cells (including hidden source dependencies) and 8,388,608 JSON input characters. These are inspection budgets, not Excel export capacity or a memory guarantee. Native rendering, layout, formulas, links, source authentication and live-data freshness are not verified.</small>
 </section>;
}
