// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {Blob,File} from 'node:buffer';
import {webcrypto} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import App from '../../../App';
import {loadDashboardWorkspace,workspaceStorageKey} from '../../document/workspacePersistence';
import {workspaceSaveSession} from '../../document/workspaceSaveSession';
import {createLocalCsvImportController,type CsvImportRequest,type CsvImportMessage} from '../../data/localCsvImportProtocol';
import type {LocalCsvWorker} from '../../data/localCsvImportJob';

// Only the browser transport is simulated. The real CSV worker controller,
// importer, App, query engine, save session, persistence codec and exporter run.
class CsvTransport implements LocalCsvWorker {
 onmessage:LocalCsvWorker['onmessage']=null; onerror:LocalCsvWorker['onerror']=null; onmessageerror:LocalCsvWorker['onmessageerror']=null;
 stopped=false;
 controller=createLocalCsvImportController(message=>queueMicrotask(()=>{if(!this.stopped)this.onmessage?.({data:structuredClone(message)} as MessageEvent<CsvImportMessage>);}));
 constructor(url:URL){if(!String(url).includes('localCsvImport.worker.ts'))throw Error(`Unexpected worker transport: ${url}`);}
 postMessage(message:CsvImportRequest){this.controller(message);}
 terminate(){this.stopped=true;}
}
const headers=['Answer','Group','Keep','RespondentID',...Array.from({length:26},(_,i)=>`Extra${i+1}`)];
function source(){
 const rows=Array.from({length:1000},(_,i)=>Object.fromEntries(headers.map((h,j)=>[h,j===0?(i%35===0?'=1+1':`R${String(i%35).padStart(2,'0')}`):j===1?`G${i%10}`:j===2?(i%3?'Yes':'No'):j===3?String(i+1):`value-${i}-${j}`])));
 return{rows,csv:[headers.join(','),...rows.map(row=>headers.map(h=>row[h]).join(','))].join('\n')};
}
let host:HTMLDivElement,root:Root,denied:boolean,downloads:Array<{blob:Blob;name:string}>,blobs:Map<string,Blob>;
let descriptors:Array<{owner:object;key:string;value:PropertyDescriptor|undefined}>;
function replace(owner:object,key:string,value:unknown){descriptors.push({owner,key,value:Object.getOwnPropertyDescriptor(owner,key)});Object.defineProperty(owner,key,{configurable:true,writable:true,value});}
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('Worker',CsvTransport);vi.stubGlobal('File',File);vi.stubGlobal('Blob',Blob);
 vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn(()=>{throw Error('The local journey must not call a service');}));
 descriptors=[];downloads=[];blobs=new Map();denied=false;
 replace(HTMLDialogElement.prototype,'showModal',function(this:HTMLDialogElement){this.setAttribute('open','');});replace(HTMLDialogElement.prototype,'close',function(this:HTMLDialogElement){this.removeAttribute('open');});replace(HTMLElement.prototype,'scrollIntoView',vi.fn());
 replace(URL,'createObjectURL',(blob:Blob)=>{const id=`blob:journey-${blobs.size}`;blobs.set(id,blob);return id;});replace(URL,'revokeObjectURL',vi.fn());
 replace(HTMLAnchorElement.prototype,'click',function(this:HTMLAnchorElement){const blob=blobs.get(this.href);if(!blob)throw Error('Download did not reference a generated Blob');downloads.push({blob,name:this.download});});
 const nativeSet=Storage.prototype.setItem;vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(denied&&key===workspaceStorageKey)throw new DOMException('Synthetic quota','QuotaExceededError');nativeSet.call(this,key,value);});
 localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'','/#/');host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{denied=false;await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();vi.restoreAllMocks();for(const{owner,key,value}of descriptors.reverse()){if(value)Object.defineProperty(owner,key,value);else Reflect.deleteProperty(owner,key);}vi.unstubAllGlobals();});
async function until(check:()=>boolean){for(let i=0;i<700&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-1800)).toBe(true);}
function button(label:string){const nodes=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(n=>n.textContent?.trim()===label||n.getAttribute('aria-label')===label||n.querySelector('strong')?.textContent===label);expect(nodes.length,`Unique ${label}`).toBe(1);expect(nodes[0].disabled,`${label} enabled`).toBe(false);for(let node:HTMLElement|null=nodes[0];node;node=node.parentElement)expect(node.inert||node.hasAttribute('inert'),`${label} is reachable outside inert background`).not.toBe(true);return nodes[0];}
async function click(label:string){await act(async()=>button(label).click());}
async function select(label:string,value:string){await act(async()=>{const node=Array.from(document.querySelectorAll('label')).find(n=>n.textContent?.trim().startsWith(label))?.querySelector('select');expect(node,label).not.toBeNull();expect(Array.from(node!.options).some(o=>o.value===value),`Available option for ${label}`).toBe(true);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(node,value);node!.dispatchEvent(new Event('change',{bubbles:true}));});}
async function reopen(){await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('details.export-menu'));}
function zipXml(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),parts=new Map<string,Document>();let offset=0;
 while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){expect(view.getUint16(offset+8,true)).toBe(0);const size=view.getUint32(offset+18,true),names=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+names+extra;expect(start+size).toBeLessThanOrEqual(bytes.length);const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+names));if(name.endsWith('.xml')){const xml=new DOMParser().parseFromString(new TextDecoder().decode(bytes.subarray(start,start+size)),'application/xml');expect(xml.querySelector('parsererror'),name).toBeNull();parts.set(name,xml);}offset=start+size;}
 expect(view.getUint32(offset,true)).toBe(0x02014b50);return parts;
}
it.each(['none','import','analysis'] as const)('imports1000x30, creates a350-cell analysis, saves/reopens and exports actual XLSX; failed write=%s',async failure=>{
 const f=source();await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('.workspace-home-header__actions'));
 const baseline=structuredClone(loadDashboardWorkspace());await click('Import local CSV or SPSS');await act(async()=>{const input=document.querySelector<HTMLInputElement>('[aria-labelledby="local-csv-title"] input[type="file"]')!;Object.defineProperty(input,'files',{configurable:true,value:[new File([f.csv],'synthetic-journey-1000x30.csv')]});input.dispatchEvent(new Event('change',{bubbles:true}));});
 await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));expect(loadDashboardWorkspace().importedDatasets).toEqual(baseline.importedDatasets);
 denied=failure==='import';await click('Add study to workspace');
 if(denied){await until(()=>workspaceSaveSession.getPending()?.importedDatasets.some(s=>s.fileName==='synthetic-journey-1000x30.csv')??false);expect(loadDashboardWorkspace().importedDatasets).toEqual(baseline.importedDatasets);expect(document.body.textContent).toContain('workspace saving failed');await click('Close local import');denied=false;await click('Retry saving');await until(()=>!workspaceSaveSession.hasPending());}
 else{await until(()=>document.body.textContent?.includes('The complete study was added and saved')??false);await click('Close local import');}
 const imported=loadDashboardWorkspace().importedDatasets.find(s=>s.fileName==='synthetic-journey-1000x30.csv')!;expect(imported.rows).toEqual(f.rows);expect(imported.fields.map(v=>v.sourceColumn)).toEqual(headers);expect(imported.rowCount).toBe(1000);expect(imported.fieldCount).toBe(30);
 const importSaved=structuredClone(loadDashboardWorkspace());await click('New report');await until(()=>!!document.querySelector('details.export-menu'));const reportId=window.location.hash.split('/').at(-1)!;
 const before=structuredClone(loadDashboardWorkspace()),beforeReport=before.reports.find(r=>r.id===reportId)!;expect(beforeReport).toBeDefined();await click('Find a tool');await until(()=>!!document.querySelector<HTMLButtonElement>('[data-tool-command=analysis]'));await act(async()=>document.querySelector<HTMLButtonElement>('[data-tool-command=analysis]')!.click()); await act(async () => document.querySelector<HTMLButtonElement>(".tool-library-open")!.click());await until(()=>!!document.querySelector('[aria-label="Analysis result preview"]'));
 await click('Your imported studies');await select('Imported dataset',imported.id);await select('Group responses by',imported.fields.find(v=>v.sourceColumn==='Answer')!.id);await act(async()=>{const details=document.querySelector<HTMLDetailsElement>('details.guided-query-analysis-details')!;details.open=true;details.dispatchEvent(new Event('toggle',{bubbles:true}));});await select('Result values','count');await select('Optional comparison group',imported.fields.find(v=>v.sourceColumn==='Group')!.id);await select('Place analysis','new_page');
 expect(loadDashboardWorkspace().reports.find(r=>r.id===reportId)!.draft).toEqual(beforeReport.draft);expect(loadDashboardWorkspace().importedDatasets).toEqual(importSaved.importedDatasets);
 denied=failure==='analysis';await click('Create table on new page');
 if(denied){await until(()=>workspaceSaveSession.getPending()?.reports.find(r=>r.id===reportId)?.draft.pages.some(p=>p.tiles.some(t=>t.result.table.length===35))??false);expect(loadDashboardWorkspace().reports.find(r=>r.id===reportId)!.draft).toEqual(beforeReport.draft);expect(document.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();denied=false;await click('Retry saving');}
 await until(()=>loadDashboardWorkspace().reports.find(r=>r.id===reportId)?.draft.pages.some(p=>p.tiles.some(t=>t.result.table.length===35))??false);
 const saved=structuredClone(loadDashboardWorkspace()),draft=saved.reports.find(r=>r.id===reportId)!.draft,tile=draft.pages.flatMap(p=>p.tiles).find(t=>t.result.table.length===35)!;expect(tile.result.columns).toHaveLength(10);expect(tile.result.metric.id).toBe('count');
 for(const row of tile.result.table)for(const column of tile.result.columns){const matching=f.rows.filter(r=>r.Answer===row.label&&r.Group===column.label).length;expect(row.values[column.id],`${row.label}/${column.label}`).toBe(matching);expect(row.bases[column.id]).toBe(100);}
 expect(saved.importedDatasets).toEqual(importSaved.importedDatasets);expect(saved.reports.filter(r=>r.id!==reportId).map(r=>r.draft)).toEqual(importSaved.reports.map(r=>r.draft));expect(saved.publishedSnapshots).toEqual(baseline.publishedSnapshots);expect(workspaceSaveSession.hasPending()).toBe(false);
 await reopen();expect(loadDashboardWorkspace().reports.map(r=>r.draft)).toEqual(saved.reports.map(r=>r.draft));expect(loadDashboardWorkspace().importedDatasets).toEqual(saved.importedDatasets);
 await act(async()=>document.querySelector('details.export-menu')!.setAttribute('open',''));await click('Review before exporting');await click('Check Excel workbook');await until(()=>!!document.querySelector('[aria-label="Checked Excel plan"]'));expect(downloads).toHaveLength(0);await click('Close review');await click('Excel tables (.xlsx)');await until(()=>downloads.length===1);expect(downloads[0].name).toMatch(/-analysis-draft\.xlsx$/);expect(downloads[0].blob.type).toContain('spreadsheetml');
 const bytes=new Uint8Array(await downloads[0].blob.arrayBuffer()),parts=zipXml(bytes);expect(parts.has('xl/workbook.xml')).toBe(true);const sheets=[...parts.entries()].filter(([name])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name));const table=sheets.find(([,xml])=>[...xml.getElementsByTagName('row')].some(row=>row.textContent?.startsWith('Source row labelDisplay row label')))![1];expect(table).toBeDefined();const allRows=[...table.getElementsByTagName('row')],headerIndex=allRows.findIndex(row=>row.textContent?.startsWith('Source row labelDisplay row label'));
 const dataRows=allRows.slice(headerIndex+1);expect(dataRows).toHaveLength(35);for(const row of dataRows){const cells=[...row.getElementsByTagName('c')],label=cells[0].textContent!;expect(cells).toHaveLength(22);expect(cells[0].getAttribute('t')).toBe('inlineStr');expect(cells[1].getAttribute('t')).toBe('inlineStr');tile.result.columns.forEach((column,i)=>{expect(Number(cells[2+2*i].textContent)).toBe(f.rows.filter(r=>r.Answer===label&&r.Group===column.label).length);expect(Number(cells[3+2*i].textContent)).toBe(100);});}
 expect(table.getElementsByTagName('f')).toHaveLength(0);expect(table.documentElement.textContent).toContain('=1+1');expect(URL.revokeObjectURL).toHaveBeenCalledOnce();expect(loadDashboardWorkspace().reports.map(r=>r.draft)).toEqual(saved.reports.map(r=>r.draft));expect(loadDashboardWorkspace().importedDatasets).toEqual(saved.importedDatasets);expect(fetch).not.toHaveBeenCalled();
 if(process.env.ECOFOCUS_JOURNEY_ARTIFACTS){const directory=process.env.ECOFOCUS_JOURNEY_ARTIFACTS;mkdirSync(directory,{recursive:true});writeFileSync(join(directory,`journey-${failure}.xlsx`),bytes);writeFileSync(join(directory,`journey-${failure}-oracle.json`),JSON.stringify({sourceRows:f.rows,columns:tile.result.columns,table:tile.result.table}));}
},45_000);
