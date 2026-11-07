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

describe('aggregate raw backup amplification guard', () => {
 it('refuses a theoretical 600M-character repeated-key payload before calling JSON.stringify', async () => {
  const {workspace,dataset}=await fixture(), key='H'.repeat(100_000);
  const rows=Array.from({length:6_000},()=>({[key]:'x'}));
  dataset.rows=rows;dataset.previewRows=[];dataset.rowCount=rows.length;workspace.importedDatasets=[dataset];
  const serialize=vi.spyOn(JSON,'stringify').mockImplementation(()=>{throw Error('Unsafe serialization attempted');});
  try {
   expect(()=>createWorkspaceBackup(workspace)).toThrow('No backup was generated');
   expect(serialize).not.toHaveBeenCalled();expect(dataset.rows).toBe(rows);expect(rows).toHaveLength(6_000);expect(rows[0][key]).toBe('x');
  } finally {serialize.mockRestore();}
 });
 it.each(['report','snapshot','pending','preview'] as const)('counts %s copies and aliases against the same total budget', async scope=>{
  const {workspace,dataset}=await fixture(),key='H'.repeat(100_000);
  // One repeated-key collection is roughly 10M characters; two exceed the
  // policy. Objects and their existing key strings are small; no big JSON runs.
  dataset.rows=Array.from({length:100},()=>({[key]:'x'}));dataset.previewRows=[];dataset.rowCount=100;workspace.importedDatasets=[dataset];
  let pending:typeof dataset[]=[];
  if(scope==='report')workspace.reports[0].draft.importedDatasets=[dataset];
  if(scope==='snapshot')workspace.publishedSnapshots=[{id:'synthetic',reportId:workspace.reports[0].id,title:'Synthetic',versionLabel:'Test',publishedAt:'2026-11-07T00:00:00Z',viewerPath:'/synthetic',dashboard:{...workspace.reports[0].draft,importedDatasets:[dataset]}}];
  if(scope==='pending')pending=[dataset];
  if(scope==='preview')dataset.previewRows=dataset.rows;
  const serialize=vi.spyOn(JSON,'stringify').mockImplementation(()=>{throw Error('Unsafe serialization attempted');});
  try {expect(()=>createWorkspaceBackup(workspace,pending)).toThrow('supported serialization limits');expect(serialize).not.toHaveBeenCalled();expect(dataset.rows).toHaveLength(100);}
  finally {serialize.mockRestore();}
 });
 it('also bounds inventory scope amplification before the final envelope can be stringified', async()=>{
  const {workspace,dataset}=await fixture();workspace.importedDatasets=[];
  workspace.reports[0].id='R'.repeat(100_000);workspace.reports[0].draft.importedDatasets=Array.from({length:1_000},()=>dataset);
  // Keep this regression allocation-safe even if a guard later regresses.
  // Raw serialization is replaced with a tiny token; inventory alone exceeds
  // its limit by repeating the long report identity, and must be rejected.
  const serialize=vi.spyOn(JSON,'stringify').mockReturnValue('"bounded test payload"');
  try {expect(()=>createWorkspaceBackup(workspace)).toThrow('No backup was generated');expect(serialize).toHaveBeenCalledTimes(2);}
  finally {serialize.mockRestore();}
 });
});
