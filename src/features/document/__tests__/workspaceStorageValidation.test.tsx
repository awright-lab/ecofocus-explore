// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../App';
import { WorkspaceLoadRecovery } from '../WorkspaceSaveRecovery';
import { createReportRecord, legacyWorkspaceStorageKey, loadDashboardWorkspace, normalizeDashboardWorkspace, readStoredWorkspaceCopy, saveDashboardWorkspace, workspaceStorageKey } from '../workspacePersistence';
import { workspaceSaveSession } from '../workspaceSaveSession';
import { initialDashboard } from '../documentSeeds';
import { storageKey } from '../../builder/builderConstants';
import { syntheticStudy, syntheticStudySums, expectedSyntheticSums } from './fixtures/syntheticStudy';
import { encodeImportedRows } from '../workspaceRowStorage';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); vi.stubGlobal('ResizeObserver',class {observe(){}unobserve(){}disconnect(){}});vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Synthetic test: no live services'))); });
afterEach(() => { workspaceSaveSession.remember(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function validWorkspace() { return normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))]}); }
const invalid = [
 ['invalid JSON', '{broken'], ['empty string',''], ['null JSON','null'], ['JSON array','[]'],
 ['missing reports', '{}'], ['empty reports', JSON.stringify({reports:[],importedDatasets:[{id:'valuable'}]})],
 ['missing report draft',JSON.stringify({reports:[{}]})],
 ['empty report pages',JSON.stringify({reports:[{draft:{pages:[]}}]})],
 ['invalid page object',JSON.stringify({reports:[{draft:{pages:[null]}}]})],
 ['incomplete page',JSON.stringify({reports:[{draft:{pages:[{}]}}]})],
 ['missing page tiles',JSON.stringify({reports:[{draft:{pages:[{elements:[]}]}}]})]
] as const;
describe.each([workspaceStorageKey,legacyWorkspaceStorageKey,storageKey])('current recovery of %s', key => {
 it.each(invalid)('rejects %s without replacing or hiding it', (_label,raw) => {
   localStorage.setItem(key,raw); const write=vi.spyOn(Storage.prototype,'setItem');
   expect(()=>loadDashboardWorkspace()).toThrow();
   expect(readStoredWorkspaceCopy()).toBe(raw); expect(localStorage.getItem(key)).toBe(raw); expect(write).not.toHaveBeenCalled();
 });
 it('App stays in recovery across timer and navigation and never autosaves defaults',async()=>{
   const raw='\r\n\t{damaged recovery copy: é 🌿\r\n'; localStorage.setItem(key,raw);
   const write=vi.spyOn(Storage.prototype,'setItem'); vi.useFakeTimers();
   const host=document.createElement('div'); document.body.append(host); const root=createRoot(host);
   try {
     await act(async()=>root.render(<App/>));
     await act(async()=>vi.advanceTimersByTime(10000));
     await act(async()=>{window.dispatchEvent(new HashChangeEvent('hashchange'));});
     expect(host.textContent).toContain('Your saved workspace needs attention');
     expect(host.querySelector('.builder-shell')).toBeNull(); expect(host.querySelector('.studio-home')).toBeNull();
     expect(localStorage.getItem(key)).toBe(raw); expect(readStoredWorkspaceCopy()).toBe(raw); expect(write).not.toHaveBeenCalled();
   } finally {await act(async()=>root.unmount());host.remove();}
 });
 it.each(['', '\r\n\t{broken: é 🌿\r\n\u0000'])('downloads the exact original UTF-8 bytes, including empty content (%j)',async(raw)=>{
   localStorage.setItem(key,raw);
   let captured: Blob | undefined;
   vi.stubGlobal('URL',class extends URL {static createObjectURL(blob:Blob){captured=blob;return 'blob:synthetic';}static revokeObjectURL(){}});
   const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
   const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
   try {
     await act(async()=>root.render(<WorkspaceLoadRecovery/>));
     await act(async()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Download saved workspace')!.click());
     expect(click).toHaveBeenCalledOnce(); expect(captured).toBeDefined();
     const bytes=await new Promise<Uint8Array>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(new Uint8Array(reader.result as ArrayBuffer));reader.onerror=reject;reader.readAsArrayBuffer(captured!);});
     expect([...bytes]).toEqual([...new TextEncoder().encode(raw)]); expect(localStorage.getItem(key)).toBe(raw);
   } finally {await act(async()=>root.unmount());host.remove();}
 });
});

it.each([workspaceStorageKey,legacyWorkspaceStorageKey])('does not fall back past damaged %s to a valid older source',key=>{
 localStorage.setItem(storageKey,JSON.stringify(initialDashboard));
 if(key===workspaceStorageKey)localStorage.setItem(legacyWorkspaceStorageKey,JSON.stringify(validWorkspace()));
 localStorage.setItem(key,''); expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe('');expect(localStorage.getItem(key)).toBe('');
});
it('fails closed on blocked storage reads',()=>{const write=vi.spyOn(Storage.prototype,'setItem');vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Synthetic read denied');});expect(()=>loadDashboardWorkspace()).toThrow('Synthetic read denied');expect(write).not.toHaveBeenCalled();});
it.each([legacyWorkspaceStorageKey,storageKey])('migrates valid %s, retains original bytes, exact rows and sums, and reopens v2',async(key)=>{
 const {dataset}=await syntheticStudy(1000,30);
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord({...structuredClone(initialDashboard),importedDatasets:[dataset]})],importedDatasets:[dataset]});
 const raw=JSON.stringify(key===storageKey?workspace.reports[0].draft:workspace,null,2)+'\r\n';localStorage.setItem(key,raw);
 expect(readStoredWorkspaceCopy()).toBe(raw);const loaded=loadDashboardWorkspace();expect(loaded.importedDatasets[0].rows).toEqual(dataset.rows);expect(syntheticStudySums(loaded.importedDatasets[0])).toEqual(expectedSyntheticSums(1000));
 expect(saveDashboardWorkspace(loaded)).toBe(true);expect(localStorage.getItem(key)).toBe(raw);const reloaded=loadDashboardWorkspace();expect(reloaded.importedDatasets[0].rows).toEqual(dataset.rows);expect(syntheticStudySums(reloaded.importedDatasets[0])).toEqual(expectedSyntheticSums(1000));
});
it.each([workspaceStorageKey,legacyWorkspaceStorageKey])('rejects malformed encoded respondent data in %s and preserves it',async(key)=>{
 const {dataset}=await syntheticStudy(100,30);const packed=encodeImportedRows(dataset);packed.rowStorage!.values[0].pop();const raw=JSON.stringify({...validWorkspace(),importedDatasets:[packed]});localStorage.setItem(key,raw);expect(()=>loadDashboardWorkspace()).toThrow('unsupported or damaged');expect(readStoredWorkspaceCopy()).toBe(raw);
});


it('rejects missing v2 importedDatasets without hiding a complete older study',async()=>{
 const {dataset}=await syntheticStudy(100,30);const older=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))],importedDatasets:[dataset]});const olderRaw=JSON.stringify(older);localStorage.setItem(legacyWorkspaceStorageKey,olderRaw);
 const damaged=validWorkspace() as Partial<ReturnType<typeof validWorkspace>>;delete damaged.importedDatasets;const raw=JSON.stringify(damaged);localStorage.setItem(workspaceStorageKey,raw);
 expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe(raw);expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);expect(localStorage.getItem(legacyWorkspaceStorageKey)).toBe(olderRaw);
});
it('rejects an incomplete v2 study instead of fabricating empty metadata',()=>{
 const raw=JSON.stringify({...validWorkspace(),importedDatasets:[{id:'damaged-study'}]});localStorage.setItem(workspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow('saved imported study');expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
});
it.each(['missing collection','incomplete study'])('App recovers from %s without editor autosave or fallback',async(kind)=>{
 const {dataset}=await syntheticStudy(100,30);const older=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))],importedDatasets:[dataset]});const olderRaw=JSON.stringify(older);localStorage.setItem(legacyWorkspaceStorageKey,olderRaw);
 const damaged:Record<string,unknown>={...validWorkspace()};if(kind==='missing collection')delete damaged.importedDatasets;else damaged.importedDatasets=[{id:'damaged-study'}];const raw=JSON.stringify(damaged);localStorage.setItem(workspaceStorageKey,raw);
 window.history.replaceState(null,'','#/reports/'+older.reports[0].id);vi.useFakeTimers();
 const write=vi.spyOn(Storage.prototype,'setItem');const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<App/>));await act(async()=>vi.advanceTimersByTime(10000));
  expect(host.textContent).toContain('Your saved workspace needs attention');expect(host.querySelector('.builder-shell')).toBeNull();
  expect(write).not.toHaveBeenCalled();expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);expect(localStorage.getItem(legacyWorkspaceStorageKey)).toBe(olderRaw);
 } finally {await act(async()=>root.unmount());host.remove();}
});

const badStudyCases: Array<[string,(study: Record<string,unknown>)=>void]> = [
 ['missing fields',s=>{delete s.fields;}],
 ['invalid source column',s=>{s.fields=[{...(s.fields as object[])[0],sourceColumn:42}];}],
 ['empty field id',s=>{s.fields=[{...(s.fields as object[])[0],id:''}];}],
 ['duplicate field id',s=>{const fields=s.fields as Array<Record<string,unknown>>;fields[1].id=fields[0].id;}],['missing declared total',s=>{delete s.rowCount;}],
 ['negative total',s=>{s.rowCount=-1;}],['fractional total',s=>{s.rowCount=1.5;}],
 ['null rows',s=>{s.rows=null;}],['nonstring cell',s=>{s.rows=[{Region:42}];}],
 ['invalid preview',s=>{s.previewRows=[null];}],['null field',s=>{s.fields=[null];}],
 ['unknown field type',s=>{s.fields=[{...(s.fields as object[])[0],type:'unknown'}];}],
 ['invalid field count',s=>{s.fieldCount=-1;}],['invalid field samples',s=>{s.fields=[{...(s.fields as object[])[0],sampleValues:42}];}],
 ['invalid value labels',s=>{s.fields=[{...(s.fields as object[])[0],valueLabels:{yes:3}}];}],
 ['invalid remote payload',s=>{s.remote={provider:'netlify'};}],
 ['invalid source reference',s=>{s.sourceRef={id:42};}],
 ['invalid import status',s=>{s.importStatus='ready';}],['invalid import metadata',s=>{s.importMetadata={};}],
 ['more rows than declared',s=>{s.rowCount=0;}],
 ['conflicting encoded and plain rows',s=>{s.rowStorage={version:1,columns:['Region'],values:[['North']]};}]
];
describe.each([workspaceStorageKey,legacyWorkspaceStorageKey,storageKey])('study validation in %s',key=>{
 it.each(badStudyCases)('rejects %s and preserves the raw copy',async(_label,damage)=>{
  const {dataset}=await syntheticStudy(100,30);const study=structuredClone(dataset) as unknown as Record<string,unknown>;damage(study);
  const payload=key===storageKey?{...structuredClone(initialDashboard),importedDatasets:[study]}:{...validWorkspace(),importedDatasets:[study]};const raw=JSON.stringify(payload);localStorage.setItem(key,raw);const write=vi.spyOn(Storage.prototype,'setItem');
  expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe(raw);expect(write).not.toHaveBeenCalled();
 });
});
it.each(['importedDatasets','datasetConnections','liveDatasetSources','publishedSnapshots'] as const)('rejects a missing v2 %s collection',key=>{
 const workspace=validWorkspace() as Partial<ReturnType<typeof validWorkspace>>;delete workspace[key];const raw=JSON.stringify(workspace);localStorage.setItem(workspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe(raw);
});
it.each(['draft','snapshot'] as const)('validates embedded studies in a %s',async(location)=>{
 const {dataset}=await syntheticStudy(100,30);const workspace=validWorkspace();
 const damaged={...structuredClone(initialDashboard),importedDatasets:[{id:dataset.id}]} as unknown as typeof initialDashboard;
 if(location==='draft')workspace.reports[0].draft=damaged;else workspace.publishedSnapshots=[{id:'snapshot',reportId:workspace.reports[0].id,title:'Synthetic',versionLabel:'v1',publishedAt:'2026-01-01',viewerPath:'#/published',dashboard:damaged}];
 const raw=JSON.stringify(workspace);localStorage.setItem(workspaceStorageKey,raw);expect(()=>loadDashboardWorkspace()).toThrow();expect(readStoredWorkspaceCopy()).toBe(raw);
});
it('retains v1 missing-collection compatibility and embedded complete study data',async()=>{
 const {dataset}=await syntheticStudy(100,30);const workspace=validWorkspace() as Partial<ReturnType<typeof validWorkspace>>;workspace.reports![0].draft.importedDatasets=[dataset];delete workspace.importedDatasets;delete workspace.datasetConnections;delete workspace.liveDatasetSources;delete workspace.publishedSnapshots;
 const raw=JSON.stringify(workspace);localStorage.setItem(legacyWorkspaceStorageKey,raw);const loaded=loadDashboardWorkspace();expect(loaded.importedDatasets[0].rows).toEqual(dataset.rows);expect(saveDashboardWorkspace(loaded)).toBe(true);expect(localStorage.getItem(legacyWorkspaceStorageKey)).toBe(raw);expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows);
});
it.each([legacyWorkspaceStorageKey,storageKey])('retains historical preview-only and sparse field metadata in %s',key=>{
 const study={id:'legacy-study',rowCount:100,fields:[{label:'Region'}],previewRows:[{Region:'North'},{Region:'South'}]};const payload=key===storageKey?{...structuredClone(initialDashboard),importedDatasets:[study]}:{...validWorkspace(),importedDatasets:[study]};
 const raw=JSON.stringify(payload);localStorage.setItem(key,raw);const loaded=loadDashboardWorkspace();expect(loaded.importedDatasets[0].rowCount).toBe(100);expect(loaded.importedDatasets[0].rows).toEqual(study.previewRows);expect(loaded.importedDatasets[0].fields[0].sourceColumn).toBe('Region');expect(saveDashboardWorkspace(loaded)).toBe(true);expect(localStorage.getItem(key)).toBe(raw);expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(study.previewRows);
});
it('keeps valid pre-import single reports compatible when importedDatasets is absent',()=>{
 const draft=structuredClone(initialDashboard) as Partial<typeof initialDashboard>;delete draft.importedDatasets;localStorage.setItem(storageKey,JSON.stringify(draft));expect(loadDashboardWorkspace().reports[0].draft.title).toBe(draft.title);expect(loadDashboardWorkspace().importedDatasets).toEqual([]);
});
it('retains metadata-only local studies and compact remote field previews',async()=>{
 const {dataset}=await syntheticStudy(100,100);
 const metadata={...dataset,id:'metadata-only',rowCount:0,rows:[],previewRows:[]};
 const remote={...dataset,id:'server-study',remote:{provider:'netlify' as const,projectUrl:'',bucket:'',objectPath:'synthetic.csv',uploadedAt:dataset.importedAt,recordId:'synthetic'}};
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))],importedDatasets:[metadata,remote]});expect(saveDashboardWorkspace(workspace)).toBe(true);
 const loaded=loadDashboardWorkspace();expect(loaded.importedDatasets.find(s=>s.id==='metadata-only')?.rows).toEqual([]);expect(loaded.importedDatasets.find(s=>s.id==='server-study')?.fields).toHaveLength(80);expect(loaded.importedDatasets.find(s=>s.id==='server-study')?.fieldCount).toBe(100);
});
