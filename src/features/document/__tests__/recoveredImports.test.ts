import {expect,it,vi} from 'vitest';
import {createDeferredWorkspaceImports} from '../deferredWorkspaceImports';
import {prepareRecoveredImports} from '../recoveredImportModel';
import {normalizeDashboardWorkspace} from '../workspacePersistence';
import {syntheticStudy} from './fixtures/syntheticStudy';
import {normalizeImportedDataset} from '../documentModel';
import {previewPreparation} from '../../data-preparation/preparationModel';
const fixture=async()=>{const {dataset}=await syntheticStudy(100,4);return{dataset,workspace:normalizeDashboardWorkspace(undefined)};};

it('adds complete data without modifying any existing report, source or snapshot',async()=>{
 const {dataset,workspace}=await fixture(),original=structuredClone({dataset,workspace});const next=prepareRecoveredImports(workspace,[dataset]);
 expect(next.importedDatasets[0]).toMatchObject(dataset);expect(next.reports).toBe(workspace.reports);expect(next.publishedSnapshots).toBe(workspace.publishedSnapshots);expect({dataset,workspace}).toEqual(original);
});
it.each(['answers','row order','labels','notes','version','preview','title']as const)('refuses same-ID conflicting %s before replacing anything',async kind=>{
 const {dataset,workspace}=await fixture();workspace.importedDatasets=[dataset];const incoming=structuredClone(dataset);
 if(kind==='answers')incoming.rows[0].Spend='999';if(kind==='row order')incoming.rows.reverse();if(kind==='labels')incoming.fields[0].label='Changed';if(kind==='notes')incoming.notes.push('Different');if(kind==='version')incoming.importedAt='2020-01-01T00:00:00Z';if(kind==='preview')incoming.previewRows[0].Spend='999';if(kind==='title')incoming.title='Different title';
 const original=structuredClone({workspace,incoming});expect(()=>prepareRecoveredImports(workspace,[incoming])).toThrow(/different data/);expect({workspace,incoming}).toEqual(original);
});
it('treats reordered object keys and the known storage note as the same existing study, preserving its object',async()=>{
 const {dataset,workspace}=await fixture();const existing=structuredClone(dataset);existing.notes.push('Stored compactly in report drafts; full imported rows are kept at workspace level.');existing.previewRows=structuredClone(existing.previewRows.slice(0,25));workspace.importedDatasets=[existing];const incoming=Object.fromEntries(Object.entries(dataset).reverse()) as typeof dataset;expect(prepareRecoveredImports(workspace,[incoming])).toBe(workspace);expect(workspace.importedDatasets[0]).toBe(existing);
});
it('keeps two different pending copies sharing an ID, and refuses their ambiguous merge',async()=>{
 const {dataset,workspace}=await fixture(),other=structuredClone(dataset),store=createDeferredWorkspaceImports();other.rows[0].Spend='999';store.remember(dataset);store.remember(other);expect(store.getPending()).toEqual([dataset,other]);expect(()=>prepareRecoveredImports(workspace,store.capture().map(e=>e.dataset))).toThrow(/different data/);expect(store.getPending()).toHaveLength(2);
});
it('coalesces identical copied data only after an acknowledged addition',async()=>{
 const {dataset,workspace}=await fixture(),store=createDeferredWorkspaceImports();store.remember(dataset);store.remember(structuredClone(dataset));const captured=store.capture();expect(prepareRecoveredImports(workspace,captured.map(e=>e.dataset)).importedDatasets).toHaveLength(1);expect(store.getPending()).toHaveLength(2);expect(store.acknowledge(captured)).toBe(2);
});
it.each(['report','snapshot']as const)('does not rebind a missing study referenced by a %s',async scope=>{
 const {dataset,workspace}=await fixture(),draft=workspace.reports[0].draft;draft.pages[0].tiles[0].source={kind:'importedField',id:'missing',datasetId:dataset.id,fieldId:dataset.fields[0].id,label:'Missing'};
 if(scope==='snapshot'){workspace.publishedSnapshots=[{id:'historical',reportId:draft.id,dashboard:structuredClone(draft),publishedAt:'2020-01-01T00:00:00Z',versionLabel:'v1'} as typeof workspace.publishedSnapshots[number]];workspace.reports[0].draft.pages=[];}
 expect(()=>prepareRecoveredImports(workspace,[dataset])).toThrow(/missing study identity/);expect(workspace.importedDatasets).toHaveLength(0);
});
it('refuses unknown metadata instead of normalizing it out of a recovery copy',async()=>{
 const {dataset,workspace}=await fixture();Object.assign(dataset,{futureData:{keep:'original'}});expect(()=>prepareRecoveredImports(workspace,[dataset])).toThrow(/metadata cannot be preserved/);expect((dataset as unknown as{futureData:unknown}).futureData).toEqual({keep:'original'});
});
it('acknowledges only captured entries while a newer import remains pending',async()=>{
 const {dataset}=await fixture(),store=createDeferredWorkspaceImports();store.remember(dataset);const captured=store.capture(),newer=structuredClone(dataset);newer.id='newer';store.remember(newer);expect(store.acknowledge(captured)).toBe(1);expect(store.getPending()).toEqual([newer]);expect(Object.isFrozen(store.getPending())).toBe(true);
});
it('retains changed queued data after a pending save and keeps the captured copy unchanged',async()=>{
 const {dataset}=await fixture(),store=createDeferredWorkspaceImports();store.remember(dataset);const captured=store.capture(),original=dataset.rows[0].Spend;dataset.rows[0].Spend='999';expect(store.acknowledge(captured)).toBe(0);expect(store.getPending()[0].rows[0].Spend).toBe('999');expect(captured[0].dataset.rows[0].Spend).toBe(original);
});
it('does not reuse acknowledgement tokens after explicit teardown',async()=>{
 const {dataset}=await fixture(),store=createDeferredWorkspaceImports();store.remember(dataset);const old=store.capture();store.clear();store.remember(dataset);expect(store.acknowledge(old)).toBe(0);expect(store.getPending()).toEqual([dataset]);
});
it.each(['hook','accessor','hidden','sparse','nonfinite']as const)('refuses unsafe %s serialization without clearing the recovery copy or calling hooks',async kind=>{
 const {dataset}=await fixture(),store=createDeferredWorkspaceImports(),hook=vi.fn(()=>dataset);
 if(kind==='hook')Object.defineProperty(dataset,'toJSON',{value:hook});if(kind==='accessor')Object.defineProperty(dataset,'title',{get:hook,enumerable:true});if(kind==='hidden')Object.defineProperty(dataset,'hidden',{value:'data'});if(kind==='sparse')delete dataset.rows[2];if(kind==='nonfinite')dataset.fields[0].distinctCount=NaN;
 store.remember(dataset);expect(()=>store.capture()).toThrow();expect(hook).not.toHaveBeenCalled();expect(store.getPending()).toHaveLength(1);
});
it('refuses expanded JSON amplification before allocating a giant output string',async()=>{
 const {dataset}=await fixture(),store=createDeferredWorkspaceImports(),key='h'.repeat(100000);dataset.rows=Array.from({length:170},()=>({[key]:'1'}));dataset.rowCount=170;store.remember(dataset);expect(()=>store.capture()).toThrow(/budget/);expect(store.getPending()[0].rows).toHaveLength(170);
});
it.each(['remote rows','remote fields','preview']as const)('retains %s that the active save codec would otherwise compact',async kind=>{
 const{dataset}=await syntheticStudy(100,kind==='remote fields'?81:4),workspace=normalizeDashboardWorkspace(undefined);
 if(kind==='preview'){dataset.previewRows=structuredClone(dataset.rows.slice(0,26));dataset.rows=[];}
 else{dataset.sourceType='netlify';dataset.remote={provider:'netlify',projectUrl:'',bucket:'synthetic',objectPath:'fake.csv',uploadedAt:dataset.importedAt};dataset.sourceRef=undefined;if(kind==='remote fields'){dataset.rows=[];dataset.previewRows=[];}}
 const valid=normalizeImportedDataset(dataset,0),before=structuredClone(valid);expect(()=>prepareRecoveredImports(workspace,[valid])).toThrow(/would compact/);expect(valid).toEqual(before);expect(workspace.importedDatasets).toHaveLength(0);
});
it('does not collapse differing partial preview data that is absent from complete rows',async()=>{
 const{dataset,workspace}=await fixture();dataset.previewRows=structuredClone(dataset.rows.slice(0,25));dataset.rows=[];workspace.importedDatasets=[dataset];const incoming=structuredClone(dataset);incoming.previewRows[0].Spend='999';expect(()=>prepareRecoveredImports(workspace,[incoming])).toThrow(/different data/);expect(workspace.importedDatasets[0].previewRows[0].Spend).not.toBe('999');
});
it('does not rebind a missing original that a prepared copy depends on',async()=>{
 const{dataset,workspace}=await fixture(),prepared=await previewPreparation(dataset,[{id:'lowercase',fieldId:dataset.fields[1].id,sourceColumn:dataset.fields[1].sourceColumn,kind:'lowercase',from:[],to:''}],'Prepared copy',new AbortController().signal);workspace.importedDatasets=[prepared.dataset];expect(()=>prepareRecoveredImports(workspace,[dataset])).toThrow(/missing study identity/);expect(workspace.importedDatasets[0]).toBe(prepared.dataset);
});

it.each(['known codec','extra metadata'] as const)('refuses encoded %s at the recovery boundary without discarding its queued bytes',async kind=>{
 const {dataset,workspace}=await fixture(),{encodeImportedRows}=await import('../workspaceRowStorage'),incoming=encodeImportedRows(dataset),store=createDeferredWorkspaceImports();
 if(kind==='extra metadata')Object.assign(incoming.rowStorage!,{futureMetadata:{keep:'all original bytes'}});
 const original=JSON.stringify(incoming);store.remember(incoming);const captured=store.capture();
 expect(()=>prepareRecoveredImports(workspace,captured.map(entry=>entry.dataset))).toThrow(/decoded study records/);
 expect(JSON.stringify(incoming)).toBe(original);expect(JSON.stringify(store.getPending()[0])).toBe(original);expect(workspace.importedDatasets).toHaveLength(0);
});

it('promotes a matching report-only study before the real writer clears embedded rows, keeping source/history unchanged',async()=>{
 const {dataset,workspace}=await fixture();workspace.importedDatasets=[];workspace.reports[0].draft.importedDatasets=[dataset];const original=structuredClone(workspace),store=createDeferredWorkspaceImports();store.remember(dataset);const captured=store.capture(),next=prepareRecoveredImports(workspace,captured.map(entry=>entry.dataset));
 expect(next).not.toBe(workspace);expect(next.importedDatasets).toHaveLength(1);expect(next.importedDatasets[0].rows).toEqual(dataset.rows);expect(next.reports).toBe(workspace.reports);expect(store.getPending()).toHaveLength(1);
 let stored='';vi.stubGlobal('window',{localStorage:{setItem(_key:string,value:string){stored=value;}}});try{const {saveDashboardWorkspace}=await import('../workspacePersistence');expect(saveDashboardWorkspace(next)).toBe(true);}finally{vi.unstubAllGlobals();}
 const {decodeStoredWorkspaceSource}=await import('../workspacePersistence');const reopened=decodeStoredWorkspaceSource({key:'insightcanvas_report_workspace_v2',raw:stored});expect(reopened.importedDatasets[0].rows).toEqual(dataset.rows);expect(reopened.reports[0].draft.importedDatasets).toHaveLength(0);expect(workspace).toEqual(original);expect(store.acknowledge(captured)).toBe(1);
});
