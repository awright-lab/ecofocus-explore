import { assertImportedQueryResponse } from "../importedQueryResponse";
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

it("accepts an older remote result without recorded inputs but rejects corrupted supplied inputs",async()=>{const{config,response}=await fixture("percent_selected");const legacy=structuredClone(response);delete legacy.calculationInputs;serve(legacy);expect(await runImportedDatasetQueryForRuntime(config)).toEqual(legacy);const row=response.table[0],column=response.columns[0];response.calculationInputs!.rows[row.optionId].cells[column.id].numerator=.5;serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched");});

it.each(["count","percent_selected"] as const)("rejects inconsistent row bases in a categorical %s column, including legacy responses",async metric=>{const{config,response}=await fixture(metric);delete response.calculationInputs;response.table[1].bases.summary=2;response.series[1].bases[0]=2;serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched");});
it("rejects categorical response counts that do not add up to their shared column base",async()=>{const{config,response}=await fixture("count");response.table[1].values.summary=0;response.series[1].values[0]=0;serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched");});
it("rejects self-consistent rounded cells whose retained numerators do not cover the column denominator",async()=>{const{config,response}=await fixture("percent_selected"),row=response.table[0];response.calculationInputs!.rows[row.optionId].cells.summary.numerator=1;row.values.summary=33.3;response.series[0].values[0]=33.3;serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched");});
it.each(["average","sum"] as const)("rejects %s valid-cell bases whose total exceeds the complete study row count",async metric=>{const{config,response}=await fixture(metric);response.table[1].bases.summary=2;response.series[1].bases[0]=2;if(response.calculationInputs){const input=response.calculationInputs.rows[response.table[1].optionId].cells.summary;input.denominator=2;input.numerator=response.table[1].values.summary*2;}serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow("incomplete or mismatched");});
it("accepts a legacy rounded column totalling99.9 without inventing counts or demanding100",async()=>{const parsed=await importDatasetBuffer(new TextEncoder().encode('Answer,Spend\nYes,10\nNo,20\nMaybe,30\n').buffer,'synthetic-thirds.csv'),dataset=parsed.dataset!,config:ImportedDatasetQueryConfig={dataset:{...dataset,rows:[],remote:{provider:'netlify',projectUrl:'',bucket:'',objectPath:'synthetic',uploadedAt:dataset.importedAt}},field:dataset.fields[0],metric:'percent_selected',chartType:'table'},response=runImportedDatasetQuery({...config,dataset});delete response.calculationInputs;for(const row of response.table)row.values.summary=33.3;for(const series of response.series)series.values[0]=33.3;expect(response.table.map(row=>row.values.summary)).toEqual([33.3,33.3,33.3]);serve(response);expect(await runImportedDatasetQueryForRuntime(config)).toEqual(response);});
it("rejects total categorical column bases exceeding the study even if counts conserve each column",async()=>{const{config}=await fixture('count');config.bannerField=config.dataset.fields[1];const response=runImportedDatasetQuery({...config,dataset:{...config.dataset,rows:config.dataset.previewRows}});for(let c=0;c<response.columns.length;c++)for(let r=0;r<response.table.length;r++){const id=response.columns[c].id;response.table[r].bases[id]=3;response.series[r].bases[c]=3;response.table[r].values[id]=r===0?2:1;response.series[r].values[c]=r===0?2:1;}serve(response);await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow('incomplete or mismatched');});

it.each([NaN,Infinity,-1,1.5])("rejects an invalid declared study row count %s instead of bypassing aggregate bounds",async rowCount=>{const{config,response}=await fixture('count');config.dataset.rowCount=rowCount;expect(()=>assertImportedQueryResponse(response,config)).toThrow('incomplete or mismatched');});
