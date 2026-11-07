import { afterEach, describe, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { getImportedDatasetQuerySupport, runImportedDatasetQuery } from "../importedDatasetAnalytics";
import { runImportedDatasetQueryForRuntime } from "../importedDatasetRuntimeQuery";
import { allRespondentsGroupingField, allRespondentsGroupingId, allRespondentsGroupingOption } from "../numericSummaryScope";
import { createPublishedSnapshot, createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace } from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
async function study(text = 'Spend\n10\n20\n30\n') {
 const parsed = await importDatasetBuffer(new TextEncoder().encode(text).buffer,'synthetic.csv');
 if (!parsed.dataset) throw Error(parsed.error); return parsed.dataset;
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each([
 [[],null,allRespondentsGroupingId],
 [[allRespondentsGroupingId],null,'__ecofocus_all_respondents_option_0__'],
 [[allRespondentsGroupingId,'__ecofocus_all_respondents_option_0__'],null,'__ecofocus_all_respondents_option_1__'],
 [[],allRespondentsGroupingId,'__ecofocus_all_respondents_option_0__'],
 [[allRespondentsGroupingId],'__ecofocus_all_respondents_option_0__','__ecofocus_all_respondents_option_1__'],
 [['__proto__','constructor','none'],null,allRespondentsGroupingId]
] as Array<[string[],string|null,string]>)('keeps overall DOM choice disjoint from fields %j and retained %s',(ids,retained,expected)=>{
 const fields=ids.map(id=>({id})),before=structuredClone(fields);expect(allRespondentsGroupingOption(fields,retained)).toBe(expected);expect(fields).toEqual(before);
});
it('still refuses an unregistered virtual grouping without explicit scope',async()=>{
 const dataset=await study();expect(getImportedDatasetQuerySupport(dataset,{...allRespondentsGroupingField(dataset),sourceColumn:'unregistered'}, {metric:'average',measureField:dataset.fields[0]}).executable).toBe(false);
});
it('refuses ambiguous duplicate real IDs instead of choosing one physical source by matching column',async()=>{
 const dataset=await study('Answer,Other\nNorth,A\nSouth,B\n');dataset.fields.forEach(field=>field.id=allRespondentsGroupingId);const before=structuredClone(dataset);
 expect(getImportedDatasetQuerySupport(dataset,dataset.fields[0],{metric:'count',chartType:'table'}).executable).toBe(false);expect(()=>runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:'count',chartType:'table'})).toThrow('explicit');expect(dataset).toEqual(before);
});
it('allows a registered real grouping field to use the historical overall-summary ID',async()=>{
 const dataset=await study('Answer,Spend\nNorth,10\nSouth,20\nNorth,30\n');dataset.fields[0].id='__ecofocus_all_respondents__';const before=structuredClone(dataset);
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:'count',chartType:'table'});
 expect(result.table.map(row=>[row.label,row.values.summary]).sort()).toEqual([['North',2],['South',1]]);expect(result.metadataRefs.source).toMatchObject({primaryFieldId:dataset.fields[0].id});expect(result.metadataRefs.source).not.toHaveProperty('groupingScope','all_respondents');expect(dataset).toEqual(before);
});
it('allows an explicit overall summary of a real numeric field with that same ID',async()=>{
 const dataset=await study();dataset.fields[0].id='__ecofocus_all_respondents__';const before=structuredClone(dataset);
 const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),measureField:dataset.fields[0],groupingScope:'all_respondents',metric:'average',chartType:'table'});
 expect(result.table[0].values.summary).toBe(20);expect(result.table[0].bases.summary).toBe(3);expect(dataset).toEqual(before);
});
it('allows a real breakout to share the synthetic ID when overall scope is explicit',async()=>{
 const dataset=await study('Spend,Group\n10,A\n20,B\n30,A\n');dataset.fields[1].id='__ecofocus_all_respondents__';Object.assign(dataset.fields[1],{type:'categorical',modelingRole:'candidate_dimension',eligibleForBanner:true});const before=structuredClone(dataset);
 const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),measureField:dataset.fields[0],bannerField:dataset.fields[1],groupingScope:'all_respondents',metric:'sum',chartType:'table'});
 expect(result.columns.map(column=>[column.label,result.table[0].values[column.id]])).toEqual([['A',40],['B',20]]);expect(dataset).toEqual(before);
});
describe('explicit overall numeric summaries',()=>{
 it.each([['average',20],['sum',60]] as const)('calculates %s without inventing respondent columns',async(metric,expected)=>{
  const dataset=await study(),before=structuredClone(dataset),field=allRespondentsGroupingField(dataset);
  const result=runImportedDatasetQuery({dataset,field,measureField:dataset.fields[0],groupingScope:'all_respondents',metric,chartType:'table'});
  expect(result.table.map(row=>[row.label,row.values.summary,row.bases.summary])).toEqual([['All respondents',expected,3]]);
  expect(result.metadataRefs.source).toMatchObject({groupingScope:'all_respondents',measureBaseScope:'cell'});expect(dataset).toEqual(before);
 });
 it('excludes blanks and invalid values and reports the valid base',async()=>{
  const dataset=await study('Spend\n10\ninvalid\n\n30\n'),field=allRespondentsGroupingField(dataset);
  const measure={...dataset.fields[0],type:'numeric' as const,modelingRole:'candidate_measure' as const};
  const result=runImportedDatasetQuery({dataset,field,measureField:measure,groupingScope:'all_respondents',metric:'average',chartType:'table'});
  expect(result.table[0].values.summary).toBe(20);expect(result.table[0].bases.summary).toBe(2);expect(result.warnings.join(' ')).toContain('without a valid numeric value');
 });
 it('supports an explicit filter and breakout with independent valid cell bases',async()=>{
  const dataset=await study('Spend,Region,Group\n10,North,A\n20,North,B\n90,South,A\n30,North,A\n');
  const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),measureField:dataset.fields[0],groupingScope:'all_respondents',metric:'average',chartType:'table',bannerField:dataset.fields[2],filter:{field:dataset.fields[1],value:'North'}});
  expect(result.table[0].values).toEqual(Object.fromEntries(result.columns.map(c=>[c.id,20])));
  expect(Object.values(result.table[0].bases).sort()).toEqual([1,2]);
 });
 it('rejects empty valid numeric samples instead of displaying a fabricated zero mean',async()=>{
  const dataset=await study('Spend\ninvalid\nmissing\n');const measure={...dataset.fields[0],type:'numeric' as const,modelingRole:'candidate_measure' as const};
  expect(()=>runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),measureField:measure,groupingScope:'all_respondents',metric:'average',chartType:'table'})).toThrow('No valid numeric values remain');
 });
 it('requires explicit numeric scope and does not change ordinary query behavior',async()=>{
  const dataset=await study();const field=allRespondentsGroupingField(dataset);
  expect(getImportedDatasetQuerySupport(dataset,field,{groupingScope:'all_respondents',metric:'count'}).executable).toBe(false);
  expect(getImportedDatasetQuerySupport(dataset,field,{metric:'average',measureField:dataset.fields[0]}).executable).toBe(false);
  expect(getImportedDatasetQuerySupport(dataset,dataset.fields[0],{metric:'average',measureField:dataset.fields[0]}).executable).toBe(false);
 });
 it('blocks server execution before any network call until overall server summaries are supported',async()=>{
  const dataset=await study();dataset.remote={provider:'netlify',projectUrl:'',bucket:'',objectPath:'synthetic.csv',uploadedAt:dataset.importedAt};
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const config={dataset,field:allRespondentsGroupingField(dataset),measureField:dataset.fields[0],groupingScope:'all_respondents' as const,metric:'sum' as const,chartType:'table' as const};
  expect(getImportedDatasetQuerySupport(dataset,config.field,config).executable).toBe(false);
  await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow('complete browser data');expect(fetcher).not.toHaveBeenCalled();
 });
 it.each([['Spend\n10\n20\n30\n',60],['Spend\n0.000001\n0.000003\n',0.000004]] as const)('preserves explicit scope and exact result through save, snapshot and cold reopen (%s)',async(text,expected)=>{
  const dataset=await study(text);const result=runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),measureField:dataset.fields[0],groupingScope:'all_respondents',metric:'sum',chartType:'table'});
  const draft=structuredClone(initialDashboard);draft.pages[0].tiles=[{...draft.pages[0].tiles[0],query:result.query,result}];draft.importedDatasets=[dataset];
  const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});const published=createPublishedSnapshot(workspace,draft);
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
  expect(saveDashboardWorkspace(published.workspace)).toBe(true);
  const loaded=loadDashboardWorkspace();const tile=loaded.publishedSnapshots[0].dashboard.pages[0].tiles[0];
  expect(tile.result.table).toEqual(result.table);expect(tile.result.table[0].values.summary).toBe(expected);expect(tile.query.sourceIdentity).toMatchObject({groupingScope:'all_respondents'});
 });
 it('does not fabricate zero means for breakout groups with no valid numeric observations',async()=>{
  const dataset=await study('Spend,Group\n10,A\ninvalid,B\n');const measure={...dataset.fields[0],type:'numeric' as const,modelingRole:'candidate_measure' as const};
  expect(()=>runImportedDatasetQuery({dataset,field:allRespondentsGroupingField(dataset),measureField:measure,bannerField:dataset.fields[1],groupingScope:'all_respondents',metric:'average',chartType:'table'})).toThrow('no valid numeric values for this average');
 });

});
