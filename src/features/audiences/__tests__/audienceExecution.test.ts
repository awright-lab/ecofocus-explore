// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import type { SavedImportedAudience } from "../../../../shared/types/audience";
import { analyticalCell } from "../../../../shared/analytics/resultCells";
import { allRespondentsGroupingField } from "../../data/numericSummaryScope";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery, buildImportedResultProvenance } from "../../data/importedDatasetAnalytics";
import { runImportedDatasetQueryForRuntime } from "../../data/importedDatasetRuntimeQuery";
import { resolveSavedImportedQuery,runSavedImportedQuery } from "../../data/savedImportedQuery";
import { assertImportedQueryResponse } from "../../data/importedQueryResponse";
import { initialDashboard } from "../../document/documentSeeds";
import { createReportRecord,normalizeDashboardWorkspace,saveDashboardWorkspace,loadDashboardWorkspace,workspaceStorageKey,createPublishedSnapshot } from "../../document/workspacePersistence";
import { draftImportedStudyReferences } from "../../document/importedStudyUsage";
import { assertExportResultsCurrent,analysisContextRows } from "../../export/exportIntegrity";
async function fixture(){
 const {dataset}=await importDatasetBuffer(new TextEncoder().encode('Id,Region,Spend,Segment\n1,North,"$1,000",Core\n2,East,200,Growth\n3,North,500,Growth\n4,South,300,Core\n5,West,,Core\n6,,400,Core\n7,North,invalid,Core\n8,East,600,Core\n').buffer,"synthetic-audience.csv");const d=dataset!,f=(name:string)=>d.fields.find(field=>field.sourceColumn===name)!;Object.assign(f("Spend"),{type:"numeric",modelingRole:"candidate_measure"});
 const audience:SavedImportedAudience={version:1,id:"audience-1",label:"North and East Core",datasetId:d.id,importedAt:d.importedAt,expression:{kind:"group",match:"all",exclude:false,children:[{kind:"category",fieldId:f("Region").id,sourceColumn:"Region",values:["North","East"],exclude:false},{kind:"range",fieldId:f("Spend").id,sourceColumn:"Spend",min:200,max:1000,exclude:false},{kind:"category",fieldId:f("Segment").id,sourceColumn:"Segment",values:["Growth"],exclude:true}]}};
 return {d,f,audience,config:{dataset:d,field:f("Region"),audience,metric:"count" as const,chartType:"vertical_bar" as const}};
}
beforeEach(()=>localStorage.clear());afterEach(()=>vi.unstubAllGlobals());
it("runs counts, percentages, averages and sums on the exact audience and intersects an ordinary filter",async()=>{
 const {d,f,config}=await fixture(),before=structuredClone(d);
 const count=runImportedDatasetQuery(config);expect(count.table.map(row=>[row.label,row.values.summary,row.bases.summary])).toEqual([["East",1,2],["North",1,2]]);
 const percent=runImportedDatasetQuery({...config,metric:"percent_selected"});expect(percent.table.map(row=>row.values.summary)).toEqual([50,50]);
 const sum=runImportedDatasetQuery({...config,measureField:f("Spend"),metric:"sum"});expect(sum.table.reduce((n,row)=>n+row.values.summary,0)).toBe(1600);expect(sum.table.every(row=>row.bases.summary===1)).toBe(true);
 const mean=runImportedDatasetQuery({...config,groupingScope:"all_respondents",field:allRespondentsGroupingField(d),measureField:f("Spend"),metric:"average"});expect(mean.table[0].values.summary).toBe(800);
 const north=runImportedDatasetQuery({...config,filter:{field:f("Region"),value:"North"}});expect(north.table.map(row=>row.values.summary)).toEqual([1]);expect(d).toEqual(before);
});
it("records an immutable audience and retains it through saved query reuse and export provenance",async()=>{
 const {d,audience,config}=await fixture(),result=runImportedDatasetQuery(config);audience.label="Changed library name";audience.expression={kind:"blank",fieldId:d.fields[1].id,sourceColumn:"Region",exclude:false};
 expect(result.query.sourceIdentity?.kind==="imported"&&result.query.sourceIdentity.audience?.label).toBe("North and East Core");
 const resolved=resolveSavedImportedQuery(result.query,[d]);expect(resolved.audience).toEqual(result.query.sourceIdentity?.kind==="imported"?result.query.sourceIdentity.audience:undefined);
 const rerun=await runSavedImportedQuery(result.query,[d]);expect(rerun.table).toEqual(result.table);expect(buildImportedResultProvenance(result)?.filterLabel).toContain("North and East Core");
 const page=structuredClone(initialDashboard.pages[0]);page.tiles=[{...page.tiles[0],query:result.query,result}];expect(()=>assertExportResultsCurrent([page])).not.toThrow();expect(new Map(analysisContextRows(page.tiles[0])).get("Filter")).toContain("Spend between 200 and 1000");
 const corrupt=structuredClone(result);if(corrupt.metadataRefs.source?.kind==="imported"){corrupt.metadataRefs.source={...corrupt.metadataRefs.source};delete corrupt.metadataRefs.source.audience;}page.tiles[0].result=corrupt;expect(()=>assertExportResultsCurrent([page])).toThrow(/audience context/);
});
it("persists audience definitions and exact source/result and retains the study dependency",async()=>{
 const {d,audience,config}=await fixture(),draft=structuredClone(initialDashboard),result=runImportedDatasetQuery(config);draft.savedAudiences=[audience];draft.importedDatasets=[d];draft.pages[0].tiles=[{...draft.pages[0].tiles[0],query:result.query,result}];
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[d]});expect(saveDashboardWorkspace(workspace)).toBe(true);const reopened=loadDashboardWorkspace().reports[0].draft;
 expect(reopened.savedAudiences).toEqual([audience]);expect(reopened.pages[0].tiles[0].result.table).toEqual(result.table);expect(reopened.pages[0].tiles[0].query.sourceIdentity).toEqual(result.query.sourceIdentity);expect(draftImportedStudyReferences(reopened)).toContainEqual({datasetId:d.id,location:`Saved audience: ${audience.label}`});
 const raw=localStorage.getItem(workspaceStorageKey)!;const broken=JSON.parse(raw);broken.reports[0].draft.savedAudiences=[{version:1}];const damaged=JSON.stringify(broken);localStorage.setItem(workspaceStorageKey,damaged);expect(()=>loadDashboardWorkspace()).toThrow();expect(localStorage.getItem(workspaceStorageKey)).toBe(damaged);
});
it("refuses a server audience before network I/O and rejects a result that silently drops the audience",async()=>{
 const {d,config}=await fixture(),fetch=vi.fn();vi.stubGlobal("fetch",fetch);d.remote={provider:"netlify",projectUrl:"synthetic",bucket:"synthetic",objectPath:"synthetic",uploadedAt:"synthetic"};await expect(runImportedDatasetQueryForRuntime(config)).rejects.toThrow(/Server-backed audience queries/);expect(fetch).not.toHaveBeenCalled();
 delete d.remote;const result=runImportedDatasetQuery(config);expect(()=>assertImportedQueryResponse(result,config)).not.toThrow();if(result.query.sourceIdentity?.kind==="imported")delete result.query.sourceIdentity.audience;expect(()=>assertImportedQueryResponse(result,config)).toThrow(/incomplete or mismatched/i);
});

it("retains complete study data for a snapshot whose only new dependency is a saved audience",async()=>{
 const {d,audience}=await fixture(),draft=structuredClone(initialDashboard);draft.importedDatasets=[];draft.savedAudiences=[audience];const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[d]});
 const created=createPublishedSnapshot(workspace,draft);expect(created.snapshot.dashboard.savedAudiences).toEqual([audience]);expect(created.snapshot.dashboard.importedDatasets.find(item=>item.id===d.id)?.rows).toEqual(d.rows);
 const detached=normalizeDashboardWorkspace({...created.workspace,importedDatasets:[],reports:created.workspace.reports.map(report=>({...report,draft:{...report.draft,savedAudiences:[]}}))});expect(detached.publishedSnapshots[0].dashboard.importedDatasets.find(item=>item.id===d.id)?.rows).toEqual(d.rows);
});
it("does not fabricate a mean or percentage for an empty audience",async()=>{
 const {d,f,audience,config}=await fixture();audience.expression={kind:"range",fieldId:f("Spend").id,sourceColumn:"Spend",exclude:false,min:2000,max:3000};
 expect(()=>runImportedDatasetQuery({...config,field:allRespondentsGroupingField(d),groupingScope:"all_respondents",measureField:f("Spend"),metric:"average"})).toThrow(/No valid numeric values remain/);
 const percent=runImportedDatasetQuery({...config,metric:"percent_selected"});for(const row of percent.table)expect(analyticalCell(percent,row,percent.columns[0].id).value).toBeNull();
});

it.each([null,0,false,{}])("rejects explicitly malformed audience %j rather than running the whole study",async invalid=>{
 const {d,config}=await fixture(),before=structuredClone(d);expect(()=>runImportedDatasetQuery({...config,audience:invalid as unknown as SavedImportedAudience})).toThrow(/audience/);expect(d).toEqual(before);
 const result=runImportedDatasetQuery(config);if(result.query.sourceIdentity?.kind==="imported")result.query.sourceIdentity.audience=invalid as unknown as SavedImportedAudience;
 const page=structuredClone(initialDashboard.pages[0]);page.tiles=[{...page.tiles[0],query:result.query,result}];expect(()=>assertExportResultsCurrent([page])).toThrow(/audience context/);
});
