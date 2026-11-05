import { afterEach, describe, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../datasetImportModel";
import { runImportedDatasetQuery, type ImportedDatasetQueryConfig } from "../importedDatasetAnalytics";
import { runImportedDatasetQueryForRuntime } from "../importedDatasetRuntimeQuery";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function fixture(metric:ImportedDatasetQueryConfig["metric"]="count") {
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Answer,Region,Spend\nYes,North,10\nNo,South,20\nYes,North,30\n").buffer,"synthetic_contract.csv");const dataset=parsed.dataset!;
 const config:ImportedDatasetQueryConfig={dataset:{...dataset,rows:[],remote:{provider:"netlify",projectUrl:"",bucket:"",objectPath:"synthetic.csv",uploadedAt:dataset.importedAt}},field:dataset.fields[0],measureField:metric==="average"||metric==="sum"?dataset.fields[2]:null,metric,chartType:"table"};
 const response=runImportedDatasetQuery({...config,dataset:{...config.dataset,rows:dataset.rows}});return {config,response};
}
function serve(response:unknown) {vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>response}));}
describe("imported remote result integrity",()=>{
 it.each(["count","percent_selected","average","sum"] as const)("accepts an unchanged valid %s result and sends no local respondent rows",async(metric)=>{
  const {config,response}=await fixture(metric),before=structuredClone(response);serve(response);expect(await runImportedDatasetQueryForRuntime(config)).toEqual(before);expect(response).toEqual(before);const body=JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body));expect(body.dataset.rows).toEqual([]);
 });
 it.each(["count","percent_selected","average","sum"] as const)("accepts a filtered breakout %s including zero-observation columns",async(metric)=>{
  const {config}=await fixture(metric);config.bannerField=config.dataset.fields[1];config.filter={field:config.dataset.fields[1],value:"North"};config.chartType="grouped_bar";
  const response=runImportedDatasetQuery({...config,dataset:{...config.dataset,rows:config.dataset.previewRows}});serve(response);
  expect(await runImportedDatasetQueryForRuntime(config)).toEqual(response);expect(response.table.some(row=>Object.values(row.bases).includes(0))).toBe(true);
 });
 it.each(["average","sum","percent_selected"] as const)("rejects a nonzero %s for a cell with no observations even when chart and table agree",async(metric)=>{
  const {config,response}=await fixture(metric);response.table[0].bases.summary=0;response.series[0].bases[0]=0;response.table[0].values.summary=99;response.series[0].values[0]=99;serve(response);
  await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched result");
 });
 it.each(["wrong study","duplicate row","missing cell","disagreeing chart"])("rejects %s before a result reaches the editor",async(problem)=>{
  const {config,response}=await fixture();
  if(problem==="wrong study"&&response.query.sourceIdentity?.kind==="imported")response.query.sourceIdentity.datasetId="another-study";
  if(problem==="duplicate row")response.table[1].optionId=response.table[0].optionId;
  if(problem==="missing cell")delete response.table[0].values.summary;
  if(problem==="disagreeing chart")response.series[0].values[0]=999;
  serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow(/result/i);
 });
 it.each(["wrong field","wrong source reference","wrong metric","weighted result","missing provenance","nonfinite value","negative base","impossible base","duplicate column","misaligned series","missing notes","invented significance"])("rejects %s instead of accepting inconsistent analytical data",async(problem)=>{
  const {config,response}=await fixture();
  if(problem==="wrong field"&&response.query.sourceIdentity?.kind==="imported")response.query.sourceIdentity.primaryFieldId="different";
  if(problem==="wrong source reference")response.query.sourceRef={...response.query.sourceRef!,datasetId:"different"};
  if(problem==="wrong metric")response.metric.id="average";
  if(problem==="weighted result")response.weighting.applied=true;
  if(problem==="missing provenance")delete response.metadataRefs.source;
  if(problem==="nonfinite value"){response.table[0].values.summary=Infinity;response.series[0].values[0]=Infinity;}
  if(problem==="negative base"){response.table[0].bases.summary=-1;response.series[0].bases[0]=-1;}
  if(problem==="impossible base"){response.table[0].bases.summary=config.dataset.rowCount+1;response.series[0].bases[0]=config.dataset.rowCount+1;}
  if(problem==="duplicate column"){response.columns.push({...response.columns[0]});response.labels.push(response.labels[0]);}
  if(problem==="misaligned series")response.series[0].id="another-row";
  if(problem==="missing notes")delete (response as Partial<AnalyticsQueryResponse>).notes;
  if(problem==="invented significance")response.statistics.significance.status="tested";
  serve(JSON.parse(JSON.stringify(response)));await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched result");
 });
 it.each([null,[],{},"unexpected"])("rejects malformed success payload %j",async(payload)=>{const {config}=await fixture();serve(payload);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched result");});
 it("rejects an incomplete statistical plan rather than allowing later controls to crash",async()=>{
  const {config,response}=await fixture();response.statistics.significanceExecutionPlan={} as AnalyticsQueryResponse['statistics']['significanceExecutionPlan'];serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched result");
 });
 it("preserves a useful server error even when its details have a malformed type",async()=>{
  const {config}=await fixture();vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:"Synthetic service unavailable",details:"not an array"})}));
  await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("Synthetic service unavailable");
 });
});
