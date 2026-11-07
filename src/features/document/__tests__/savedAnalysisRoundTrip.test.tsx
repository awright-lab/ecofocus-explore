// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialDashboard } from "../documentSeeds";
import { normalizeDashboard } from "../documentModel";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, removeWorkspaceImportedDataset, saveDashboardWorkspace } from "../workspacePersistence";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { allRespondentsGroupingField } from "../../data/numericSummaryScope";
import { assertSavedImportedTileSource, resolveSavedImportedQuery, runSavedImportedQuery } from "../../data/savedImportedQuery";
import { buildAnalyticalTemplateFromTile } from "../../builder/components/libraryReuseModel";
import { useBuilderTileCommands } from "../../builder/hooks/useBuilderTileCommands";
import { useDocumentCommandState } from "../../builder/hooks/useDocumentCommandState";
import { defaultDataset, defaultQuestion } from "../../builder/builderConstants";
import type { DashboardDraft, DashboardTile, ImportedDatasetRecord } from "../../../../shared/types/dashboard";

beforeEach(()=>{localStorage.clear();vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("No live services in saved-analysis tests")));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
async function fixture(scope?:"all_respondents") {
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Answer,Region,Spend\nYes,all,10\nYes,all,30\nNo,North,50\nNo,all,bad\n").buffer,"synthetic_saved_analysis.csv");
 const dataset=parsed.dataset!;dataset.fields[2]={...dataset.fields[2],type:"numeric",modelingRole:"candidate_measure"};const field=scope?allRespondentsGroupingField(dataset):dataset.fields[0];
 const result=runImportedDatasetQuery({dataset,field,measureField:dataset.fields[2],filter:{field:dataset.fields[1],value:"all"},metric:"average",chartType:"table",groupingScope:scope});
 const tile:DashboardTile={...structuredClone(initialDashboard.pages[0].tiles[0]),title:"Saved imported mean",query:result.query,result,visualization:"table",source:{kind:"importedField",id:`${dataset.id}:${field.id}`,label:"Average Spend",datasetId:dataset.id,fieldId:field.id,sourceRef:result.query.sourceRef}};
 const template=buildAnalyticalTemplateFromTile(tile),draft=structuredClone(initialDashboard);draft.importedDatasets=[];draft.pages=[draft.pages[0]];draft.pages[0].tiles=[];draft.pages[0].elements=[];draft.analysisLibrary.templates=[template];
 return {dataset,tile,template,draft,result};
}

describe("saved analytical context survives normalization and storage",()=>{
 it.each([undefined,"all_respondents"] as const)("retains an imported mean, source identity and literal-all filter (%s)",async(scope)=>{
  const {dataset,template,draft,result}=await fixture(scope),before=structuredClone(template);
  const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});expect(saveDashboardWorkspace(workspace)).toBe(true);
  const reopened=loadDashboardWorkspace(),saved=reopened.reports[0].draft.analysisLibrary.templates[0];
  expect(saved.query).toEqual(template.query);expect(saved.query.weight).toBeNull();expect(saved.query.metric).toBe("average");expect(saved.source.kind).toBe("importedField");expect(saved.summary.sourceLabel).toContain(dataset.title);expect(saved.summary.filterLabel).toBe("Region: all");
  const rerun=await runSavedImportedQuery(saved.query,reopened.importedDatasets);expect(rerun.table).toEqual(result.table);expect(template).toEqual(before);expect(fetch).not.toHaveBeenCalled();
  expect(()=>removeWorkspaceImportedDataset(reopened,dataset.id)).toThrow(/Saved analysis/);
 });
 it("keeps authored rows, explicit unweighted settings, and both operands of a saved calculation",()=>{
  const draft=structuredClone(initialDashboard),query={...draft.pages[0].tiles[0].query,weight:null,authoredVariableSet:{id:"authored",label:"Saved union",rowMode:"authored" as const,rows:[{id:"union",label:"Union",kind:"net" as const,sourceOptionIds:["a","b"],rowOrder:1,visible:true,emphasis:"summary" as const}]}};
  const template=buildAnalyticalTemplateFromTile({...draft.pages[0].tiles[0],query});draft.analysisLibrary.templates=[template];
  draft.analysisLibrary.derivedDefinitions=[{id:"difference",datasetId:query.dataset,label:"Saved difference",description:"",source:{kind:"question",id:query.question,label:"Question"},sourceTileId:"tile",sourceTileTitle:"Tile",query,outputKind:"row_difference",metricKind:"row_difference",spec:{columnId:"summary",columnLabel:"Total",rowId:"a",rowLabel:"First",comparedRowId:"b",comparedRowLabel:"Second"},summary:{outputLabel:"Difference",sourceLabel:"Question",structureLabel:"Total",queryLabel:"Unweighted"}}];
  const normalized=normalizeDashboard(draft);expect(normalized.analysisLibrary.templates[0].query.authoredVariableSet).toEqual(query.authoredVariableSet);expect(normalized.analysisLibrary.templates[0].query.weight).toBeNull();expect(normalized.analysisLibrary.derivedDefinitions[0].spec).toEqual(draft.analysisLibrary.derivedDefinitions[0].spec);
 });
 it.each(["grouping","numeric","filter","comparison"])("fails closed when the saved %s field is unavailable",async(role)=>{
  const {dataset,template}=await fixture(),source=template.query.sourceIdentity!;expect(source.kind).toBe("imported");if(source.kind!=="imported")throw Error("fixture");
  if(role==="comparison")source.bannerFieldId="missing";
  else if(role==="grouping")source.primaryFieldId="missing";
  else if(role==="numeric")source.measureFieldId="missing";
  else source.filterFieldId="missing";
  expect(()=>resolveSavedImportedQuery(template.query,[dataset])).toThrow(`saved ${role} field`);expect(fetch).not.toHaveBeenCalled();
 });
 it("never substitutes a different available study, silently drops a filter, or ignores weights",async()=>{
  const {dataset,template}=await fixture();expect(()=>resolveSavedImportedQuery(template.query,[{...dataset,id:"different"}])).toThrow("unavailable");
  const source=template.query.sourceIdentity!;if(source.kind!=="imported")throw Error("fixture");source.filterValue="gone";expect(()=>resolveSavedImportedQuery(template.query,[dataset])).toThrow("filter value is no longer");
  source.filterValue="all";template.query.weight="weightvar";expect(()=>resolveSavedImportedQuery(template.query,[dataset])).toThrow("Weighted imported templates");expect(fetch).not.toHaveBeenCalled();
 });
 it.each(["generic filter","breakout","wave selection","calculation kind"])("rejects a conflicting saved %s rather than broadening the result",async(kind)=>{
  const {dataset,template}=await fixture();
  if(kind==="generic filter")template.query.filters=[{field:"REGION",values:["north"]}];
  if(kind==="breakout")template.query.breakBy="REGION";
  if(kind==="wave selection")template.query.comparisonDatasets=["ecofocus_2024"];
  if(kind==="calculation kind"&&template.query.sourceIdentity?.kind==="imported")template.query.sourceIdentity.queryKind="categorical";
  expect(()=>resolveSavedImportedQuery(template.query,[dataset])).toThrow(/conflicting/);expect(fetch).not.toHaveBeenCalled();
 });
 it.each(["study","field","source reference"])("rejects conflicting template %s metadata before any execution",async(kind)=>{
  const {template}=await fixture();
  if(kind==="study")template.source.datasetId="other";
  if(kind==="field")template.source.fieldId="other";
  if(kind==="source reference")template.source.sourceRef={...template.query.sourceRef!,datasetId:"other"};
  expect(()=>assertSavedImportedTileSource(template.query,template.source)).toThrow("conflicting study or field");expect(fetch).not.toHaveBeenCalled();
 });
 it("uses the imported remote-query contract rather than the generic analytics route",async()=>{
  const {dataset,template,result}=await fixture(),remote:ImportedDatasetRecord={...dataset,rows:[],remote:{provider:"netlify",projectUrl:"",bucket:"",objectPath:"synthetic.csv",uploadedAt:dataset.importedAt}};
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result),{status:200,headers:{"Content-Type":"application/json"}}));
  expect((await runSavedImportedQuery(template.query,[remote])).table).toEqual(result.table);expect(fetch).toHaveBeenCalledOnce();const [url,options]=vi.mocked(fetch).mock.calls[0];expect(url).toBe("/.netlify/functions/imported-dataset-query");expect(JSON.parse(String(options!.body)).dataset.rows).toEqual([]);
 });
});

it.each(["valid","wrong dataset","wrong field","missing identity","legacy question source"])("runs the actual template command safely (%s)",async(mode)=>{
 const {dataset,template,draft,result}=await fixture();let current=structuredClone(draft),error:string|null=null;const select=vi.fn(),host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 if(mode==="wrong dataset")template.source.datasetId="different";
 if(mode==="wrong field")template.source.fieldId="different";
 if(mode==="missing identity")delete template.query.sourceIdentity;
 if(mode==="legacy question source")template.source={kind:"question",id:template.query.question,label:"Legacy fallback"};
 function Harness(){const [document,setDocument,getReplacementVersion]=useDocumentCommandState(draft);current=document;const noop=()=>{};
  const commands=useBuilderTileCommands({documentId:document.id,getContextVersion:getReplacementVersion,activePage:document.pages[0],canvasScale:1,query:template.query,selectedQuestion:defaultQuestion,selectedVariableSet:null,savedVariableSets:[],importedDatasets:[dataset],selectedTile:null,selectedElement:null,setDashboard:(update)=>setDocument(update),selectTile:select,setActivePageId:noop,updateTile:noop,applyQuestionSelection:noop,applyVariableSetSelection:noop,recordDerivedOutputCreationCue:noop,recordDerivedOutputRecreationCue:noop,recordDerivedDefinitionRecreationCue:noop,setIsLoading:noop,setError:value=>{error=value;}});
  return <button onClick={()=>commands.addTileFromAnalyticalTemplate(template)}>Reuse saved analysis</button>;
 }
 try{await act(async()=>root.render(<Harness/>));await act(async()=>host.querySelector("button")!.click());
  if(mode==="valid"||mode==="legacy question source") {expect(error).toBeNull();expect(current.pages[0].tiles).toHaveLength(1);expect(current.pages[0].tiles[0].result.table).toEqual(result.table);expect(current.pages[0].tiles[0].query.sourceIdentity).toEqual(result.query.sourceIdentity);expect(current.pages[0].tiles[0].source?.kind).toBe("importedField");expect(current.pages[0].tiles[0].source?.datasetId).toBe(dataset.id);expect(select).toHaveBeenCalledOnce();}
  else {expect(error).not.toBeNull();expect(current.pages[0].tiles).toHaveLength(0);expect(select).not.toHaveBeenCalled();}
  expect(fetch).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
