import { describe, expect, it, vi, afterEach } from "vitest";
import { createWorkspaceBackup } from "../workspaceBackup";
import { initialDashboard } from "../documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace, createPublishedSnapshot } from "../workspacePersistence";
import { importDatasetBuffer } from "../../data/datasetImportModel";
async function fixture() {
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Answer,Spend\nYes,10\nNo,20\n").buffer,"synthetic.csv");
 const dataset=parsed.dataset!;
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(structuredClone(initialDashboard))],importedDatasets:[dataset]});
 return {workspace,dataset};
}
afterEach(()=>vi.unstubAllGlobals());
describe("portable workspace backup artifact",()=>{
 it("tags the payload format/version and preserves the entire in-memory workspace without compaction",async()=>{
  const {workspace,dataset}=await fixture(), withSnapshot=createPublishedSnapshot(workspace,workspace.reports[0].draft).workspace;
  const original=structuredClone(withSnapshot), backup=createWorkspaceBackup(withSnapshot,[],"2026-11-05T06:00:00Z");
  expect(backup).toMatchObject({kind:"ecofocus-workspace-backup",version:1,format:"workspace-v2",createdAt:"2026-11-05T06:00:00Z"});
  expect(JSON.parse(backup.payload)).toEqual(withSnapshot);expect(JSON.parse(backup.payload).importedDatasets[0].rows).toEqual(dataset.rows);
  expect(backup.inventory).toMatchObject({reports:1,snapshots:1,requiresSourceData:false,requiresRemoteAccess:false});expect(withSnapshot).toEqual(original);
 });
 it("retains conflicting scoped study copies without normalization or ID merging",async()=>{
  const {workspace,dataset}=await fixture();const other={...structuredClone(dataset),rows:[{Answer:"Original distinct answer",Spend:"999"}],rowCount:1};
  workspace.reports[0].draft.importedDatasets=[other];const backup=createWorkspaceBackup(workspace), decoded=JSON.parse(backup.payload);
  expect(decoded.importedDatasets[0].rows[0].Answer).toBe("Yes");expect(decoded.reports[0].draft.importedDatasets[0].rows[0].Answer).toBe("Original distinct answer");
  expect(backup.inventory.studies.map(study=>study.scope)).toEqual(["workspace",`report:${workspace.reports[0].id}`]);
 });
 it("discloses partial rows, missing metadata and remote dependencies without fetching",async()=>{
  const {workspace,dataset}=await fixture();dataset.rowCount=100;dataset.fieldCount=5;dataset.rows=[];dataset.previewRows=[{Answer:"Yes",Spend:"10"}];
  dataset.remote={provider:"netlify",projectUrl:"",bucket:"",objectPath:"synthetic.csv",uploadedAt:dataset.importedAt};workspace.importedDatasets=[dataset];
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);vi.stubGlobal("window",{localStorage:{setItem:vi.fn(()=>{throw Error("Must not write");})}});
  const backup=createWorkspaceBackup(workspace);expect(backup.inventory).toMatchObject({requiresSourceData:true,requiresRemoteAccess:true});
  expect(backup.inventory.studies[0]).toMatchObject({declaredRows:100,storedRows:0,previewRows:1,rowCoverage:"partial",declaredFields:5,storedFields:2,hasCompleteFields:false,remoteProvider:"netlify"});
  expect(JSON.parse(backup.payload).importedDatasets[0]).toEqual(dataset);expect(fetcher).not.toHaveBeenCalled();expect(window.localStorage.setItem).not.toHaveBeenCalled();
 });
 it("preserves pending imports separately and snapshots their values at creation",async()=>{
  const {workspace,dataset}=await fixture();const backup=createWorkspaceBackup(workspace,[dataset]);dataset.rows[0].Answer="Changed after backup";
  expect(backup.inventory.pendingImports).toBe(1);expect(JSON.parse(backup.pendingImportsPayload)[0].rows[0].Answer).toBe("Yes");
  expect(backup.inventory.studies.some(study=>study.scope==="pending-imports")).toBe(true);
 });
 it("does not claim live-source workspaces are self-contained",async()=>{
  const {workspace}=await fixture();workspace.liveDatasetSources=[{sourceRef:{id:"synthetic-live",kind:"live_connection",provider:"snowflake",label:"Synthetic",datasetId:"synthetic-live"},connectionId:"synthetic-connection",objectType:"table",objectPath:"synthetic",label:"Synthetic",syncMode:"live_query",status:"available",statusLabel:"Available"}];
  expect(createWorkspaceBackup(workspace).inventory.requiresRemoteAccess).toBe(true);
 });
});
