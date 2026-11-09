// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import App from '../../../App';
import {initialDashboard} from '../documentSeeds';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace,workspaceStorageKey} from '../workspacePersistence';
import {workspaceSaveSession} from '../workspaceSaveSession';
import {deferredWorkspaceImports} from '../deferredWorkspaceImports';
import {syntheticStudy} from './fixtures/syntheticStudy';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';

let host:HTMLDivElement,root:Root;
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Unexpected transport');}));
 localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);deferredWorkspaceImports.clear();window.history.replaceState(null,'','/#/');host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);deferredWorkspaceImports.clear();localStorage.clear();sessionStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function until(check:()=>boolean){for(let i=0;i<700&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-1800)).toBe(true);}
function button(label:string){const node=Array.from(document.querySelectorAll('button')).find(n=>n.textContent?.trim()===label);if(!node)throw Error(label);expect(node.disabled).toBe(false);return node;}
async function click(label:string){await act(async()=>button(label).click());}
async function original(){
 const {dataset}=await syntheticStudy(1000,30),draft=structuredClone(initialDashboard);draft.id='deferred-recovery-existing-study';draft.importedDatasets=[];draft.pages=draft.pages.slice(0,1);draft.pages[0].elements=[];
 const tile=draft.pages[0].tiles[0],result=runImportedDatasetQuery({dataset,field:dataset.fields[1],measureField:dataset.fields[3],metric:'sum',chartType:'table'});tile.query=structuredClone(result.query);tile.result=result;tile.source={kind:'importedField',id:'protected-original',datasetId:dataset.id,fieldId:dataset.fields[1].id,label:'Region'};tile.visualization='table';draft.pages[0].tiles=[tile];
 expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]}))).toBe(true);const baseline=structuredClone(loadDashboardWorkspace());expect(baseline.reports[0].draft.importedDatasets).toHaveLength(0);return baseline;
}
it('refuses a recovered1000x30study that reuses an existing ID with different answers, preserving saved source and report',async()=>{
 const baseline=await original(),pending=structuredClone(baseline.importedDatasets[0]);pending.rows[0].Spend='987654';pending.previewRows=structuredClone(pending.rows.slice(0,5));deferredWorkspaceImports.remember(pending);
 const raw=localStorage.getItem(workspaceStorageKey),writes=vi.spyOn(Storage.prototype,'setItem');await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('.workspace-home-header__actions'));writes.mockClear();await click('Add recovered studies');
 expect(loadDashboardWorkspace().importedDatasets[0].rows[0].Spend).toBe(baseline.importedDatasets[0].rows[0].Spend);expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);expect(loadDashboardWorkspace().importedDatasets).toEqual(baseline.importedDatasets);expect(loadDashboardWorkspace().reports.map(r=>r.draft)).toEqual(baseline.reports.map(r=>r.draft));expect(deferredWorkspaceImports.getPending()).toHaveLength(1);expect(deferredWorkspaceImports.getPending()[0].rows[0].Spend).toBe('987654');expect(document.querySelector('[aria-label="Import ready to recover"]')!.textContent).toMatch(/conflict|different data/i);expect(writes.mock.calls.filter(([key])=>key===workspaceStorageKey)).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
},30_000);

it('keeps all1000x30recovered rows after a real failed write, retries explicitly and cold reopens both sources and the protected report',async()=>{
 const baseline=await original(),{dataset}=await syntheticStudy(1000,30),rawBefore=localStorage.getItem(workspaceStorageKey);deferredWorkspaceImports.remember(dataset);
 const nativeSet=Storage.prototype.setItem;let deny=true;vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(deny&&key===workspaceStorageKey)throw new DOMException('Synthetic quota','QuotaExceededError');nativeSet.call(this,key,value);});
 await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('.workspace-home-header__actions'));await click('Add recovered studies');
 expect(localStorage.getItem(workspaceStorageKey)).toBe(rawBefore);expect(deferredWorkspaceImports.getPending()).toHaveLength(1);expect(workspaceSaveSession.getPending()?.importedDatasets.find(s=>s.id===dataset.id)?.rows).toEqual(dataset.rows);expect(document.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
 const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(true);deny=false;await click('Add recovered studies');await until(()=>deferredWorkspaceImports.getPending().length===0);
 const saved=structuredClone(loadDashboardWorkspace());expect(saved.importedDatasets).toHaveLength(2);expect(saved.importedDatasets.find(s=>s.id===baseline.importedDatasets[0].id)).toEqual(baseline.importedDatasets[0]);expect(saved.importedDatasets.find(s=>s.id===dataset.id)?.rows).toEqual(dataset.rows);expect(saved.importedDatasets.find(s=>s.id===dataset.id)?.fields).toEqual(dataset.fields);expect(saved.reports.map(r=>r.draft)).toEqual(baseline.reports.map(r=>r.draft));expect(saved.publishedSnapshots).toEqual(baseline.publishedSnapshots);expect(workspaceSaveSession.hasPending()).toBe(false);
 await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('.workspace-home-header__actions'));expect(loadDashboardWorkspace().importedDatasets).toEqual(saved.importedDatasets);expect(loadDashboardWorkspace().reports.map(r=>r.draft)).toEqual(saved.reports.map(r=>r.draft));expect(deferredWorkspaceImports.getPending()).toHaveLength(0);expect(fetch).not.toHaveBeenCalled();
},30_000);

it('backs up the conflicting recovery and saved study without changing either or writing active storage',async()=>{
 const baseline=await original(),incoming=structuredClone(baseline.importedDatasets[0]);incoming.rows[0].Spend='987654';deferredWorkspaceImports.remember(incoming);let blob:Blob|undefined;
 vi.stubGlobal('URL',class extends URL{static createObjectURL(value:Blob){blob=value;return'blob:recovered-import-backup';}static revokeObjectURL(){}});vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('.workspace-home-header__actions'));const before=localStorage.getItem(workspaceStorageKey),write=vi.spyOn(Storage.prototype,'setItem');await click('Add recovered studies');
 const section=document.querySelector('[aria-label="Import ready to recover"]')!;await act(async()=>Array.from(section.querySelectorAll('button')).find(n=>n.textContent==='Download workspace backup')!.click());
 const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>resolve(String(reader.result));reader.readAsText(blob!);});const backup=JSON.parse(text),pending=JSON.parse(backup.pendingImportsPayload),saved=JSON.parse(backup.payload);
 expect(pending[0].rows).toEqual(incoming.rows);expect(pending[0].rows[0].Spend).toBe('987654');expect(saved.importedDatasets[0].rows).toEqual(baseline.importedDatasets[0].rows);expect(backup.inventory.pendingImports).toBe(1);expect(localStorage.getItem(workspaceStorageKey)).toBe(before);expect(write.mock.calls.filter(([key])=>key===workspaceStorageKey)).toHaveLength(0);expect(deferredWorkspaceImports.getPending()).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
},30_000);
