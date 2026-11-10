// @vitest-environment jsdom
import { act, useCallback, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBuilderTileCommands } from "../useBuilderTileCommands";
import { useDocumentCommandState } from "../useDocumentCommandState";
import { initialDashboard } from "../../../document/documentSeeds";
import { defaultQuestion } from "../../builderConstants";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import type { DashboardDraft, DashboardTile } from "../../../../../shared/types/dashboard";
import type { AnalyticsQueryResponse } from "../../../../../shared/types/analytics";
import { runIllustrativeFollowUpQuery } from "../../../analytics/illustrativeFollowUpQuery";
import { findingFollowUps } from "../../../analytics/findingFollowUps";

type Kind="create"|"imported"|"starter"|"refresh"|"imported refresh";
let host:HTMLDivElement,root:Root,commands:ReturnType<typeof useBuilderTileCommands>,current:DashboardDraft,loading:boolean,error:string|null;
let select=vi.fn<(id:string)=>void>();
let requests:Array<{resolve:(response:Response)=>void;reject:(error:Error)=>void}>;
let unmounted=false;
const noop=()=>{};
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);requests=[];select=vi.fn();unmounted=false;vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>((resolve,reject)=>requests.push({resolve,reject}))));});
afterEach(async()=>{if(!unmounted)await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
function makeDocument(id:string,withTile:boolean):DashboardDraft {
 const value=structuredClone(initialDashboard);value.id=id;value.title=id;value.importedDatasets=[];value.pages=[value.pages[0]];value.pages[0].id="shared_page";value.pages[0].elements=[];value.pages[0].tiles=withTile?[value.pages[0].tiles[0]]:[];
 if(withTile&&id==="report_b"){value.pages[0].tiles[0].title="Different report result";value.pages[0].tiles[0].result.table[0].label="Different report answer";}
 value.pages.push({...structuredClone(value.pages[0]),id:"next_page",title:"Second page",tiles:[],elements:[]});
 return value;
}
async function setup(kind:Kind) {
 const reportA=makeDocument("report_a",kind.includes("refresh")),reportB=makeDocument("report_b",kind.includes("refresh"));let change!:(next:DashboardDraft)=>void,modify!:(update:(next:DashboardDraft)=>DashboardDraft)=>void,edit!:(title:string)=>void,changePage!:(id:string)=>void,changeReadOnly!:(value:boolean)=>void;const loadingCalls:boolean[]=[],errorCalls:Array<string|null>=[];
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Answer\nYes\nNo\nYes\n").buffer,"synthetic_owner.csv"),dataset=parsed.dataset!;
 const remote={...dataset,rows:[],remote:{provider:"netlify" as const,projectUrl:"",bucket:"",objectPath:"synthetic.csv",uploadedAt:dataset.importedAt}};
 const response=kind.startsWith("imported")?runImportedDatasetQuery({dataset:{...remote,rows:dataset.rows},field:dataset.fields[0],metric:"count",chartType:"table"}):structuredClone(initialDashboard.pages[0].tiles[0].result);
 if(kind==="imported refresh")for(const report of [reportA,reportB]){const tile=report.pages[0].tiles[0];tile.query=structuredClone(response.query);tile.result=structuredClone(response);tile.source={kind:"importedField",id:`${dataset.id}:${dataset.fields[0].id}`,label:"Answer",datasetId:dataset.id,fieldId:dataset.fields[0].id};if(report===reportB)tile.result.notes=["Existing second report result"];}
 function Harness(){const [busy,setBusy]=useState(false),[draft,setDraft,getReplacementVersion]=useDocumentCommandState(reportA,()=>setBusy(false)),[pageId,setPageId]=useState("shared_page"),[readOnly,setReadOnly]=useState(false),[failure,setFailure]=useState<string|null>(null);current=draft;loading=busy;error=failure;change=setDraft;modify=update=>{setDraft(update);};edit=title=>{setDraft(value=>({...value,title}));};
  const epoch=useRef(0),pageRef=useRef(pageId),viewerRef=useRef(readOnly);
  changePage=id=>{if(pageRef.current!==id){pageRef.current=id;epoch.current+=1;setBusy(false);}setPageId(id);};changeReadOnly=value=>{if(viewerRef.current!==value){viewerRef.current=value;epoch.current+=1;setBusy(false);}setReadOnly(value);};
  const getContextVersion=useCallback(()=>JSON.stringify([epoch.current,getReplacementVersion()]),[getReplacementVersion]);
  const onLoading=useCallback((value:boolean)=>{loadingCalls.push(value);setBusy(value);},[]),onError=useCallback((value:string|null)=>{errorCalls.push(value);setFailure(value);},[]);
  const args={documentId:draft.id,getContextVersion,documentVersion:readOnly?"snapshot":undefined,readOnly,activePage:draft.pages.find(page=>page.id===pageId)!,canvasScale:1,query:response.query,selectedQuestion:defaultQuestion,selectedVariableSet:null,savedVariableSets:[],importedDatasets:[remote],selectedTile:draft.pages[0].tiles[0]??null,selectedElement:null,
   setDashboard:(update:DashboardDraft|((value:DashboardDraft)=>DashboardDraft))=>setDraft(update),selectTile:select,setActivePageId:changePage,
   updateTile:(id:string,updates:Partial<DashboardTile>)=>setDraft(value=>({...value,pages:value.pages.map(page=>({...page,tiles:page.tiles.map(tile=>tile.id===id?{...tile,...updates}:tile)}))})),
   applyQuestionSelection:noop,applyVariableSetSelection:noop,recordDerivedOutputCreationCue:noop,recordDerivedOutputRecreationCue:noop,recordDerivedDefinitionRecreationCue:noop,setIsLoading:onLoading,setError:onError};
  commands=useBuilderTileCommands(args);return <button data-active-page={pageId} onClick={()=>setDraft(reportB)}>Switch report</button>;
 }
 await act(async()=>root.render(<Harness/>));
 const start=()=>kind==="create"?commands.addTileFromAnalyticalTemplate({id:"template",datasetId:response.query.dataset,label:"Synthetic template",description:"",source:{kind:"question",id:response.query.question,label:"Question"},query:response.query,visualization:"table",summary:{sourceLabel:"Question",bannerLabel:"Total",filterLabel:"None",weightLabel:"None",confidenceLabel:"95%",comparisonLabel:"None"}})
  :kind==="imported"?commands.addTileFromImportedDatasetField(remote,dataset.fields[0],"table","count")
  :kind==="starter"?commands.createSourceDrivenSmartStarter("source_table_insight")
  :commands.rerunTileAnalysis(current.pages[0].tiles[0],response.query);
 return {reportA,reportB,response,dataset,remote,start,change:(next:DashboardDraft)=>change(next),modify:(update:(next:DashboardDraft)=>DashboardDraft)=>modify(update),edit:(title:string)=>edit(title),changePage:(id:string)=>changePage(id),changeReadOnly:(value:boolean)=>changeReadOnly(value),loadingCalls,errorCalls};
}
async function finish(response:AnalyticsQueryResponse,index=0) {await act(async()=>requests[index].resolve(new Response(JSON.stringify(response),{status:200,headers:{"Content-Type":"application/json"}})));}
it.each(["create","imported","starter","refresh","imported refresh"] as const)("does not commit a late %s result into another report sharing page/tile IDs",async(kind)=>{
 const fixture=await setup(kind);let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});expect(loading).toBe(true);await act(async()=>host.querySelector("button")!.click());
 const before=structuredClone(current);await finish(fixture.response);await pending;expect(current).toEqual(before);expect(select).not.toHaveBeenCalled();expect(error).toBeNull();
});
it.each(["create","imported","starter","refresh"] as const)("discards a late %s response after page navigation, A-B-A navigation, or a published view",async(kind)=>{
 for(const destination of ["page","return visit","published"]){
  if(destination!=="page"){await act(async()=>root.unmount());root=createRoot(host);}
  const fixture=await setup(kind);let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});
  if(destination==="page")await act(async()=>fixture.changePage("next_page"));
  if(destination==="return visit"){await act(async()=>fixture.change(fixture.reportB));await act(async()=>fixture.change(fixture.reportA));}
  if(destination==="published")await act(async()=>fixture.changeReadOnly(true));
  expect(loading).toBe(false);const before=structuredClone(current);select.mockClear();fixture.loadingCalls.length=0;fixture.errorCalls.length=0;
  await finish(fixture.response,requests.length-1);await pending;expect(current).toEqual(before);expect(select).not.toHaveBeenCalled();expect(fixture.errorCalls).toEqual([]);expect(fixture.loadingCalls).toEqual([]);
  if(destination==="published"){const count=requests.length;await act(async()=>{pending=fixture.start();});await pending;expect(requests).toHaveLength(count);expect(current).toEqual(before);}
 }
});
it.each(["create","imported","starter","refresh"] as const)("does not show a stale %s error in the next report",async(kind)=>{
 const fixture=await setup(kind);let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});await act(async()=>fixture.change(fixture.reportB));fixture.errorCalls.length=0;fixture.loadingCalls.length=0;
 await act(async()=>requests[0].reject(new Error("Old report failure")));await pending;expect(error).toBeNull();expect(fixture.errorCalls).toEqual([]);expect(fixture.loadingCalls).toEqual([]);
});
it.each(["create","imported","starter","refresh"] as const)("ignores %s completion after the editor unmounts",async(kind)=>{
 const fixture=await setup(kind);let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});await act(async()=>root.unmount());unmounted=true;select.mockClear();fixture.errorCalls.length=0;fixture.loadingCalls.length=0;
 await finish(fixture.response);await pending;expect(select).not.toHaveBeenCalled();expect(fixture.errorCalls).toEqual([]);expect(fixture.loadingCalls).toEqual([]);
});
it("does not let an old report completion clear a new report's running request",async()=>{
 const fixture=await setup("create");let first!:Promise<unknown>,second!:Promise<unknown>;await act(async()=>{first=fixture.start();});await act(async()=>fixture.change(fixture.reportB));await act(async()=>{second=fixture.start();});
 await finish(fixture.response,0);await first;expect(loading).toBe(true);expect(current.pages[0].tiles).toHaveLength(0);
 await finish(fixture.response,1);await second;expect(loading).toBe(false);expect(current.pages[0].tiles).toHaveLength(1);
});
it("keeps loading active until concurrent current-page creations have both settled",async()=>{
 const fixture=await setup("create");let first!:Promise<unknown>,second!:Promise<unknown>;await act(async()=>{first=fixture.start();second=fixture.start();});
 await finish(fixture.response,0);await first;expect(loading).toBe(true);expect(current.pages[0].tiles).toHaveLength(1);
 await finish(fixture.response,1);await second;expect(loading).toBe(false);expect(current.pages[0].tiles).toHaveLength(2);
});
it("keeps the latest refresh when an earlier request completes last",async()=>{
 const fixture=await setup("refresh");let first!:Promise<unknown>,second!:Promise<unknown>;await act(async()=>{first=fixture.start();second=fixture.start();});
 const newest=structuredClone(fixture.response);newest.notes=["Newest synthetic result"];
 await finish(newest,1);await second;expect(current.pages[0].tiles[0].result.notes).toContain("Newest synthetic result");expect(loading).toBe(false);
 await finish(fixture.response,0);expect(await first).toBe(false);expect(current.pages[0].tiles[0].result.notes).toContain("Newest synthetic result");
});
it("refreshes an imported tile through its imported endpoint with its original query context",async()=>{
 const fixture=await setup("imported refresh");let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/.netlify/functions/imported-dataset-query");
 await finish(fixture.response);expect(await pending).toBe(true);expect(current.pages[0].tiles[0].query.sourceIdentity).toEqual(fixture.response.query.sourceIdentity);expect(current.pages[0].tiles[0].result.table).toEqual(fixture.response.table);
});

it.each(["create","imported","starter","refresh","imported refresh"] as const)("rejects same-batch navigation before React rerenders (%s)",async(kind)=>{
 for(const destination of ["report","page","return visit","published"]){
  if(destination!=="report"){await act(async()=>root.unmount());root=createRoot(host);}
  const fixture=await setup(kind);let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});const requestIndex=requests.length-1;select.mockClear();fixture.errorCalls.length=0;fixture.loadingCalls.length=0;
  const expected=destination==="report"?fixture.reportB:destination==="published"?{...structuredClone(fixture.reportA),status:"published" as const}:fixture.reportA;
  await act(async()=>{
    if(destination==="report")fixture.change(fixture.reportB);
    if(destination==="page")fixture.changePage("next_page");
    if(destination==="return visit"){fixture.change(fixture.reportB);fixture.change(fixture.reportA);}
    if(destination==="published"){fixture.change(expected);fixture.changeReadOnly(true);}
    const count=requests.length;expect(await fixture.start()).toBe(kind.includes("refresh")?false:null);expect(requests).toHaveLength(count);
    requests[requestIndex].resolve(new Response(JSON.stringify(fixture.response),{status:200,headers:{"Content-Type":"application/json"}}));
    expect(await pending).toBe(kind.includes("refresh")?false:null);expect(select).not.toHaveBeenCalled();expect(fixture.errorCalls).toEqual([]);expect(fixture.loadingCalls).toEqual([]);
  });
  expect(current).toEqual(expected);expect(loading).toBe(false);expect(error).toBeNull();
 }
});
it.each(["create","imported","starter","refresh"] as const)("does not emit an old error or loading update during same-batch navigation (%s)",async(kind)=>{
 const fixture=await setup(kind);let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});fixture.errorCalls.length=0;fixture.loadingCalls.length=0;
 await act(async()=>{fixture.change(fixture.reportB);requests[0].reject(new Error("Stale same-batch error"));await pending;expect(fixture.errorCalls).toEqual([]);expect(fixture.loadingCalls).toEqual([]);});
 expect(current).toEqual(fixture.reportB);expect(error).toBeNull();expect(loading).toBe(false);
});
it("allows ordinary edits while a query is pending and preserves them when the result arrives",async()=>{
 const fixture=await setup("create");let pending!:Promise<unknown>;await act(async()=>{pending=fixture.start();});await act(async()=>fixture.edit("Title edited while waiting"));expect(loading).toBe(true);
 await finish(fixture.response);expect(await pending).not.toBeNull();expect(current.title).toBe("Title edited while waiting");expect(current.pages[0].tiles).toHaveLength(1);expect(select).toHaveBeenCalledOnce();expect(loading).toBe(false);
});
it.each(["seeded","imported"] as const)("creates a %s analysis and its explicitly chosen page in one accepted update",async kind=>{
 const fixture=await setup(kind==="seeded"?"create":"imported");const before=structuredClone(current);let pending!:Promise<string|null>;
 await act(async()=>{pending=kind==="seeded"?commands.addTileFromSourceWithVisualization("table",undefined,"new_page"):commands.addTileFromImportedDatasetField(fixture.remote,fixture.dataset.fields[0],"table","count",{destination:"new_page"});});
 expect(current).toEqual(before);await finish(fixture.response);const id=await pending;expect(id).toBeTruthy();
 expect(current.pages.slice(0,2)).toEqual(before.pages);expect(current.pages).toHaveLength(3);
 const added=current.pages[2];expect(added.elements).toEqual([]);expect(added.tiles).toHaveLength(1);expect(added.tiles[0].id).toBe(id);expect(added.tiles[0].result).toEqual(fixture.response);
 expect(host.querySelector('button')?.getAttribute('data-active-page')).toBe(added.id);expect(select).toHaveBeenCalledWith(id);expect(loading).toBe(false);
});
it("rechecks current-page room against ordinary edits made while an analysis is pending",async()=>{
 const fixture=await setup("create");let pending!:Promise<string|null>;await act(async()=>{pending=commands.addTileFromSourceWithVisualization("table",undefined,"current_page");});
 await act(async()=>fixture.modify(value=>({...value,pages:value.pages.map((page,index)=>index? page:{...page,tiles:[{...structuredClone(initialDashboard.pages[0].tiles[0]),layout:{x:48,y:72,width:760,height:460,zIndex:1}}]})})));
 const before=structuredClone(current);await finish(fixture.response);expect(await pending).toBeNull();expect(current).toEqual(before);expect(select).not.toHaveBeenCalled();expect(error).toContain("no room");
});
it.each(["cancel","navigate","failure"] as const)("does not leave a new page behind after %s",async reason=>{
 const fixture=await setup("create");let owner=true,pending!:Promise<string|null>;await act(async()=>{pending=commands.addTileFromSourceWithVisualization("table",()=>owner,"new_page");});
 if(reason==="cancel")owner=false;
 if(reason==="navigate")await act(async()=>fixture.changePage("next_page"));
 const before=structuredClone(current);
 if(reason==="failure")await act(async()=>requests[0].reject(new Error("Synthetic placement request failed")));else await finish(fixture.response);
 expect(await pending).toBeNull();expect(current).toEqual(before);expect(current.pages).toHaveLength(2);expect(select).not.toHaveBeenCalled();
});
it("retains reviewed follow-up context in a separate result without changing the source response or pages",async()=>{
 const fixture=await setup("create"),before=structuredClone(current),responseBefore=structuredClone(fixture.response);let pending!:Promise<string|null>;
 await act(async()=>{pending=commands.createTileFromSource(fixture.response.query,"Does North vary by Segment?",undefined,undefined,{destination:"new_page",contextNotes:["Original recorded finding: North / Total: 25%.","Add breakout Segment. Original preserved."]});});
 await finish(fixture.response);expect(await pending).toBeTruthy();expect(current.pages.slice(0,2)).toEqual(before.pages);expect(current.pages[2].tiles[0].result.notes).toEqual([...fixture.response.notes,"Original recorded finding: North / Total: 25%.","Add breakout Segment. Original preserved."]);expect(fixture.response).toEqual(responseBefore);
});
it("drops a cancelled follow-up creation and its context without adding a page",async()=>{
 const fixture=await setup("create"),before=structuredClone(current);let owner=true,pending!:Promise<string|null>;
 await act(async()=>{pending=commands.createTileFromSource(fixture.response.query,"Follow-up",undefined,undefined,{destination:"new_page",isCurrent:()=>owner,contextNotes:["Cancelled context"]});});owner=false;await finish(fixture.response);expect(await pending).toBeNull();expect(current).toEqual(before);expect(select).not.toHaveBeenCalled();
});
it("creates a sample follow-up from exactly its illustrative preview without selecting a server provider",async()=>{
 const fixture=await setup("create"),before=structuredClone(current);
 const source={kind:"seeded" as const,sourceRef:{id:"seeded:ecofocus_2025",kind:"seeded_demo" as const,provider:"ecofocus_demo" as const,label:"Illustrative sample",datasetId:"ecofocus_2025" as const},datasetId:"ecofocus_2025" as const,questionId:"Q_PACKAGING_TRUST" as const};
 const query={dataset:"ecofocus_2025" as const,question:"Q_PACKAGING_TRUST" as const,breakBy:"GENERATION" as const,filters:[],weight:null,confidenceLevel:0.95 as const,metric:"column_percent" as const,chartType:"table" as const,sourceRef:source.sourceRef,sourceIdentity:source};
 const preview=runIllustrativeFollowUpQuery(query);let id:string|null=null;
 await act(async()=>{id=await commands.createTileFromSource(query,"Illustrative follow-up",undefined,{kind:"question",id:query.question,label:"Packaging trust"},{destination:"new_page",executionMode:"illustrative_sample",contextNotes:["Origin reference: analysis sample-origin; answer trust_a_lot; group summary."]});});
 expect(id).toBeTruthy();expect(fetch).not.toHaveBeenCalled();expect(current.pages.slice(0,2)).toEqual(before.pages);
 const tile=current.pages[2].tiles[0];expect(tile.result.table).toEqual(preview.table);expect(tile.result.metadataRefs.source).toEqual(source);expect(tile.result.notes).toContain("Origin reference: analysis sample-origin; answer trust_a_lot; group summary.");
 expect(findingFollowUps(tile,tile.result.table[0].optionId,tile.result.columns[0].id,[]).unavailable).toBeNull();
 await act(async()=>{expect(await commands.rerunTileAnalysis(tile,query)).toBe(true);});expect(fetch).not.toHaveBeenCalled();expect(current.pages[2].tiles[0].result.table).toEqual(preview.table);expect(current.pages[2].tiles[0].result.metadataRefs.source).toEqual(source);
});
import { normalizeDashboard } from '../../../document/documentModel';
import { calculateLocalAnalysis, type LocalAnalysisRequest } from '../../../data/localAnalysisModel';
import { loadDashboardWorkspace, saveDashboardWorkspace, normalizeDashboardWorkspace, createReportRecord } from '../../../document/workspacePersistence';
class CreationWorker {
 static instances:CreationWorker[]=[]; request:LocalAnalysisRequest|null=null; terminated=false;
 onmessage:((event:MessageEvent)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
 constructor(){CreationWorker.instances.push(this);}postMessage(request:LocalAnalysisRequest){this.request=structuredClone(request);}terminate(){this.terminated=true;}
 complete(){this.onmessage?.({data:{type:'complete',result:calculateLocalAnalysis(this.request!)}} as MessageEvent);}
}
async function creationReady(){for(let i=0;i<100&&!CreationWorker.instances[0]?.request;i++)await act(async()=>new Promise(resolve=>setTimeout(resolve,5)));expect(CreationWorker.instances[0]?.request).toBeTruthy();}
it('inserts the real background result through the document command and preserves source after workspace save/reopen',async()=>{
 const f=await setup('imported'),before=structuredClone(f.dataset);CreationWorker.instances=[];vi.stubGlobal('Worker',CreationWorker);let pending!:Promise<string|null>;
 await act(async()=>{pending=commands.addTileFromImportedDatasetField(f.dataset,f.dataset.fields[0],'table','count',{background:{signal:new AbortController().signal}});});await creationReady();await act(async()=>CreationWorker.instances[0].complete());expect(await pending).toBeTruthy();expect(current.pages[0].tiles).toHaveLength(1);
 const tile=current.pages[0].tiles[0],expected=runImportedDatasetQuery({dataset:f.dataset,field:f.dataset.fields[0],chartType:'table',metric:'count'});expect(tile.result).toEqual(expected);expect(tile.query).toEqual(expected.query);expect(tile.source?.datasetId).toBe(f.dataset.id);expect(fetch).not.toHaveBeenCalled();expect(f.dataset).toEqual(before);
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord({...current,importedDatasets:[f.dataset]})],importedDatasets:[f.dataset]});window.localStorage.clear();expect(saveDashboardWorkspace(workspace)).toBe(true);const reopened=loadDashboardWorkspace();expect(reopened.reports[0].draft.pages[0].tiles[0].result).toEqual(normalizeDashboard(current).pages[0].tiles[0].result);expect(reopened.importedDatasets[0].rows).toEqual(f.dataset.rows);window.localStorage.clear();
});
it.each(['cancel','navigate','source change'] as const)('never inserts a background result after %s',async kind=>{
 const f=await setup('imported'),before=structuredClone(current),abort=new AbortController();CreationWorker.instances=[];vi.stubGlobal('Worker',CreationWorker);let pending!:Promise<string|null>;
 await act(async()=>{pending=commands.addTileFromImportedDatasetField(f.dataset,f.dataset.fields[0],'table','count',{background:{signal:abort.signal}});});await creationReady();
 if(kind==='cancel')await act(async()=>abort.abort());if(kind==='navigate')await act(async()=>f.changePage('next_page'));if(kind==='source change')f.dataset.rows[0].Answer='Changed';
 const rejected=kind==='source change'?expect(pending).rejects.toThrow('changed'):null;await act(async()=>CreationWorker.instances[0].complete());if(rejected)await rejected;else expect(await pending).toBeNull();expect(current).toEqual(before);expect(select).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
