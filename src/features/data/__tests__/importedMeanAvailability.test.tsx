import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { analyticalCell, analyticalRowValues } from "../../../../shared/analytics/resultCells";
import { importDatasetBuffer } from "../datasetImportModel";
import { runImportedDatasetQuery } from "../importedDatasetAnalytics";
import { initialDashboard } from "../../document/documentSeeds";
import { ChartView } from "../../builder/components/CanvasRenderers";
import { buildDerivedOutputResponse, buildDerivedOutputViews } from "../../builder/components/derivedOutputModel";
import { createPublishedSnapshot,createReportRecord,normalizeDashboardWorkspace,saveDashboardWorkspace,loadDashboardWorkspace } from "../../document/workspacePersistence";
async function fixture(metric: "average" | "sum" | "count" = "average", csv = "Group,Panel,Spend\nNegative,A,-10\nLower,A,-20\nMissing,A,invalid\nZero,A,0\nNegative,B,-5\n") {
 const imported=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,"synthetic.csv"),dataset=imported.dataset!;
 const measure={...dataset.fields[2],type:"numeric" as const,modelingRole:"candidate_measure" as const};dataset.fields[2]=measure;
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],measureField:metric==="count"?null:measure,metric,chartType:"table"});
 const tile={...structuredClone(initialDashboard.pages[0].tiles[0]),query:result.query,result,visualization:"table" as const};
 const column=result.columns.find(column=>column.label==="A")!, row=(label:string)=>result.table.find(row=>row.label===label)!;
 return {dataset,result,tile,column,row};
}
afterEach(()=>vi.unstubAllGlobals());
describe("imported mean cell availability",()=>{
 it("keeps an invalid-only grouping row and distinguishes it from a genuine zero and negative mean",async()=>{
  const {result,column,row}=await fixture();
  expect(analyticalCell(result,row("Missing"),column.id)).toEqual({status:"no_observations",value:null});
  expect(analyticalCell(result,row("Zero"),column.id)).toEqual({status:"available",value:0});
  expect(analyticalCell(result,row("Negative"),column.id)).toEqual({status:"available",value:-10});
  expect(result.warnings.join(" ")).toContain("not zero estimates");expect(analyticalRowValues(result,row("Missing"))[column.id]).toBeNull();
 });
 it.each(["sum","count"] as const)("keeps existing %s semantics unchanged",async metric=>{
  const {result,column,row}=await fixture(metric);
  if(metric==="count") expect(analyticalCell(result,row("Missing"),column.id)).toEqual({status:"available",value:1});
  else {expect(result.table.some(row=>row.label==="Missing")).toBe(false);expect(analyticalCell(result,row("Zero"),column.id)).toEqual({status:"available",value:0});}
 });
 it("requires rerunning cached means that lack verified cell bases",async()=>{
  const {result,column,row}=await fixture();if(result.metadataRefs.source?.kind!=="imported")throw Error("Missing source");delete result.metadataRefs.source.measureBaseScope;
  expect(analyticalCell(result,row("Zero"),column.id)).toEqual({status:"rerun_required",value:null});
 });
 it("shows unavailable table cells without replacing a real zero",async()=>{
  const {tile}=await fixture();const html=renderToStaticMarkup(<ChartView tile={tile}/>);
  const missing=html.match(/<tr[^>]*>(?:(?!<tr)[\s\S])*?Missing(?:(?!<tr)[\s\S])*?<\/tr>/)?.[0];
  expect(missing).toContain("Unavailable");expect(missing).not.toContain(">0<");expect(html).toContain(">0<");
 });
 it("renders an explicit empty chart when every mean is unavailable",async()=>{
  const {tile}=await fixture("average","Group,Panel,Spend\nMissing,A,invalid\nOther,B,invalid\n");
  const html=renderToStaticMarkup(<ChartView tile={{...tile,visualization:"grouped_bar"}}/>);expect(html).toContain("Unavailable: no verified numeric observations");
 });
 it("never ranks an unavailable transport zero above a negative observed mean",async()=>{
  const {tile}=await fixture();tile.result.table=tile.result.table.filter(row=>row.label!=="Zero");
  const summary=buildDerivedOutputResponse(tile,"lead_row_summary")!;expect(summary.table[0].label).toBe("Negative");expect(Object.values(summary.table[0].values)).toEqual([-10]);
  for(const kind of ["top_n_extract","bottom_n_extract"] as const)expect(buildDerivedOutputResponse(tile,kind)!.table.map(row=>row.label)).not.toContain("Missing");
 });
 it("rejects explicitly selected unavailable operands instead of silently substituting other rows",async()=>{
  const {tile,column,row}=await fixture();const config={columnId:column.id,rowId:row("Missing").optionId,comparedRowId:row("Negative").optionId};
  for(const kind of ["row_difference","row_average"] as const){expect(buildDerivedOutputResponse(tile,kind,config)).toBeNull();expect(buildDerivedOutputViews(tile,config).find(view=>view.kind===kind)?.canCreate).toBe(false);}
 });
 it("marks a filter-created empty breakout as unavailable while retaining the breakout column",async()=>{
  const {dataset}=await fixture();const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],measureField:dataset.fields[2],filter:{field:dataset.fields[1],value:"A"},metric:"average",chartType:"table"});
  const empty=result.columns.find(column=>column.label==="B")!;expect(empty).toBeTruthy();expect(result.table.every(row=>analyticalCell(result,row,empty.id).value===null)).toBe(true);
 });
 it("preserves values, verified bases and availability through save, snapshot and cold reopen",async()=>{
  const {tile,dataset,column}=await fixture();const draft=structuredClone(initialDashboard);draft.pages=[{...draft.pages[0],tiles:[tile]}];draft.importedDatasets=[dataset];
  const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});const snapshot=createPublishedSnapshot(workspace,draft);
  const storage=new Map<string,string>();vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
  expect(saveDashboardWorkspace(snapshot.workspace)).toBe(true);const reopened=loadDashboardWorkspace().publishedSnapshots[0].dashboard.pages[0].tiles[0].result;
  const row=reopened.table.find(row=>row.label==="Missing")!;expect(analyticalCell(reopened,row,column.id).value).toBeNull();expect(row.bases[column.id]).toBe(0);expect(reopened.table).toEqual(tile.result.table);
 });
});
