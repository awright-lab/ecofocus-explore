// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import App from '../../../App';
import { initialDashboard } from '../../document/documentSeeds';
import { createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace,workspaceStorageKey } from '../../document/workspacePersistence';
import { workspaceSaveSession } from '../../document/workspaceSaveSession';
import { importDatasetBuffer } from '../../data/datasetImportModel';

function control(label:string){const node=Array.from(document.querySelectorAll('label')).find(node=>Array.from(node.childNodes).filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('')===label)?.querySelector('input,select');if(!node)throw Error(label);return node as HTMLInputElement;}
async function change(label:string,value:string){await act(async()=>{const node=control(label);Object.getOwnPropertyDescriptor(node.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
async function click(text:string){await act(async()=>{const node=Array.from(document.querySelectorAll('button')).find(node=>node.textContent===text||node.getAttribute('aria-label')===text);if(!node)throw Error(text);node.click();});}
async function until(check:()=>boolean){for(let i=0;i<200&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(0,1200)).toBe(true);}

it('keeps the additive copy in the actual parent save session after quota failure, then global retry and cold reopen retain both studies',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 const modalDescriptor=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal'),closeDescriptor=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close'),scrollDescriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView');
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode(['ID,Region',...Array.from({length:30},(_,i)=>`${i+1},${i<15?'North':'NORTH'}`)].join('\n')).buffer,'synthetic-parent-recovery.csv');
 const draft=structuredClone(initialDashboard);draft.id='preparation-parent-recovery';draft.importedDatasets=[dataset!];draft.pages=draft.pages.slice(0,1);draft.pages[0].tiles=[];draft.pages[0].elements=[];draft.savedAudiences=[];
 window.localStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'',`/#/reports/${draft.id}`);
 expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset!]}))).toBe(true);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),originalSet=Storage.prototype.setItem;let denied=false;
 const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(denied&&key===workspaceStorageKey)throw new DOMException('Synthetic quota','QuotaExceededError');originalSet.call(this,key,value);});
 try{
  await act(async()=>root.render(<App/>));await until(()=>!!Array.from(document.querySelectorAll('button')).find(node=>node.getAttribute('aria-label')==='Find a tool'||node.textContent?.startsWith('Find a tool')));
  await click('Find a tool');await until(()=>!!document.getElementById('command-data-preparation'));await act(async()=>document.getElementById('command-data-preparation')!.click());await until(()=>!!document.querySelector('[aria-labelledby="preparation-title"]'));
  await change('Preparation study',dataset!.id);await change('Preparation field',dataset!.fields[1].id);await change('Preparation operation','lowercase');await click('Preview new step');await until(()=>!!Array.from(document.querySelectorAll('button')).find(node=>node.textContent==='Apply previewed step to history'));
  await click('Apply previewed step to history');await act(async()=>document.querySelector<HTMLInputElement>('.preparation-check input')!.click());
  const original=structuredClone(loadDashboardWorkspace().importedDatasets.find(item=>item.id===dataset!.id));denied=true;await click('Save prepared study copy');await until(()=>workspaceSaveSession.hasPending());
  const pending=workspaceSaveSession.getPending()!,prepared=pending.importedDatasets.find(item=>item.preparation);expect(prepared).toBeDefined();expect(prepared!.rows).toHaveLength(30);expect(prepared!.rows.every(row=>row.Region==='north')).toBe(true);expect(pending.importedDatasets.find(item=>item.id===dataset!.id)).toEqual(original);
  expect(loadDashboardWorkspace().importedDatasets).toHaveLength(1);expect(document.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
  await click('Close data preparation');denied=false;await click('Retry saving');expect(workspaceSaveSession.hasPending()).toBe(false);
  const cold=loadDashboardWorkspace();expect(cold.importedDatasets).toHaveLength(2);expect(cold.importedDatasets.find(item=>item.id===dataset!.id)).toEqual(original);expect(cold.importedDatasets.find(item=>item.id===prepared!.id)?.rows).toEqual(prepared!.rows);expect(document.querySelector('[aria-label="Workspace not saved"]')).toBeNull();
 }finally{denied=false;await act(async()=>root.unmount());host.remove();write.mockRestore();workspaceSaveSession.remember(null);window.localStorage.clear();for(const [prototype,key,descriptor] of [[HTMLDialogElement.prototype,'showModal',modalDescriptor],[HTMLDialogElement.prototype,'close',closeDescriptor],[HTMLElement.prototype,'scrollIntoView',scrollDescriptor]] as const){if(descriptor)Object.defineProperty(prototype,key,descriptor);else delete (prototype as unknown as Record<string,unknown>)[key];}vi.unstubAllGlobals();}
},20000);


