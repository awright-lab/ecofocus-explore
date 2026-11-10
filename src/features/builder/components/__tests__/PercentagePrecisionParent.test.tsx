// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../../App";
import frozen from "../../../data/__tests__/fixtures/legacy-percentage-v1.json";
import type { AnalyticsQueryResponse } from "../../../../../shared/types/analytics";
import type { ImportedDatasetRecord } from "../../../../../shared/types/dashboard";
import { decodeStoredWorkspaceSource, saveDashboardWorkspace, loadDashboardWorkspace, createPublishedSnapshot, workspaceStorageKey } from "../../../document/workspacePersistence";
import { workspaceSaveSession } from "../../../document/workspaceSaveSession";
function button(label:string,scope:ParentNode=document){const node=Array.from(scope.querySelectorAll('button')).find(n=>n.textContent?.trim()===label||n.getAttribute('aria-label')===label);if(!node)throw Error(label);return node;}
async function click(label:string){await act(async()=>button(label).click());}
async function until(check:()=>boolean){for(let i=0;i<500&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-1500)).toBe(true);}
it("actual App leaves legacy zero intact until requested refresh, then saves/reopens .002% without changing source or snapshot",async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn());
 const workspace=decodeStoredWorkspaceSource({key:workspaceStorageKey,raw:frozen.raw}),draft=workspace.reports[0].draft,header=structuredClone(frozen.rareHeader) as Omit<ImportedDatasetRecord,'rows'|'previewRows'>;
 const rows=Array.from({length:50000},(_,i)=>({[header.fields[0].sourceColumn]:i===0?'Rare':'Common'})),dataset:ImportedDatasetRecord={...header,rows,previewRows:rows.slice(0,5)};
 draft.importedDatasets=[dataset];workspace.importedDatasets=[dataset];draft.pages[0].elements=[];const tile=draft.pages[0].tiles[0];tile.result=structuredClone(frozen.rareResult) as AnalyticsQueryResponse;tile.query=structuredClone(tile.result.query);tile.name=tile.title='Rare percentage';tile.source={kind:'importedField',id:'rare-source',datasetId:dataset.id,fieldId:dataset.fields[0].id,label:'Answer'};
 workspace.publishedSnapshots=[];const seeded=createPublishedSnapshot(workspace,draft).workspace;
 localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);expect(saveDashboardWorkspace(seeded)).toBe(true);const original=structuredClone(loadDashboardWorkspace());window.history.replaceState(null,'',`/#/reports/${draft.id}`);
 const host=document.createElement('div');document.body.append(host);let root=createRoot(host);const current=()=>loadDashboardWorkspace().reports[0].draft;
 try{
  await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('details.export-menu'));
  expect(current().pages[0].tiles[0].result.table.find(r=>r.label==='Rare')?.values.summary).toBe(0);expect(current().pages[0].tiles[0].result.calculationInputs?.percentageValueMode).toBeUndefined();
  await click('Pages');await until(()=>!!document.querySelector('nav[aria-label="Report pages and objects"]'));
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.report-page-group.active button')).find(n=>n.getAttribute('aria-label')?.startsWith('Show objects on page'))!.click());
  await act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('.report-page-object-select')).find(n=>n.getAttribute('aria-label')?.startsWith('Select analysis Rare percentage,'))!.click());
  await click('Data');await until(()=>!!document.querySelector('[aria-label="Imported query editor"]'));
  expect(loadDashboardWorkspace().publishedSnapshots).toEqual(original.publishedSnapshots);expect(current()).toEqual(original.reports[0].draft);
  await click('Update imported result');await until(()=>current().pages[0].tiles[0].result.calculationInputs?.percentageValueMode==='unrounded_ratio_v1');
  const saved=structuredClone(current()),result=saved.pages[0].tiles[0].result;
  expect(result.table.find(r=>r.label==='Rare')?.values.summary).toBe(.002);expect(result.table.find(r=>r.label==='Common')?.values.summary).toBe(99.998);
  expect(host.textContent).toContain('0.002%');expect(host.textContent).toContain('99.998%');
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().publishedSnapshots).toEqual(original.publishedSnapshots);expect(workspaceSaveSession.hasPending()).toBe(false);
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('details.export-menu'));
  expect(current()).toEqual(saved);expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().publishedSnapshots).toEqual(original.publishedSnapshots);expect(fetch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();vi.unstubAllGlobals();}
},45000);
