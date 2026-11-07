// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {NumericFieldProfile} from '../NumericFieldProfile';
import {importDatasetBuffer} from '../../../data/datasetImportModel';
import {buildNumericProfileFromValues} from '../../../data/importedNumericProfile';
import {createReportRecord,normalizeDashboardWorkspace,saveDashboardWorkspace,loadDashboardWorkspace} from '../../../document/workspacePersistence';
import {initialDashboard} from '../../../document/documentSeeds';
import {workspaceSaveSession} from '../../../document/workspaceSaveSession';
afterEach(()=>{workspaceSaveSession.remember(null);localStorage.clear();vi.useRealTimers();vi.unstubAllGlobals();});
it.each([5,5000])('shows recovered mean and retained total warning through profile, save and cold reopen for %i synthetic responses',async count=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn());localStorage.clear();workspaceSaveSession.remember(null);
 const pattern=['-1e308','-1e308','1','1e308','1e308'],csv=['Amount,Unrelated',...Array.from({length:count},(_,i)=>`${pattern[i%5]},kept-${i}`)].join('\n');
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic-profile-overflow.csv');if(!dataset)throw Error('fixture');
 const before=structuredClone(dataset),draft=structuredClone(initialDashboard);draft.importedDatasets=[dataset];
 expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]}))).toBe(true);
 const saved=structuredClone(loadDashboardWorkspace()),savedBytes=JSON.stringify(saved),storageBefore=JSON.stringify(localStorage);
 // A deterministic transport only: the actual job/preparation/model/component run,
 // while native Worker scheduling is outside this jsdom acceptance.
 const workers:Array<{request?:{values:string[]};onmessage:((e:MessageEvent)=>void)|null;terminate:ReturnType<typeof vi.fn>}>=[];
 class Transport{onmessage:((e:MessageEvent)=>void)|null=null;onerror=null;onmessageerror=null;request?:{values:string[]};terminate=vi.fn();constructor(){workers.push(this);}postMessage(request:{values:string[]}){this.request=request;}}
 vi.stubGlobal('Worker',Transport);const host=document.createElement('div');document.body.append(host);let root=createRoot(host);
 const statistic=(label:string)=>Array.from(host.querySelectorAll('dt')).find(n=>n.textContent===label)?.nextElementSibling?.textContent;
 async function render(){const reopened=loadDashboardWorkspace().importedDatasets[0];await act(async()=>root.render(<NumericFieldProfile dataset={reopened} field={reopened.fields[0]}/>));if(count>=5000){await act(async()=>{await vi.advanceTimersByTimeAsync(100);});const worker=workers.at(-1)!;expect(worker.request!.values).toEqual(before.rows.map(row=>row.Amount));await act(async()=>worker.onmessage!({data:{type:'complete',profile:buildNumericProfileFromValues(worker.request!.values)}}as MessageEvent));expect(worker.terminate).toHaveBeenCalledOnce();}}
 try{if(count>=5000)vi.useFakeTimers();await render();expect(statistic('Mean')).toBe('0.2');expect(statistic('Median')).toBe('1');expect(statistic('Total')).toBe('Unavailable');expect(statistic('Valid numeric values')).toBe(count.toLocaleString('en-US'));expect(host.textContent).toContain('total could not be represented safely');expect(host.textContent).not.toContain('mean cannot be verified after total overflow');
  expect(dataset).toEqual(before);expect(JSON.stringify(loadDashboardWorkspace())).toBe(savedBytes);expect(JSON.stringify(localStorage)).toBe(storageBefore);
  await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await render();expect(statistic('Mean')).toBe('0.2');expect(loadDashboardWorkspace().importedDatasets[0]).toEqual(saved.importedDatasets[0]);expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(before.rows);expect(JSON.stringify(loadDashboardWorkspace())).toBe(savedBytes);expect(JSON.stringify(localStorage)).toBe(storageBefore);expect(fetch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
