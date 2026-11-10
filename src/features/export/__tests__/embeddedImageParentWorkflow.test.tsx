// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import App from '../../../App';
import {importDatasetBuffer} from '../../data/datasetImportModel';
import {createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace} from '../../document/workspacePersistence';
import {workspaceSaveSession} from '../../document/workspaceSaveSession';
import {ControlledImage,imageObject,imageReport,tinyPng} from './embeddedImageFixtures';

async function click(text:string){await act(async()=>{const button=Array.from(document.querySelectorAll('button')).find(button=>button.textContent===text||button.getAttribute('aria-label')===text);if(!button)throw Error(text);button.click();});}
async function until(check:()=>boolean){for(let i=0;i<300&&!check();i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,10)));expect(check(),document.body.textContent?.slice(-500)).toBe(true);}
it('runs the actual App export preflight on two pages and preserves a1000x30 study, report and cold reopen',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('Image',ControlledImage);vi.stubGlobal('fetch',vi.fn());ControlledImage.instances=[];
 const fields=Array.from({length:30},(_,i)=>`Field${i}`),csv=[fields.join(','),...Array.from({length:1000},(_,row)=>fields.map((_,column)=>String((row+column)%17)).join(','))].join('\n');
 const{dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic-image-check1000x30.csv');if(!dataset)throw Error('Synthetic fixture');
 const report=imageReport();report.importedDatasets=[dataset];report.pages[0].elements=[imageObject()];report.pages.push({...structuredClone(report.pages[0]),id:'image-check-second',title:'Image check second page',order:2,backgroundMode:'image',backgroundImage:tinyPng,elements:[imageObject('data:image/png;base64,AAAA','broken'),imageObject('https://example.invalid/private','external')]});
 localStorage.clear();sessionStorage.clear();workspaceSaveSession.remember(null);window.history.replaceState(null,'',`/#/reports/${report.id}`);expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(report)],importedDatasets:[dataset]}))).toBe(true);
 const original=structuredClone(loadDashboardWorkspace()),host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 try{
  await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('details.export-menu'));
  await act(async()=>document.querySelector<HTMLDetailsElement>('details.export-menu')!.open=true);await click('Review before exporting');await until(()=>!!document.querySelector('[aria-label="Embedded image readiness"]'));expect(ControlledImage.instances).toHaveLength(0);
  await click('Check embedded images now');expect(ControlledImage.instances).toHaveLength(1);await act(async()=>ControlledImage.instances[0].onload!());await until(()=>document.body.textContent?.includes('2 of 4 image placements decoded; 2 need review')??false);
  const region=document.querySelector('[aria-label="Embedded image readiness"]')!;expect(region.textContent).toContain('Image check second page');expect(region.textContent).toContain('Page background');expect(region.textContent).toContain('Not verified');expect(region.textContent).not.toContain('https://example.invalid');expect(fetch).not.toHaveBeenCalled();
  expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().reports.map(item=>item.draft)).toEqual(original.reports.map(item=>item.draft));expect(workspaceSaveSession.hasPending()).toBe(false);
  await click('Close review');await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('details.export-menu'));
  expect(document.querySelector('[aria-label="Embedded image readiness"]')).toBeNull();expect(loadDashboardWorkspace().importedDatasets).toEqual(original.importedDatasets);expect(loadDashboardWorkspace().reports.map(item=>item.draft)).toEqual(original.reports.map(item=>item.draft));
 }finally{await act(async()=>root.unmount());host.remove();workspaceSaveSession.remember(null);localStorage.clear();sessionStorage.clear();vi.unstubAllGlobals();}
},30_000);
