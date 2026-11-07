import {expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import frozen from './fixtures/legacy-case-fallback-v1.json';
import {importedRawFieldValue} from '../importedRawValue';
import {runImportedDatasetQuery,importedFieldChoiceResult,getImportedDatasetQuerySupport} from '../importedDatasetAnalytics';
import {buildImportedNumericProfile} from '../importedNumericProfile';
import {buildImportedCategoricalProfile} from '../importedCategoricalProfile';
import {decodeStoredWorkspaceSource,saveDashboardWorkspace,workspaceStorageKey} from '../../document/workspacePersistence';
import {verifyLocalExecution} from '../../../../shared/analytics/localExecutionEvidence';
import {runNumericProfileJob} from '../numericProfileJob';
import {runCategoricalProfileJob} from '../categoricalProfileJob';
import {runGuidedPreviewJob} from '../guidedPreviewJob';
import {previewVersionedRefresh} from '../../analytics/versionedLocalRefresh';
import {audienceCategoryChoices,previewAudienceAsync} from '../../audiences/audienceModel';
import type {SavedImportedAudience} from '../../../../shared/types/audience';
const load=(index=0)=>decodeStoredWorkspaceSource({key:workspaceStorageKey,raw:frozen.cases[index].raw});
it.each([0,1])('refuses ambiguous case-fallback measure in stored property order %i',index=>{
 const workspace=load(index),dataset=workspace.importedDatasets[0],before=structuredClone(workspace);
 expect(()=>runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric:'average',chartType:'table'})).toThrow(/ambiguous source column/i);expect(workspace).toEqual(before);
});
it.each([false,true])('refuses ambiguous grouping instead of selecting the first matching key (reverse=%s)',reverse=>{
 const dataset=load().importedDatasets[0];dataset.fields[0].sourceColumn='answer';dataset.rows=dataset.rows.map(()=>reverse?{Answer:'South',ANSWER:'North',AMOUNT:'10',Amount:'100'}:{ANSWER:'North',Answer:'South',AMOUNT:'10',Amount:'100'});
 expect(()=>runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:'count',chartType:'table'})).toThrow(/ambiguous source column/i);
});
it.each([false,true])('does not choose between own case-folded keys (reverse=%s)',reverse=>{
 const field=load().importedDatasets[0].fields[1],row=reverse?{Amount:'100',AMOUNT:'10'}:{AMOUNT:'10',Amount:'100'};expect(()=>importedRawFieldValue(row,field)).toThrow(/ambiguous source column/i);
});
it('keeps exact own keys authoritative even when another case variant exists, including exact blanks',()=>{
 const field=load().importedDatasets[0].fields[1];expect(importedRawFieldValue({amount:'15',AMOUNT:'99',Amount:'150'},field)).toBe('15');expect(importedRawFieldValue({amount:'',AMOUNT:'99'},field)).toBe('');
});
it('keeps a unique case fallback and missing-field semantics, ignoring inherited alternatives',()=>{
 const field=load().importedDatasets[0].fields[1];expect(importedRawFieldValue({AMOUNT:'10'},field)).toBe('10');expect(importedRawFieldValue({Other:'1'},field)).toBe('');const row=Object.create({Amount:'999'}) as Record<string,string>;row.AMOUNT='10';expect(importedRawFieldValue(row,field)).toBe('10');
});
it('shows unavailable profiles instead of order-dependent numeric or categorical statistics',()=>{
 const dataset=load().importedDatasets[0],before=structuredClone(dataset),numeric=buildImportedNumericProfile(dataset,dataset.fields[1]);expect(numeric).toMatchObject({status:'unavailable',reason:expect.stringMatching(/ambiguous source column/i)});
 const grouping={...dataset.fields[1],type:'categorical' as const,modelingRole:'candidate_dimension' as const};expect(buildImportedCategoricalProfile(dataset,grouping)).toMatchObject({status:'unavailable',reason:expect.stringMatching(/ambiguous source column/i)});expect(dataset).toEqual(before);
});
it.each([0,1])('preserves actual legacy raw workspace, cached value and snapshot in case %i',async index=>{
 const workspace=load(index),before=structuredClone(workspace),result=workspace.reports[0].draft.pages[0].tiles[0].result;expect(result.table[0].values.summary).toBe(frozen.cases[index].expectedMean);vi.stubGlobal('crypto',webcrypto);let raw='';vi.stubGlobal('window',{localStorage:{setItem:(_key:string,value:string)=>{raw=value;}}});
 try{expect(await verifyLocalExecution(result)).toBe(true);expect(saveDashboardWorkspace(workspace)).toBe(true);expect(raw).toBe(frozen.cases[index].raw);expect(workspace).toEqual(before);expect(load(index)).toEqual(before);}finally{vi.unstubAllGlobals();}
});
it.each(['grouping','measure','breakout','filter','audience']as const)('rejects ambiguous selected %s without creating a partial result',role=>{
 const dataset=load().importedDatasets[0],ambiguous={...dataset.fields[1],type:'categorical' as const,modelingRole:'candidate_dimension' as const,eligibleForBanner:true,eligibleForFilter:true},before=structuredClone(dataset);
 const audience:SavedImportedAudience={version:1,id:'source-case-audience',label:'Recorded criterion',datasetId:dataset.id,importedAt:dataset.importedAt,expression:{kind:'category',fieldId:dataset.fields[1].id,sourceColumn:'amount',values:['10'],exclude:false}};
 const config={dataset,field:role==='grouping'?ambiguous:dataset.fields[0],measureField:role==='measure'?dataset.fields[1]:null,bannerField:role==='breakout'?ambiguous:null,filter:role==='filter'?{field:ambiguous,value:'10'}:null,audience:role==='audience'?audience:undefined,metric:role==='measure'?'average' as const:'count' as const,chartType:'table' as const};
 expect(()=>runImportedDatasetQuery(config)).toThrow(/ambiguous source column/i);expect(dataset).toEqual(before);
});
it.each([0,1])('retains exact-case numeric analyses even when an unused field has an ambiguous mapping (order %i)',index=>{
 const dataset=load(index).importedDatasets[0],before=structuredClone(dataset),result=runImportedDatasetQuery({dataset,field:dataset.fields[0],measureField:dataset.fields[2],metric:'average',chartType:'table'});expect(result.table[0].values.summary).toBe(150);expect(result.table[0].bases.summary).toBe(1000);expect(dataset).toEqual(before);
});
it('refuses a later ambiguous row even after support sees a valid exact first row',()=>{
 const dataset=load().importedDatasets[0];dataset.rows[0]={Answer:'A',amount:'7',Amount:'100'};const before=structuredClone(dataset),config={dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric:'average' as const,chartType:'table' as const};
 expect(getImportedDatasetQuerySupport(dataset,config.field,config).executable).toBe(true);expect(()=>runImportedDatasetQuery(config)).toThrow(/ambiguous source column/i);expect(buildImportedNumericProfile(dataset,dataset.fields[1]).status).toBe('unavailable');expect(dataset).toEqual(before);
});
it('exposes a choice error separately from empty choices without discarding its selected field',()=>{
 const dataset=load().importedDatasets[0],field=dataset.fields[1],before=structuredClone(dataset),choices=importedFieldChoiceResult(dataset,field);expect(choices.values).toEqual([]);expect(choices.issue).toMatch(/ambiguous source column/i);expect(field.sourceColumn).toBe('amount');expect(importedFieldChoiceResult(dataset,null)).toEqual({values:[],issue:null});expect(dataset).toEqual(before);
});
it.each(['numeric','categorical','guided']as const)('refuses ambiguous %s source preparation before worker construction',async kind=>{
 const dataset=load().importedDatasets[0],before=structuredClone(dataset),createWorker=vi.fn(),signal=new AbortController().signal;vi.useFakeTimers();
 try{const pending=kind==='numeric'?runNumericProfileJob(dataset,dataset.fields[1],{signal,createWorker}):kind==='categorical'?runCategoricalProfileJob(dataset,{...dataset.fields[1],type:'categorical',modelingRole:'candidate_dimension'},{signal,createWorker}):runGuidedPreviewJob({dataset,field:dataset.fields[0],measureField:dataset.fields[1],metric:'average',chartType:'table'},{signal,createWorker});const rejected=expect(pending).rejects.toThrow(/ambiguous source column/i);await vi.runAllTimersAsync();await rejected;expect(createWorker).not.toHaveBeenCalled();expect(dataset).toEqual(before);}finally{vi.useRealTimers();}
});
it('keeps audience choices/population and a source receipt unavailable rather than counting an arbitrary match',async()=>{
 const workspace=load(),before=structuredClone(workspace),dataset=workspace.importedDatasets[0],audience:SavedImportedAudience={version:1,id:'case-audience',label:'Source rule',datasetId:dataset.id,importedAt:dataset.importedAt,expression:{kind:'category',fieldId:dataset.fields[1].id,sourceColumn:'amount',values:['10'],exclude:false}};
 expect(()=>audienceCategoryChoices(dataset,dataset.fields[1])).toThrow(/ambiguous source column/i);await expect(previewAudienceAsync(audience,dataset,new AbortController().signal)).rejects.toThrow(/ambiguous source column/i);
 await expect(previewVersionedRefresh({draft:workspace.reports[0].draft,studies:[dataset],tileId:'source-case-tile'},{signal:new AbortController().signal})).rejects.toThrow(/ambiguous source column/i);expect(workspace).toEqual(before);
});
