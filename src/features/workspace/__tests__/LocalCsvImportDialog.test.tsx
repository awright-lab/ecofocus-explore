import { normalizeImportedDataset } from '../../document/documentModel';
import { importDatasetBuffer } from '../../data/datasetImportModel';
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Blob, File } from "node:buffer";
import { LocalCsvImportDialog } from "../LocalCsvImportDialog";
import App from "../../../App";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../../document/workspacePersistence";
import { workspaceSaveSession } from "../../document/workspaceSaveSession";
import { createLocalCsvImportController, type CsvImportMessage, type CsvImportRequest } from "../../data/localCsvImportProtocol";
import type { LocalCsvWorker } from "../../data/localCsvImportJob";
import type { ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";

class Background implements LocalCsvWorker {
  static workers: Background[] = [];
  static hold = false;
  static startDelay = 0;
  onmessage: LocalCsvWorker['onmessage'] = null;
  onerror: LocalCsvWorker['onerror'] = null;
  onmessageerror: LocalCsvWorker['onmessageerror'] = null;
  stopped = false;
  controller = createLocalCsvImportController(message => queueMicrotask(() => { if (!this.stopped) this.onmessage?.({ data: structuredClone(message) } as MessageEvent<CsvImportMessage>); }));
  constructor() { Background.workers.push(this); }
  postMessage(message: CsvImportRequest) {
    if (Background.hold) return;
    if (message.type === 'start' && Background.startDelay) setTimeout(() => { if (!this.stopped) this.controller(message); }, Background.startDelay);
    else this.controller(message);
  }
  terminate() { this.stopped = true; }
}
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('Worker', Background);
  vi.stubGlobal('File', File); vi.stubGlobal('Blob', Blob); vi.stubGlobal('fetch', vi.fn());
  Background.workers = []; Background.hold = false; Background.startDelay = 0;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  localStorage.clear(); workspaceSaveSession.remember(null);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function click(text: string) {
  await act(async () => {
    const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent === text);
    if (!button) throw Error(`Missing ${text}`); button.click();
  });
}
async function until(check: () => boolean, stage = 'local import readiness') { await vi.waitFor(async () => { await act(async () => { await Promise.resolve(); }); expect(check(), `${stage}: ${document.body.textContent?.slice(-1400)}`).toBe(true); }, { timeout: 5000, interval: 10 }); }
async function choose(contents = 'Region,Score\nNorth,10\nSouth,20', name = 'local.csv') {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('[aria-labelledby="local-csv-title"] input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([contents], name)] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
it('reviews a complete local study before an explicit addition, protects drafts and makes no fetch call', async () => {
  const onAdd = vi.fn(async (_study: ImportedDatasetRecord) => true), onClose = vi.fn();
  await act(async () => root.render(<LocalCsvImportDialog onAdd={onAdd} onClose={onClose} />));
  expect(host.inert).toBe(true); expect(document.activeElement?.getAttribute('role')).toBe('dialog');
  await choose(); await until(() => !!document.querySelector('[aria-label="Parsed study"]'));
  expect(onAdd).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('2 rows · 2 fields');
  const unload = new Event('beforeunload', { cancelable: true }); await act(async () => { window.dispatchEvent(unload); }); expect(unload.defaultPrevented).toBe(true);
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Discard local import'); expect(onClose).not.toHaveBeenCalled();
  await click('Keep reviewing import'); await click('Add study to workspace');
  expect(onAdd).toHaveBeenCalledOnce(); expect(onAdd.mock.calls[0][0].rows).toEqual([{ Region: 'North', Score: '10' }, { Region: 'South', Score: '20' }]);
  expect(document.body.textContent).toContain('added and saved'); expect(fetch).not.toHaveBeenCalled();
});
it('cancels and unmounts without a partial addition or a late result', async () => {
  Background.hold = true; const onAdd = vi.fn(async () => true);
  await act(async () => root.render(<LocalCsvImportDialog onAdd={onAdd} onClose={vi.fn()} />));
  await choose(); await click('Cancel import'); expect(Background.workers[0].stopped).toBe(true);
  expect(document.body.textContent).toContain('No study was added');
  await choose(); await act(async () => root.render(<p>Other route</p>));
  expect(Background.workers[1].stopped).toBe(true); expect(onAdd).not.toHaveBeenCalled();
});
it('preserves the complete additive candidate through actual App quota failure, global retry and cold reopen', async () => {
  const baseline = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] });
  expect(saveDashboardWorkspace(baseline)).toBe(true); const original = structuredClone(loadDashboardWorkspace());
  window.history.replaceState(null, '', '/#/');
  let deny = false; const nativeSet = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (deny && key === workspaceStorageKey) throw new DOMException('Synthetic quota', 'QuotaExceededError');
    nativeSet.call(this, key, value);
  });
  await act(async () => root.render(<App />));
  await until(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Import local CSV'), 'Home ready');
  // Source completion is asynchronous; it is not a one-second performance contract.
  // This controlled delay makes the former default wait fail on a valid import.
  Background.startDelay = 1200;
  await click('Import local CSV'); await choose(); await until(() => !!document.querySelector('[aria-label="Parsed study"]'), 'Parsed source ready');
  deny = true; await click('Add study to workspace'); await until(() => workspaceSaveSession.getPending()?.importedDatasets.some(study => study.fileName === 'local.csv') ?? false, 'Complete import candidate pending');
  const pending = workspaceSaveSession.getPending()!;
  const added = pending.importedDatasets.find(study => study.fileName === 'local.csv')!;
  expect(added.rows).toEqual([{ Region: 'North', Score: '10' }, { Region: 'South', Score: '20' }]);
  expect(pending.reports).toEqual(original.reports);
  expect(pending.importedDatasets.filter(study => study.id !== added.id)).toEqual(original.importedDatasets);
  expect(loadDashboardWorkspace()).toEqual(original);
  expect(document.querySelector('[aria-labelledby="local-csv-title"]')!.textContent).toContain('workspace saving failed');
  await click('Close local import'); deny = false; await click('Retry saving'); await until(() => !workspaceSaveSession.hasPending());
  const cold = loadDashboardWorkspace().importedDatasets.find(study => study.id === added.id)!;
  expect({ ...cold, notes: added.notes }).toEqual(added);
  expect(cold.notes).toEqual([...added.notes, 'Stored compactly in report drafts; full imported rows are kept at workspace level.']);
  const analysis = runImportedDatasetQuery({ dataset: cold, field: cold.fields[0], measureField: cold.fields[1], metric: 'average', chartType: 'table' });
  expect(analysis.table.find(row => row.label === 'North')!.values[analysis.columns[0].id]).toBe(10);
  expect(analysis.table.find(row => row.label === 'South')!.values[analysis.columns[0].id]).toBe(20);
  expect(loadDashboardWorkspace().reports).toEqual(original.reports);
  await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host);
  await act(async () => root.render(<App />)); await until(() => !!document.querySelector('.workspace-home-header__actions'));
  expect(loadDashboardWorkspace().importedDatasets.find(study => study.id === added.id)).toEqual(cold);
  expect(fetch).not.toHaveBeenCalled();
}, 15_000);

async function existingLocalStudy(){const{dataset}=await importDatasetBuffer(new TextEncoder().encode('Region,Score\nNorth,10\nSouth,20').buffer,'local.csv');if(!dataset)throw Error('fixture');dataset.id='existing-local-study';dataset.importedAt='2025-01-02T03:04:05Z';return normalizeImportedDataset(dataset,0);}
function action(label:string){const node=Array.from(document.querySelectorAll('button')).find(n=>n.textContent===label);if(!node)throw Error(label);return node;}
it('offers the exact existing copy before any write, keeps preview protection, and reuses without claiming a new save',async()=>{const existing=await existingLocalStudy(),before=structuredClone(existing),onAdd=vi.fn(async()=>true),show=vi.fn(()=>true),close=vi.fn();await act(async()=>root.render(<LocalCsvImportDialog studies={[existing]} onAdd={onAdd} onShowExisting={show} onClose={close}/>));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));action('Add study to workspace').focus();await click('Add study to workspace');expect(document.querySelector('[aria-label="Existing-copy review"]')).not.toBeNull();expect(document.activeElement?.getAttribute('aria-label')).toBe('Parsed study');expect(onAdd).not.toHaveBeenCalled();const unload=new Event('beforeunload',{cancelable:true});await act(async()=>window.dispatchEvent(unload));expect(unload.defaultPrevented).toBe(true);await click('Show existing study');expect(show).toHaveBeenCalledExactlyOnceWith(existing.id);expect(onAdd).not.toHaveBeenCalled();expect(document.body.textContent).toContain('No additional study was added or saved');expect(existing).toEqual(before);expect(localStorage.length).toBe(0);await click('Close local import');expect(close).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();});
it('makes a deliberate separate copy only once and keeps focus during and after its save',async()=>{const existing=await existingLocalStudy(),before=structuredClone(existing);let finish:(saved:boolean)=>void=()=>{};const gate=new Promise<boolean>(resolve=>finish=resolve),onAdd=vi.fn(async(_dataset:ImportedDatasetRecord)=>gate);await act(async()=>root.render(<LocalCsvImportDialog studies={[existing]} onAdd={onAdd} onClose={()=>{}}/>));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');const copy=action('Import as a separate study');copy.focus();await act(async()=>{copy.click();copy.click();});expect(onAdd).toHaveBeenCalledOnce();expect(onAdd.mock.calls[0][0].id).not.toBe(existing.id);expect(onAdd.mock.calls[0][0].rows).toEqual(existing.rows);expect(document.activeElement).toBe(copy);await choose();expect(Background.workers).toHaveLength(1);await act(async()=>finish(true));expect(document.body.textContent).toContain('added and saved');expect(document.activeElement?.getAttribute('aria-label')).toBe('Parsed study');expect(existing).toEqual(before);});
it.each(['changed','removed','replacement','version stamp']as const)('rechecks the chosen existing study instead of silently rebinding it after it is %s',async kind=>{const existing=await existingLocalStudy(),onAdd=vi.fn(async()=>true),show=vi.fn(()=>true);const render=(studies:ImportedDatasetRecord[])=>root.render(<LocalCsvImportDialog studies={studies} onAdd={onAdd} onShowExisting={show} onClose={()=>{}}/>);await act(async()=>render([existing]));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');let next=[structuredClone(existing)];if(kind==='changed')next[0].rows[0].Region='Changed';if(kind==='removed')next=[];if(kind==='version stamp')next[0].importedAt='2026-04-05T06:07:08Z';if(kind==='replacement'){next[0].id='replacement-id';next[0].sourceRef={...next[0].sourceRef!,id:'imported:replacement-id',datasetId:'replacement-id'};}await act(async()=>render(next));action('Show existing study').focus();await click('Show existing study');expect(show).not.toHaveBeenCalled();expect(onAdd).not.toHaveBeenCalled();expect(document.querySelector('[role="alert"]')!.textContent).toContain('changed or is no longer');expect(document.activeElement?.getAttribute('aria-label')).toBe('Parsed study');expect(document.querySelector('[aria-label="Parsed study"]')).not.toBeNull();});
it('asks for an explicit separate import when the check is unverified, never treating it as no match',async()=>{const existing=await existingLocalStudy(),onAdd=vi.fn(async()=>true);await act(async()=>root.render(<LocalCsvImportDialog studies={Array.from({length:1001},()=>existing)} onAdd={onAdd} onClose={()=>{}}/>));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');expect(document.body.textContent).toContain('could not finish');expect(onAdd).not.toHaveBeenCalled();await click('Import as a separate study');expect(onAdd).toHaveBeenCalledOnce();});
it('preserves differently labeled metadata as a separate study even when raw rows match',async()=>{const existing=await existingLocalStudy(),before=structuredClone(existing),onAdd=vi.fn(async()=>true);existing.fields[0].label='Reviewed region label';await act(async()=>root.render(<LocalCsvImportDialog studies={[existing]} onAdd={onAdd} onClose={()=>{}}/>));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');expect(onAdd).toHaveBeenCalledOnce();expect(document.querySelector('[aria-label="Existing-copy review"]')).toBeNull();expect(existing.rows).toEqual(before.rows);expect(existing.fields[0].label).toBe('Reviewed region label');});
it('restores the file chooser after discarding a focused duplicate preview',async()=>{const existing=await existingLocalStudy();await act(async()=>root.render(<LocalCsvImportDialog studies={[existing]} onAdd={async()=>true} onClose={()=>{}}/>));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');action('Discard preview and choose another file').focus();await click('Discard preview and choose another file');expect(document.querySelector('[aria-label="Parsed study"]')).toBeNull();expect(document.activeElement?.getAttribute('type')).toBe('file');const unload=new Event('beforeunload',{cancelable:true});await act(async()=>window.dispatchEvent(unload));expect(unload.defaultPrevented).toBe(false);});
it('does not steal focus from another connected control after an add finishes',async()=>{let finish:(saved:boolean)=>void=()=>{};const gate=new Promise<boolean>(resolve=>finish=resolve);await act(async()=>root.render(<LocalCsvImportDialog onAdd={async()=>gate} onClose={()=>{}}/>));await choose();await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));action('Add study to workspace').focus();await click('Add study to workspace');const modal=document.querySelector<HTMLElement>('[aria-labelledby="local-csv-title"]')!;modal.focus();await act(async()=>finish(true));expect(document.activeElement).toBe(modal);expect(document.body.textContent).toContain('added and saved');});

async function heldImport(onAdd=vi.fn(async(_dataset:ImportedDatasetRecord)=>true)) {
  Background.hold=true;
  const requests=vi.spyOn(Background.prototype,'postMessage');
  await act(async()=>root.render(<LocalCsvImportDialog onAdd={onAdd} onClose={()=>{}}/>));
  await choose();
  const worker=Background.workers[0],start=requests.mock.calls.find(([message])=>message.type==='start')![0];
  return {worker,start,onAdd,async complete(){Background.hold=false;await act(async()=>worker.controller(start));await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));},async fail(){await act(async()=>worker.onerror?.({message:'Synthetic parser failure'} as ErrorEvent));}};
}
it('hands a focused import Cancel to the parsed study after real parser completion',async()=>{
  const pending=await heldImport();action('Cancel import').focus();await pending.complete();
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Parsed study');expect(pending.onAdd).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('hands a focused import Cancel to the enabled file chooser after worker failure',async()=>{
  const pending=await heldImport();action('Cancel import').focus();await pending.fail();
  const input=document.querySelector<HTMLInputElement>('[aria-labelledby="local-csv-title"] input[type="file"]')!;
  expect(document.activeElement).toBe(input);expect(input.disabled).toBe(false);expect(pending.worker.stopped).toBe(true);expect(pending.onAdd).not.toHaveBeenCalled();expect(document.querySelector('[role="alert"]')).not.toBeNull();
});
it('hands explicit cancellation to the enabled file chooser without adding a partial study',async()=>{
  const pending=await heldImport();action('Cancel import').focus();await click('Cancel import');
  expect(document.activeElement?.getAttribute('type')).toBe('file');expect(pending.worker.stopped).toBe(true);expect(pending.onAdd).not.toHaveBeenCalled();
  const unload=new Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);expect(unload.defaultPrevented).toBe(false);
});
it.each(['completion','failure']as const)('does not take focus from another connected dialog control on import %s',async outcome=>{
  const pending=await heldImport(),close=action('Close local import');action('Cancel import').focus();close.focus();
  if(outcome==='completion')await pending.complete();else await pending.fail();expect(document.activeElement).toBe(close);expect(pending.onAdd).not.toHaveBeenCalled();
});
it('preserves discard-confirmation focus while a parser completes',async()=>{
  const pending=await heldImport();action('Cancel import').focus();await click('Close local import');
  const warning=document.querySelector<HTMLElement>('[aria-label="Discard local import"]')!;expect(document.activeElement).toBe(warning);await pending.complete();expect(document.activeElement).toBe(warning);expect(pending.onAdd).not.toHaveBeenCalled();
});
it('does not steal deliberately cleared focus when parsing finishes',async()=>{
  const pending=await heldImport();action('Cancel import').focus();action('Cancel import').blur();expect(document.activeElement).toBe(document.body);await pending.complete();expect(document.activeElement).toBe(document.body);
});
it('restores the launch control on unmount and ignores a late parser completion',async()=>{
  const launch=document.createElement('button');launch.textContent='Launch import';document.body.append(launch);launch.focus();
  try {const pending=await heldImport();action('Cancel import').focus();await act(async()=>root.render(<p>Other route</p>));expect(pending.worker.stopped).toBe(true);expect(document.activeElement).toBe(launch);Background.hold=false;await act(async()=>pending.worker.controller(pending.start));expect(document.activeElement).toBe(launch);expect(document.querySelector('[aria-labelledby="local-csv-title"]')).toBeNull();expect(pending.onAdd).not.toHaveBeenCalled();}
  finally {launch.remove();}
});
it('ignores a late completion after explicit cancellation without moving recovered focus',async()=>{
  const pending=await heldImport();action('Cancel import').focus();await click('Cancel import');const input=document.activeElement;
  Background.hold=false;await act(async()=>pending.worker.controller(pending.start));expect(document.activeElement).toBe(input);expect(input?.getAttribute('type')).toBe('file');expect(document.querySelector('[aria-label="Parsed study"]')).toBeNull();expect(pending.onAdd).not.toHaveBeenCalled();
});
it('keeps actual App import focus inside a1000x30 parser workflow and preserves existing reports through save and cold reopen',async()=>{
  Background.hold=true;const requests=vi.spyOn(Background.prototype,'postMessage');
  const baseline=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]});expect(saveDashboardWorkspace(baseline)).toBe(true);const original=structuredClone(loadDashboardWorkspace()),raw=localStorage.getItem(workspaceStorageKey);window.history.replaceState(null,'','/#/');
  await act(async()=>root.render(<App/>));await until(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Import local CSV'));await click('Import local CSV');
  const columns=Array.from({length:30},(_,i)=>'Column'+i),text=[columns.join(','),...Array.from({length:1000},(_,i)=>columns.map((_,j)=>String((i+j)%17)).join(','))].join('\n');await choose(text,'synthetic-focus1000x30.csv');action('Cancel import').focus();
  const worker=Background.workers[0],start=requests.mock.calls.find(([message])=>message.type==='start')![0];Background.hold=false;await act(async()=>worker.controller(start));await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));
  const panel=document.querySelector<HTMLElement>('[aria-label="Parsed study"]')!;expect(document.activeElement).toBe(panel);expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);expect(loadDashboardWorkspace()).toEqual(original);
  await act(async()=>panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true})));expect(loadDashboardWorkspace()).toEqual(original);
  action('Add study to workspace').focus();await click('Add study to workspace');await until(()=>document.body.textContent?.includes('added and saved')===true);expect(document.activeElement).toBe(panel);
  const saved=structuredClone(loadDashboardWorkspace()),added=saved.importedDatasets.find(dataset=>dataset.fileName==='synthetic-focus1000x30.csv')!;
  expect(added.rowCount).toBe(1000);expect(added.fields).toHaveLength(30);expect(added.rows).toEqual(Array.from({length:1000},(_,i)=>Object.fromEntries(columns.map((column,j)=>[column,String((i+j)%17)]))));expect(saved.reports).toEqual(original.reports);expect(saved.importedDatasets.filter(dataset=>dataset.id!==added.id)).toEqual(original.importedDatasets);expect(saved.publishedSnapshots).toEqual(original.publishedSnapshots);expect(workspaceSaveSession.hasPending()).toBe(false);
  await click('Close local import');await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Import local CSV'));
  expect(loadDashboardWorkspace()).toEqual(saved);expect(fetch).not.toHaveBeenCalled();
},45000);

it('actual App avoids a repeated1000x30 study write, then preserves an explicit copy through quota recovery and cold reopen',async()=>{
 sessionStorage.clear();vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 const extras=Array.from({length:28},(_,i)=>`Extra${i}`),csv=[['Region','Score',...extras].join(','),...Array.from({length:1000},(_,i)=>[i%2?'South':'North',String(i%11),...extras.map((_,j)=>String((i+j)%13))].join(','))].join('\n');
 const{dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'repeat-study.csv');if(!dataset)throw Error('fixture');dataset.id='original-repeat-study';dataset.importedAt='2025-01-02T03:04:05Z';const draft=structuredClone(initialDashboard);draft.id='duplicate-original-report';draft.pages=draft.pages.slice(0,1);draft.pages[0].elements=[];draft.pages[0].tiles=draft.pages[0].tiles.slice(0,1);const tile=draft.pages[0].tiles[0],result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric:'average',chartType:'table'});Object.assign(tile,{title:'Original study means',visualization:'table',query:result.query,result,source:{kind:'importedField',id:'original-repeat-source',datasetId:dataset.id,fieldId:dataset.fields[0].id,label:'Region'}});
 expect(saveDashboardWorkspace(normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]}))).toBe(true);const original=structuredClone(loadDashboardWorkspace()),stored=localStorage.getItem(workspaceStorageKey),old=original.importedDatasets.find(s=>s.id===dataset.id)!;window.history.replaceState(null,'','/#/');await act(async()=>root.render(<App/>));await until(()=>Array.from(document.querySelectorAll('button')).some(n=>n.textContent==='Import local CSV'));
 await click('Import local CSV');await choose(csv,'repeat-study.csv');await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');expect(document.querySelector('[aria-label="Existing-copy review"]')!.textContent).toContain('identical local study');expect(loadDashboardWorkspace()).toEqual(original);expect(localStorage.getItem(workspaceStorageKey)).toBe(stored);expect(workspaceSaveSession.hasPending()).toBe(false);action('Show existing study').focus();await click('Show existing study');await until(()=>document.activeElement?.getAttribute('data-local-study-id')===old.id);expect(document.querySelector('[aria-labelledby="local-csv-title"]')).toBeNull();expect(loadDashboardWorkspace()).toEqual(original);expect(localStorage.getItem(workspaceStorageKey)).toBe(stored);
 await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>Array.from(document.querySelectorAll('button')).some(n=>n.textContent==='Import local CSV'));expect(loadDashboardWorkspace()).toEqual(original);
 let deny=false;const nativeSet=Storage.prototype.setItem;vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(deny&&key===workspaceStorageKey)throw new DOMException('Synthetic quota','QuotaExceededError');nativeSet.call(this,key,value);});
 await click('Import local CSV');await choose(csv,'repeat-study.csv');await until(()=>!!document.querySelector('[aria-label="Parsed study"]'));await click('Add study to workspace');expect(document.querySelector('[aria-label="Existing-copy review"]')).not.toBeNull();deny=true;await click('Import as a separate study');await until(()=>!!workspaceSaveSession.getPending()?.importedDatasets.some(s=>s.id!==old.id&&s.fileName===old.fileName));const pending=workspaceSaveSession.getPending()!,copy=pending.importedDatasets.find(s=>s.id!==old.id&&s.fileName===old.fileName)!;expect(pending.importedDatasets).toHaveLength(2);expect(pending.importedDatasets.find(s=>s.id===old.id)).toEqual(old);expect(copy.rows).toEqual(old.rows);expect(copy.fields).toEqual(old.fields);expect(pending.reports).toEqual(original.reports);expect(loadDashboardWorkspace()).toEqual(original);expect(localStorage.getItem(workspaceStorageKey)).toBe(stored);expect(document.querySelector('[aria-labelledby="local-csv-title"]')!.textContent).toContain('workspace saving failed');await click('Close local import');deny=false;await click('Retry saving');await until(()=>!workspaceSaveSession.hasPending());const saved=structuredClone(loadDashboardWorkspace());expect(saved.importedDatasets).toHaveLength(2);expect(saved.importedDatasets.find(s=>s.id===old.id)).toEqual(old);expect(saved.importedDatasets.find(s=>s.id===copy.id)!.rows).toEqual(old.rows);expect(saved.reports).toEqual(original.reports);
 await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);await act(async()=>root.render(<App/>));await until(()=>!!document.querySelector('.workspace-home-header__actions'));expect(loadDashboardWorkspace()).toEqual(saved);expect(fetch).not.toHaveBeenCalled();sessionStorage.clear();
},60_000);
