// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import App from '../../../../App';
import {tableExplorerFixture} from './tableExplorerFixture';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace} from '../../../document/workspacePersistence';
import {workspaceSaveSession} from '../../../document/workspaceSaveSession';
async function until(check:()=>boolean){for(let i=0;i<1200&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-500)).toBe(true);}
async function click(text:string){await act(async()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent===text);if(!button)throw Error(text);button.click();});}
async function search(label:string,value:string){await act(async()=>{const input=Array.from(document.querySelectorAll('[role="dialog"] label')).find(node=>node.textContent===label)!.querySelector('input')!;input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
async function bodyKey(key:string,ctrlKey=false){await act(async()=>{(document.activeElement as HTMLElement)?.blur();document.body.tabIndex=-1;document.body.focus();document.body.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey,bubbles:true,cancelable:true}));});}
it('browses the actual100x20 App result without background edits, preserves1000x30data, retains canvas history and cold reopens the complete matrix',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn());
 const{draft,dataset}=await tableExplorerFixture();localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'',`/#/reports/${draft.id}`);expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]}))).toBe(true);
 const original=structuredClone(loadDashboardWorkspace()),host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));await until(()=>!!host.querySelector('.table-browser-controls'));
  await click('Pages');await until(()=>!!document.querySelector('nav[aria-label="Report pages and objects"]'));
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.report-page-group.active button')).find(button=>button.getAttribute('aria-label')?.startsWith('Show objects on page'))!.click());
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.report-page-object-select')).find(button=>button.getAttribute('aria-label')?.startsWith('Select analysis Synthetic complete table,'))!.click());
  const trigger=host.querySelector<HTMLButtonElement>('.table-browser-controls button')!;trigger.focus();expect(host.querySelectorAll('.table-cell-stack')).toHaveLength(600);await click('Explore complete table');await until(()=>!!document.querySelector('[role="dialog"]'));
  const id=draft.pages[0].tiles[0].result.columns[0].id;
  async function choose(name:string,value:string){await act(async()=>{const node=Array.from(document.querySelectorAll('[role="dialog"] label')).find(label=>label.textContent?.startsWith(name))!.querySelector('select')!;node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));});}
  await choose('Sort by',`column:${id}`);expect(document.querySelector('[role="dialog"]')!.textContent).toContain(' · asc');await choose('Filter column',id);await click('Apply row filter');expect(document.querySelector('[role="dialog"]')!.textContent).toContain('Active filter');await choose('Pin comparison column 1',id);expect(document.querySelector('[role="dialog"] thead')!.textContent).toContain('Pinned');
  await click('Clear table searches and return to first pages');
  await search('Search recorded answers','Answer99');await search('Search recorded columns','Group19');const input=Array.from(document.querySelectorAll('[role="dialog"] label')).find(node=>node.textContent==='Search recorded answers')!.querySelector('input')!;
  for(const[key,ctrlKey]of[['Delete',false],['Backspace',false],['ArrowRight',false],['d',true]]as const)await act(async()=>{input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey,bubbles:true,cancelable:true}));});
  expect(document.querySelectorAll('[role="dialog"] tbody td')).toHaveLength(1);expect(document.querySelector('[role="dialog"] tbody td span')!.textContent).toBe('10');expect(document.querySelector('[role="dialog"] tbody td')!.textContent).toContain('n=50');
  expect(loadDashboardWorkspace().reports.map(report=>report.draft)).toEqual(original.reports.map(report=>report.draft));expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(workspaceSaveSession.hasPending()).toBe(false);
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(trigger);
  const x=original.reports[0].draft.pages[0].tiles[0].layout.x;await bodyKey('ArrowRight');await until(()=>loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x!==x);await bodyKey('z',true);await until(()=>loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x===x);await bodyKey('y',true);await until(()=>loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x!==x);await bodyKey('z',true);await until(()=>loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].layout.x===x);
  expect(loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].result).toEqual(original.reports[0].draft.pages[0].tiles[0].result);expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!host.querySelector('.table-browser-controls'));
  expect(document.querySelector('[role="dialog"]')).toBeNull();expect(host.querySelectorAll('.table-cell-stack')).toHaveLength(600);expect(loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].result.table).toHaveLength(100);expect(loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].result.columns).toHaveLength(20);expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(fetch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();document.body.removeAttribute('tabindex');vi.unstubAllGlobals();}
},30_000);
