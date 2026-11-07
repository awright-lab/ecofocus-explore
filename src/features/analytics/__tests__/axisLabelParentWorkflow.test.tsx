// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import App from '../../../App';
import {axisLabelFixture} from './axisLabelFixture';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace} from '../../document/workspacePersistence';
import {workspaceSaveSession} from '../../document/workspaceSaveSession';
async function until(check:()=>boolean){for(let i=0;i<300&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-500)).toBe(true);}
it('opens supported saved dictionary-like IDs in actual App, preserves own overrides and exact1000x30 data through save/cold reopen',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn());
 const{draft,tile,dataset}=await axisLabelFixture();localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'',`/#/reports/${draft.id}`);
 expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]}))).toBe(true);const original=structuredClone(loadDashboardWorkspace()),host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));await until(()=>!!host.querySelector('.analytics-table'));
  for(const label of ['A','B','C'])expect(host.querySelector('.analytics-table')!.textContent).toContain(label);
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().reports.map(report=>report.draft)).toEqual(original.reports.map(report=>report.draft));expect(workspaceSaveSession.hasPending()).toBe(false);
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);
  const authored=structuredClone(original),savedTile=authored.reports[0].draft.pages[0].tiles[0];savedTile.appearance.axisLabelOverrides=JSON.parse('{"__proto__":"Authored proto","constructor":"Authored constructor","toString":"Authored string"}');
  expect(saveDashboardWorkspace(authored)).toBe(true);const afterSave=structuredClone(loadDashboardWorkspace());root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!host.querySelector('.analytics-table'));
  for(const label of ['Authored proto','Authored constructor','Authored string'])expect(host.querySelector('.analytics-table')!.textContent).toContain(label);
  expect(Object.hasOwn(loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].appearance.axisLabelOverrides,'__proto__')).toBe(true);
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().reports[0].draft.pages[0].tiles[0].result).toEqual(original.reports[0].draft.pages[0].tiles[0].result);
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!host.querySelector('.analytics-table'));
  expect(host.querySelector('.analytics-table')!.textContent).toContain('Authored proto');expect(loadDashboardWorkspace().importedDatasets).toEqual(afterSave.importedDatasets);expect(loadDashboardWorkspace().reports.map(report=>report.draft)).toEqual(afterSave.reports.map(report=>report.draft));expect(fetch).not.toHaveBeenCalled();expect(workspaceSaveSession.hasPending()).toBe(false);expect(tile.result.table.map(row=>row.optionId)).toEqual(['__proto__','constructor','toString']);
 }finally{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();vi.unstubAllGlobals();}
},30_000);
