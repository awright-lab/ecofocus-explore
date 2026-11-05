// @vitest-environment jsdom
import { act } from 'react';import { createRoot } from 'react-dom/client';import { beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
import App from '../../../App';import {initialDashboard} from '../documentSeeds';import {createReportRecord,createPublishedSnapshot,legacyWorkspaceStorageKey,workspaceStorageKey,normalizeDashboardWorkspace,loadDashboardWorkspace,readStoredWorkspaceCopy,saveDashboardWorkspace} from '../workspacePersistence';import {storageKey} from '../../builder/builderConstants';
import {workspaceSaveSession} from '../workspaceSaveSession';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Synthetic only')));});
afterEach(()=>{workspaceSaveSession.remember(null);vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function duplicateWorkspace(){const first=createReportRecord({...structuredClone(initialDashboard),id:'same-report',title:'First valuable report'});const second=createReportRecord({...structuredClone(initialDashboard),id:'same-report',title:'Second distinct valuable report'});return normalizeDashboardWorkspace({reports:[first,second]});}
describe.each([workspaceStorageKey,legacyWorkspaceStorageKey])('report identity protection in %s',key=>{
 it('rejects duplicate report IDs before normalization or autosave can collapse distinct drafts',()=>{
  const raw='\r\n'+JSON.stringify(duplicateWorkspace(),null,2)+'\r\n';localStorage.setItem(key,raw);const write=vi.spyOn(Storage.prototype,'setItem');
  expect(()=>loadDashboardWorkspace()).toThrow('report IDs');expect(readStoredWorkspaceCopy()).toBe(raw);expect(write).not.toHaveBeenCalled();
 });
 it('keeps App in recovery through timers and navigation while preserving every original byte',async()=>{
  const raw=JSON.stringify(duplicateWorkspace(),null,2);localStorage.setItem(key,raw);const write=vi.spyOn(Storage.prototype,'setItem');vi.useFakeTimers();window.history.replaceState(null,'','#/reports/same-report');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{await act(async()=>root.render(<App/>));await act(async()=>{vi.advanceTimersByTime(10000);window.dispatchEvent(new HashChangeEvent('hashchange'));});expect(host.textContent).toContain('Your saved workspace needs attention');expect(host.querySelector('.builder-shell')).toBeNull();expect(localStorage.getItem(key)).toBe(raw);expect(readStoredWorkspaceCopy()).toBe(raw);expect(write).not.toHaveBeenCalled();}finally{await act(async()=>root.unmount());host.remove();}
 });
});
it('detects legacy effective-ID collisions from draft IDs or generated defaults',()=>{
 const workspace=duplicateWorkspace() as unknown as {reports:Array<{id?:string;draft:{id?:string}}>};workspace.reports.forEach(report=>delete report.id);
 localStorage.setItem(legacyWorkspaceStorageKey,JSON.stringify(workspace));expect(()=>loadDashboardWorkspace()).toThrow('report IDs');
 delete workspace.reports[0].draft.id;workspace.reports[1].id='report_1';delete workspace.reports[1].draft.id;
 localStorage.setItem(legacyWorkspaceStorageKey,JSON.stringify(workspace));expect(()=>loadDashboardWorkspace()).toThrow('report IDs');
});
it('keeps distinct legacy reports without IDs compatible and preserves both drafts on save/reopen',()=>{
 const workspace=duplicateWorkspace() as unknown as {reports:Array<{id?:string;draft:{id?:string}}>};workspace.reports.forEach(report=>{delete report.id;delete report.draft.id;});
 localStorage.setItem(legacyWorkspaceStorageKey,JSON.stringify(workspace));const loaded=loadDashboardWorkspace();expect(loaded.reports.map(report=>report.id)).toEqual(['report_1','report_2']);expect(loaded.reports.map(report=>report.draft.title)).toEqual(['First valuable report','Second distinct valuable report']);expect(saveDashboardWorkspace(loaded)).toBe(true);expect(loadDashboardWorkspace().reports).toHaveLength(2);
});
it('does not treat immutable snapshot versions sharing a report ID as duplicate reports',()=>{
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord({...structuredClone(initialDashboard),id:'report-one'})]});const first=createPublishedSnapshot(workspace,workspace.reports[0].draft);const second=createPublishedSnapshot(first.workspace,first.dashboard);expect(saveDashboardWorkspace(second.workspace)).toBe(true);expect(loadDashboardWorkspace().publishedSnapshots).toHaveLength(2);
});

it.each(['report','draft'] as const)('rejects an empty v2 %s ID without generating replacements',location=>{
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]});if(location==='report')workspace.reports[0].id='';else workspace.reports[0].draft.id='';const raw=JSON.stringify(workspace);localStorage.setItem(workspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow('report IDs');expect(readStoredWorkspaceCopy()).toBe(raw);
});
it('rejects a truthy non-string legacy report ID that would not match string routes',()=>{
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]});Object.assign(workspace.reports[0],{id:7});const raw=JSON.stringify(workspace);localStorage.setItem(legacyWorkspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow('report IDs');expect(readStoredWorkspaceCopy()).toBe(raw);
});

it.each([legacyWorkspaceStorageKey,storageKey])('migrates sparse historical report identity/metadata from %s into a reopenable v2 save',key=>{
 const draft=structuredClone(initialDashboard) as Partial<typeof initialDashboard>;delete draft.id;delete draft.title;delete draft.status;
 const workspace={reports:[{draft}],importedDatasets:[]};const raw=JSON.stringify(key===storageKey?draft:workspace);localStorage.setItem(key,raw);
 const loaded=loadDashboardWorkspace();expect(loaded.reports[0].id).toBe('report_1');expect(loaded.reports[0].draft).toMatchObject({id:'report_1',title:'Untitled report',status:'draft'});
 expect(loaded.reports[0].draft.pages[0].tiles.length).toBe(initialDashboard.pages[0].tiles.length);expect(saveDashboardWorkspace(loaded)).toBe(true);expect(loadDashboardWorkspace().reports[0].draft.id).toBe('report_1');expect(localStorage.getItem(key)).toBe(raw);
});

it.each(['title','createdAt','updatedAt','lastOpenedAt'])('rejects malformed legacy outer report %s before an unreadable v2 save',property=>{
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]});Object.assign(workspace.reports[0],{[property]:7});const raw=JSON.stringify(workspace);localStorage.setItem(legacyWorkspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe(raw);
});
it.each(['id','label','activeReportId'])('rejects malformed legacy workspace %s without hiding the original',property=>{
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]});Object.assign(workspace,{[property]:7});const raw=JSON.stringify(workspace);localStorage.setItem(legacyWorkspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe(raw);
});
