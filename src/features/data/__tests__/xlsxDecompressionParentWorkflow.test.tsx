// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Blob as NodeBlob} from 'node:buffer';
import {DecompressionStream as NodeDecompressionStream} from 'node:stream/web';
import App from '../../../App';
import {tableExplorerFixture} from '../../builder/components/__tests__/tableExplorerFixture';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace,workspaceStorageKey} from '../../document/workspacePersistence';
import {workspaceSaveSession} from '../../document/workspaceSaveSession';
import {runImportedDatasetQuery} from '../importedDatasetAnalytics';
import {alterXlsxSize,xlsxBytesFile} from './xlsxPartIntegrityFixture';
import {xlsxBudgetFixture} from './xlsxBudgetFixture';
import {sizedXlsxFixture} from './xlsxIntegrityFixture';
async function until(check:()=>boolean){for(let i=0;i<400&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-700)).toBe(true);}
async function choose(file:File){await act(async()=>{const input=document.querySelector<HTMLInputElement>('[aria-label="Import study file"]')!;Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new Event('change',{bubbles:true}));});}
it.each(['oversized declaration','forged small declaration'])('actual Home rejects %s without changing work, then imports a valid study and cold reopens all data',async mode=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn());vi.stubGlobal('Blob',NodeBlob);vi.stubGlobal('DecompressionStream',NodeDecompressionStream);vi.stubEnv('VITE_DATASET_IMPORT_PROVIDER','local');localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'','/#/');const{draft,dataset}=await tableExplorerFixture();expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]}))).toBe(true);const original=structuredClone(loadDashboardWorkspace()),raw=localStorage.getItem(workspaceStorageKey),part='xl/worksheets/sheet1.xml',file=await alterXlsxSize(xlsxBytesFile(Uint8Array.from(atob(xlsxBudgetFixture.data),c=>c.charCodeAt(0))),part,(mode==='oversized declaration'?33*1024*1024:1)-xlsxBudgetFixture.partBytes[part]),bytes=new Uint8Array(await file.arrayBuffer()).slice(),host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('[aria-label="Import study file"]'));await choose(file);await until(()=>!!document.querySelector('.studio-import-toast.error'));expect(document.querySelector('.studio-import-toast')!.textContent).toContain(mode==='oversized declaration'?'limit':'integrity');expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);expect(loadDashboardWorkspace()).toEqual(original);expect(workspaceSaveSession.hasPending()).toBe(false);expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  await choose(sizedXlsxFixture());await until(()=>loadDashboardWorkspace().importedDatasets.length===2);const saved=structuredClone(loadDashboardWorkspace()),study=saved.importedDatasets.find(item=>item.id!==dataset.id)!;expect(saved.reports).toEqual(original.reports);expect(saved.importedDatasets.find(item=>item.id===dataset.id)).toEqual(original.importedDatasets[0]);expect(study.rowCount).toBe(1000);expect(study.fieldCount).toBe(30);const result=runImportedDatasetQuery({dataset:study,field:study.fields[0],measureField:study.fields[1],metric:'average',chartType:'table'});expect(result.table.map(row=>[row.label,row.values.summary,row.bases.summary])).toEqual([['North',499,500],['South',500,500]]);expect(workspaceSaveSession.hasPending()).toBe(false);
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('[aria-label="Import study file"]'));expect(loadDashboardWorkspace().reports).toEqual(original.reports);expect(loadDashboardWorkspace().importedDatasets).toEqual(saved.importedDatasets);expect(fetch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();vi.unstubAllGlobals();vi.unstubAllEnvs();}
},30_000);
