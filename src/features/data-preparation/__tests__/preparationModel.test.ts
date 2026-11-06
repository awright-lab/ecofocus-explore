import { afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { PreparationStep } from "../../../../shared/types/dataPreparation";
import { assertStudyPreparation } from "../../../../shared/types/dataPreparation";
import { previewPreparation, preparationFingerprint, samePreparedStudy, verifyPreparedStudy } from "../preparationModel";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace, createPublishedSnapshot, removeWorkspaceImportedDataset } from "../../document/workspacePersistence";
afterEach(() => vi.unstubAllGlobals());
async function fixture() {
  vi.stubGlobal('crypto', webcrypto);
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode('ID,Answer,Other\n1,North,x\n2,NORTH,y\n3,South,z\n4,,q').buffer, 'synthetic-preparation.csv');
  dataset!.fields[1].type='categorical'; dataset!.fields[1].valueLabels={North:'Northern region',NORTH:'Northern region',South:'Southern region'}; return dataset!;
}
function step(source: Awaited<ReturnType<typeof fixture>>, kind: PreparationStep['kind'], from: string[] = [], to = ''): PreparationStep { return {id:`step-${kind}`,fieldId:source.fields[1].id,sourceColumn:'Answer',kind,from,to}; }
it('previews cleaning and many-to-one recoding with exact original preservation and valid analysis', async()=>{
  const source=await fixture(),before=structuredClone(source), steps=[step(source,'lowercase'),step(source,'recode',['north','south'],'Combined')];
  const result=await previewPreparation(source,steps,'Prepared synthetic'); expect(source).toEqual(before);expect(result.dataset.id).not.toBe(source.id);expect(result.dataset.rows.map(row=>row.Answer)).toEqual(['Combined','Combined','Combined','']);
  expect(result.steps.map(item=>item.changed)).toEqual([3,3]);expect(result.changedCells).toBe(3);expect(result.affectedRespondents).toBe(3);expect(result.dataset.fields[1].valueLabels).toEqual({});
  const query=runImportedDatasetQuery({dataset:result.dataset,field:result.dataset.fields[1],metric:'count',chartType:'table'});expect(query.table.find(row=>row.label==='Combined')?.values.summary).toBe(3);await verifyPreparedStudy(source,result.dataset);
});
it('supports recipe Undo/Redo by replaying immutable prefixes, with every unrelated cell preserved',async()=>{
 const source=await fixture(),a=step(source,'lowercase'),b=step(source,'recode',['north'],'N');const one=await previewPreparation(source,[a],'One'),two=await previewPreparation(source,[a,b],'Two'),undo=await previewPreparation(source,[a],'Undo'),redo=await previewPreparation(source,[a,b],'Redo');expect(undo.dataset.rows).toEqual(one.dataset.rows);expect(redo.dataset.rows).toEqual(two.dataset.rows);for(let i=0;i<4;i++){expect(two.dataset.rows[i].ID).toBe(source.rows[i].ID);expect(two.dataset.rows[i].Other).toBe(source.rows[i].Other);}
});
it('keeps blank distinct, supports explicit missing recodes, and handles prototype names safely',async()=>{
 const source=await fixture();source.rows[0].Answer='__proto__';const result=await previewPreparation(source,[step(source,'recode',['__proto__',''],'combined')],'Explicit');expect(result.dataset.rows.map(row=>row.Answer)).toEqual(['combined','NORTH','South','combined']);expect(result.dataset.fields[1].valueLabels).toEqual({North:'Northern region',NORTH:'Northern region',South:'Southern region'});const missing=await previewPreparation(source,[step(source,'recode',['South'],'')],'Missing');expect(missing.dataset.fields[1].nonEmptyCount).toBe(2);
});
it.each(['trim','uppercase','collapse_spaces'] as const)('cleans %s only on the chosen field',async kind=>{const source=await fixture();source.rows[0].Answer='  North   east  ';const result=await previewPreparation(source,[step(source,kind)],'Clean');expect(result.dataset.rows[0].Answer).toBe(kind==='trim'?'North   east':kind==='uppercase'?'  NORTH   EAST  ':'North east');expect(result.dataset.rows[0].Other).toBe('x');});
it.each(['remote','partial','too many rows','numeric','duplicate step','missing field','same identity','bad code','empty history','source drift','prepared drift'])( 'refuses %s without changing the original',async kind=>{
 const source=await fixture(),s=step(source,'lowercase');let steps=[s],id='fresh';if(kind==='remote')source.remote={provider:'netlify'} as never;if(kind==='partial')source.rowCount++;if(kind==='too many rows')source.rowCount=50001;if(kind==='numeric')source.fields[1].type='numeric';if(kind==='duplicate step')steps=[s,s];if(kind==='missing field')s.fieldId='gone';if(kind==='same identity')id=source.id;if(kind==='bad code'){s.kind='recode';s.from=['x'.repeat(513)];}if(kind==='empty history')steps=[];
 if(kind==='source drift'||kind==='prepared drift'){const result=await previewPreparation(source,steps,'Prepared');if(kind==='source drift')source.rows[0].Other='changed';else result.dataset.rows[0].Answer='fabricated';const before=structuredClone(source);await expect(verifyPreparedStudy(source,result.dataset)).rejects.toThrow();expect(source).toEqual(before);return;}
 const before=structuredClone(source);await expect(previewPreparation(source,steps,'Prepared',undefined,id)).rejects.toThrow();expect(source).toEqual(before);
});
it('fails explicitly without crypto and cancels before accepting a copy',async()=>{const source=await fixture();vi.stubGlobal('crypto',{});await expect(preparationFingerprint(source)).rejects.toThrow('unavailable');vi.stubGlobal('crypto',webcrypto);const controller=new AbortController();controller.abort();await expect(previewPreparation(source,[step(source,'lowercase')],'Canceled',controller.signal)).rejects.toThrow('canceled');});
it('normalizes, saves, cold reopens and retains both source and replayable history in a snapshot',async()=>{
 const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value),removeItem:(key:string)=>store.delete(key)});
 vi.stubGlobal('window',{localStorage:globalThis.localStorage});
 const source=await fixture(),result=await previewPreparation(source,[step(source,'lowercase')],'Prepared');const draft=structuredClone(initialDashboard);draft.importedDatasets=[result.dataset];draft.pages=draft.pages.slice(0,1);const analysis=runImportedDatasetQuery({dataset:result.dataset,field:result.dataset.fields[1],metric:"count",chartType:"table"});draft.pages[0].tiles=[{...draft.pages[0].tiles[0],query:analysis.query,result:analysis,source:{kind:"importedField",id:"prepared-field",datasetId:result.dataset.id,fieldId:result.dataset.fields[1].id,label:"Answer"}}];draft.pages[0].elements=[];
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[source,result.dataset]});expect(saveDashboardWorkspace(workspace)).toBe(true);const cold=loadDashboardWorkspace(),prepared=cold.importedDatasets.find(item=>item.id===result.dataset.id)!;await verifyPreparedStudy(cold.importedDatasets.find(item=>item.id===source.id)!,prepared);expect(prepared.preparation).toEqual(result.recipe);expect(samePreparedStudy(prepared,result.dataset)).toBe(true);
 expect(()=>removeWorkspaceImportedDataset(cold,source.id)).toThrow('Preparation history');const snapshot=createPublishedSnapshot(cold,cold.reports[0].draft).snapshot;expect(snapshot.dashboard.importedDatasets.map(item=>item.id)).toEqual(expect.arrayContaining([source.id,result.dataset.id]));
});
it('rejects corrupted saved history rather than silently dropping it',async()=>{const source=await fixture(),result=await previewPreparation(source,[step(source,'lowercase')],'Prepared');for(const damaged of [{...result.recipe,sourceFingerprint:'bad'},{...result.recipe,steps:[]},{...result.recipe,steps:[{...result.recipe.steps[0],kind:'eval'}]}])expect(()=>assertStudyPreparation(damaged)).toThrow('damaged');});
it.each(['lowercase','recode'] as const)('removes the old target label when %s combines values into an already labeled category',async kind=>{const source=await fixture();source.rows[0].Answer='N';source.rows[1].Answer='n';source.fields[1].valueLabels={N:'First meaning',n:'Different meaning',South:'Southern region'};const result=await previewPreparation(source,[step(source,kind,kind==='recode'?['N']:[],kind==='recode'?'n':'')],'Merged');expect(result.dataset.rows.slice(0,2).map(row=>row.Answer)).toEqual(['n','n']);expect(result.dataset.fields[1].valueLabels).not.toHaveProperty('n');expect(result.dataset.fields[1].valueLabels).not.toHaveProperty('N');});
it('permits a same-copy retry after storage adds notes/status without permitting changed analytical data',async()=>{const source=await fixture(),result=await previewPreparation(source,[step(source,'lowercase')],'Retry'),stored=structuredClone(result.dataset);stored.notes.push('Storage lifecycle note');stored.previewRows=[];stored.importStatus!.label='Pending local write';expect(samePreparedStudy(stored,result.dataset)).toBe(true);stored.rows[0].Answer='different';expect(samePreparedStudy(stored,result.dataset)).toBe(false);});


