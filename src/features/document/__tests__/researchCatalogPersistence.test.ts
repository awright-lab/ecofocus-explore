import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { importedResearchCatalog, filterResearchCatalog } from "../../data/researchCatalog";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { createPublishedSnapshot,createReportRecord,loadDashboardWorkspace,normalizeDashboardWorkspace,saveDashboardWorkspace,updateWorkspaceImportedDatasetField,workspaceStorageKey } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { workspaceSaveSession } from "../workspaceSaveSession";
let stored: Map<string,string>;
beforeEach(()=>{stored=new Map();workspaceSaveSession.remember(null);vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>{stored.set(key,value);}}});});
afterEach(()=>{workspaceSaveSession.remember(null);vi.unstubAllGlobals();});
async function fixture(){const dataset=(await importDatasetBuffer(new TextEncoder().encode("Answer,Region\nYes,North\nNo,North\nYes,South\n").buffer,"fabricated.csv")).dataset!;const draft={...structuredClone(initialDashboard),importedDatasets:[dataset]};return {dataset,workspace:normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]})};}
it("saves/reopens discovery labels without changing raw rows, calculations, IDs or historical snapshots",async()=>{
 const {dataset,workspace}=await fixture(),field=dataset.fields[0],historical=createPublishedSnapshot(workspace,workspace.reports[0].draft).workspace;
 const before=structuredClone(historical),result=runImportedDatasetQuery({dataset,field,metric:"count",chartType:"table"});
 const updated=updateWorkspaceImportedDatasetField(historical,dataset.id,field.id,{researchTopic:"Packaging",researchConcepts:["confidence","trust"]});
 expect(saveDashboardWorkspace(updated)).toBe(true);const reopened=loadDashboardWorkspace(),study=reopened.importedDatasets[0];
 expect(filterResearchCatalog(importedResearchCatalog([study]),"confidence")[0].field?.id).toBe(field.id);
 expect(study.rows).toEqual(dataset.rows);expect(study.importedAt).toBe(dataset.importedAt);expect(study.fields.map(field=>field.id)).toEqual(dataset.fields.map(field=>field.id));
 expect(runImportedDatasetQuery({dataset:study,field:study.fields[0],metric:"count",chartType:"table"}).table).toEqual(result.table);
 expect(reopened.publishedSnapshots[0].dashboard.importedDatasets[0].fields[0].researchTopic).toBeUndefined();expect(historical).toEqual(before);
});
it.each([{researchTopic:42},{researchConcepts:[42]},{researchConcepts:"trust"},{researchTopic:"x".repeat(121)},{researchConcepts:["x".repeat(81)]}])("preserves malformed stored metadata for recovery",async(bad)=>{
 const {workspace}=await fixture();expect(saveDashboardWorkspace(workspace)).toBe(true);const raw=JSON.parse(stored.get(workspaceStorageKey)!);Object.assign(raw.importedDatasets[0].fields[0],bad);const damaged=JSON.stringify(raw);stored.set(workspaceStorageKey,damaged);
 expect(()=>loadDashboardWorkspace()).toThrow();expect(stored.get(workspaceStorageKey)).toBe(damaged);
});
it("rejects malformed metadata updates without mutating the workspace",async()=>{const {dataset,workspace}=await fixture(),before=structuredClone(workspace);expect(()=>updateWorkspaceImportedDatasetField(workspace,dataset.id,dataset.fields[0].id,{researchConcepts:["x".repeat(81)]})).toThrow();expect(workspace).toEqual(before);});
it("keeps the prior persisted study and the in-memory labels when quota rejects saving",async()=>{
 const {dataset,workspace}=await fixture();expect(saveDashboardWorkspace(workspace)).toBe(true);const raw=stored.get(workspaceStorageKey),updated=updateWorkspaceImportedDatasetField(workspace,dataset.id,dataset.fields[0].id,{researchTopic:"Trust",researchConcepts:["confidence"]});
 vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:()=>{throw new DOMException("Synthetic quota","QuotaExceededError");}}});
 expect(saveDashboardWorkspace(updated)).toBe(false);expect(stored.get(workspaceStorageKey)).toBe(raw);expect(updated.importedDatasets[0].fields[0].researchTopic).toBe("Trust");expect(updated.importedDatasets[0].rows).toEqual(dataset.rows);expect(loadDashboardWorkspace().importedDatasets[0].fields[0].researchTopic).toBeUndefined();
});
