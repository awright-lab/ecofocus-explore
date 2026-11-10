import { describe, expect, it, vi } from "vitest";
import { initialDashboard } from "../documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { createReportRecord, normalizeDashboardWorkspace, removeWorkspaceImportedDataset } from "../workspacePersistence";
import { importedStudyUsage, importedStudySafeguards, importedStudyRemovalBlocker, editorStudyRemovalBlocker } from "../importedStudyUsage";

async function fixture() {
 const parsed=await importDatasetBuffer(new TextEncoder().encode("Answer,Spend\nYes,10\nNo,20\n").buffer,"synthetic.csv");
 const dataset=parsed.dataset!, draft=structuredClone(initialDashboard);draft.importedDatasets=[dataset];draft.pages=[draft.pages[0]];draft.pages[0].elements=[];draft.pages[0].tiles=[draft.pages[0].tiles[0]];
 const tile=draft.pages[0].tiles[0], result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:"count",chartType:"table"});tile.query=result.query;tile.result=result;
 tile.source={kind:"importedField",id:`${dataset.id}:${dataset.fields[0].id}`,label:"Answer",datasetId:dataset.id,fieldId:dataset.fields[0].id};
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});return {workspace,dataset,tile:workspace.reports[0].draft.pages[0].tiles[0]};
}
describe("dependency-aware study removal",()=>{
 it.each(["Undo", "Redo"])("keeps source rows when %s can restore a deleted analysis",async(kind)=>{
  const {workspace,dataset}=await fixture(),historical=structuredClone(workspace.reports[0].draft);workspace.reports[0].draft.pages[0].tiles=[];
  expect(importedStudyUsage(workspace,dataset.id)).toHaveLength(0);
  expect(editorStudyRemovalBlocker(dataset.id,kind==="Undo"?[historical]:[],kind==="Redo"?[historical]:[],false)).toContain("Undo or Redo");
  expect(editorStudyRemovalBlocker(dataset.id,[],[],false)).toBeNull();
 });
 it("waits for in-flight creation to settle without dropping any source",()=>{
  expect(editorStudyRemovalBlocker("study",[],[],true)).toContain("running analysis");
 });
 it("also protects legacy embedded study copies in editing history without analytical references",async()=>{
  const {workspace,dataset}=await fixture(),draft=workspace.reports[0].draft;draft.pages[0].tiles=[];
  expect(editorStudyRemovalBlocker(dataset.id,[draft],[],false)).toContain("restore this study");
  expect(editorStudyRemovalBlocker(dataset.id,[],[draft],false)).toContain("restore this study");
 });
 it("rejects a referenced study and preserves every row and original object",async()=>{
  const {workspace,dataset}=await fixture(),original=structuredClone(workspace);
  expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/still used.*data has been kept/);expect(workspace).toEqual(original);expect(importedStudyUsage(workspace,dataset.id)[0].location).toContain(workspace.reports[0].draft.pages[0].title);
 });
 it.each(["source","query","executed query","metadata"])("recognizes an imported dependency recorded only in %s",async(kind)=>{
  const {workspace,dataset,tile}=await fixture(),source=structuredClone(tile.source),query=structuredClone(tile.query),metadata=structuredClone(tile.result.metadataRefs);
  tile.source=structuredClone(initialDashboard.pages[0].tiles[0].source);tile.query=structuredClone(initialDashboard.pages[0].tiles[0].query);tile.result.query=tile.query;tile.result.metadataRefs=structuredClone(initialDashboard.pages[0].tiles[0].result.metadataRefs);
  if(kind==="source")tile.source=source;if(kind==="query")tile.query=query;if(kind==="executed query")tile.result.query=query;if(kind==="metadata")tile.result.metadataRefs=metadata;
  expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/still used/);
 });
 it("protects other and archived reports as well as the active report",async()=>{
  const {workspace,dataset}=await fixture();workspace.reports[0].archived=true;workspace.reports.unshift(createReportRecord({...structuredClone(initialDashboard),id:"other",importedDatasets:[]}));workspace.activeReportId="other";
  expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/still used/);
 });
 it.each(["templates","derivedDefinitions"] as const)("protects a saved %s query after its canvas tile was removed",async(kind)=>{
  const {workspace,dataset,tile}=await fixture(),library=workspace.reports[0].draft.analysisLibrary;
  if(kind==="templates")library.templates.push({id:"synthetic_template",datasetId:tile.query.dataset,label:"Synthetic saved analysis",description:"",source:{kind:"question",id:tile.query.question,label:"Answer"},query:tile.query,visualization:"table",summary:{sourceLabel:"Answer",bannerLabel:"Total",filterLabel:"All",weightLabel:"None",confidenceLabel:"None",comparisonLabel:"None"}});
  else library.derivedDefinitions.push({id:"synthetic_derived",datasetId:tile.query.dataset,label:"Synthetic saved calculation",description:"",source:{kind:"question",id:tile.query.question,label:"Answer"},sourceTileId:tile.id,sourceTileTitle:tile.title,query:tile.query,outputKind:"lead_row_summary",spec:{columnId:"summary",columnLabel:"Total"},summary:{outputLabel:"Summary",sourceLabel:"Answer",structureLabel:"Total",queryLabel:"Count"}});
  workspace.reports[0].draft.pages[0].tiles=[];
  expect(importedStudyUsage(workspace,dataset.id).some(item=>item.location.startsWith("Saved"))).toBe(true);expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/still used/);
 });
 it("protects imported tiles retained inside reusable composition blocks",async()=>{
  const {workspace,dataset,tile}=await fixture(),draft=workspace.reports[0].draft;draft.designLibrary.compositionBlocks.push({id:"synthetic_block",label:"Synthetic reusable layout",description:"",category:"chart_commentary",createdAt:1,summary:{objectCount:1,tileCount:1,elementCount:0,width:tile.layout.width,height:tile.layout.height},items:[{kind:"tile",tile,relativeLayout:tile.layout}]});draft.pages[0].tiles=[];
  expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/Saved layout/);
 });
 it("removes unused embedded draft copies without resurrecting them, preserving owned snapshots",async()=>{
  const {workspace,dataset}=await fixture(),draft=workspace.reports[0].draft;
  workspace.publishedSnapshots=[{id:"snapshot",reportId:draft.id,title:draft.title,versionLabel:"v1",publishedAt:"2026-11-05T00:00:00Z",viewerPath:"#snapshot",dashboard:structuredClone(draft)}];draft.pages[0].tiles=[];
  const original=structuredClone(workspace),removed=removeWorkspaceImportedDataset(workspace,dataset.id),reopened=normalizeDashboardWorkspace(removed);
  expect(reopened.importedDatasets).toHaveLength(0);expect(reopened.reports[0].draft.importedDatasets).toHaveLength(0);expect(removed.publishedSnapshots).toEqual(original.publishedSnapshots);expect(workspace).toEqual(original);
 });
 it("protects legacy snapshots that still depend on the workspace study copy",async()=>{
  const {workspace,dataset}=await fixture(),draft=workspace.reports[0].draft,snapshot=structuredClone(draft);snapshot.importedDatasets=[];
  workspace.publishedSnapshots=[{id:"snapshot",reportId:draft.id,title:draft.title,versionLabel:"v1",publishedAt:"2026-11-05T00:00:00Z",viewerPath:"#snapshot",dashboard:snapshot}];draft.pages[0].tiles=[];
  expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/Snapshot v1/);
 });
});


it("retains a valid Responses reference alongside unreadable-plan safeguards without counting the warning as a reference", async () => {
  const f = await fixture(); f.tile.title = "Responses"; Object.assign(f.workspace.reports[0].draft, { insightReviewPlans: [{ unsupported: true }] }); const before = JSON.stringify(f.workspace);
  const known = importedStudyUsage(f.workspace, f.dataset.id), safeguards = importedStudySafeguards(f.workspace, f.dataset.id);
  expect(known).toHaveLength(1); expect(known[0].location).toContain(": Responses"); expect(known[0].location).not.toContain("Unreadable"); expect(safeguards).toHaveLength(1); expect(safeguards[0].reason).toBe("unreadable_insight_plans"); expect(safeguards[0].location).toContain("Unreadable saved insight plans");
  expect(importedStudyRemovalBlocker(f.workspace, f.dataset.id)).toContain("unreadable source dependencies"); expect(() => removeWorkspaceImportedDataset(f.workspace, f.dataset.id)).toThrow("Unreadable saved insight plans"); expect(JSON.stringify(f.workspace)).toBe(before);
});
it("keeps a readable source identity in an otherwise quarantined saved plan as a known reference", async () => {
  const f = await fixture(); Object.assign(f.workspace.reports[0].draft, { insightReviewPlans: [{ plan: { datasetId: f.dataset.id } }] });
  expect(importedStudyUsage(f.workspace, f.dataset.id).map(item => item.location)).toEqual(expect.arrayContaining(["Saved insight review plans", expect.stringContaining(": ")])); expect(importedStudySafeguards(f.workspace, f.dataset.id)).toHaveLength(1);
});
it("separates known legacy-snapshot references from their unknown-plan safeguards", async () => {
  const f = await fixture(), historical = structuredClone(f.workspace.reports[0].draft); Object.assign(historical, { insightReviewPlans: [{ unsupported: true }] }); historical.importedDatasets = []; f.workspace.publishedSnapshots = [{ id: "legacy-unknown", reportId: historical.id, title: historical.title, versionLabel: "v-old", publishedAt: "2026-11-09T00:00:00.000Z", viewerPath: "#legacy", dashboard: historical }]; f.workspace.reports[0].draft.pages[0].tiles = [];
  expect(importedStudyUsage(f.workspace, f.dataset.id)).toEqual([expect.objectContaining({ location: expect.stringContaining("Snapshot v-old:") })]); expect(importedStudySafeguards(f.workspace, f.dataset.id)).toEqual([expect.objectContaining({ location: expect.stringContaining("Snapshot v-old: Unreadable") })]); expect(() => removeWorkspaceImportedDataset(f.workspace, f.dataset.id)).toThrow("Unreadable");
});
it("does not turn a snapshot's independent unreadable plans into a mutable-library dependency when it owns its study", async () => {
  const f = await fixture(), historical = structuredClone(f.workspace.reports[0].draft); Object.assign(historical, { insightReviewPlans: [{ unsupported: true }] }); f.workspace.publishedSnapshots = [{ id: "owned-unknown", reportId: historical.id, title: historical.title, versionLabel: "v-owned", publishedAt: "2026-11-09T00:00:00.000Z", viewerPath: "#owned", dashboard: historical }]; f.workspace.reports[0].draft.pages[0].tiles = []; const before = JSON.stringify(f.workspace);
  expect(importedStudyUsage(f.workspace, f.dataset.id)).toEqual([]); expect(importedStudySafeguards(f.workspace, f.dataset.id)).toEqual([]); const removed = removeWorkspaceImportedDataset(f.workspace, f.dataset.id); expect(removed.importedDatasets).toEqual([]); expect(removed.publishedSnapshots).toEqual(f.workspace.publishedSnapshots); expect(JSON.stringify(f.workspace)).toBe(before);
});
it("preserves Undo/Redo retention for unreadable plans even without another identifiable source reference", async () => {
  const f = await fixture(), historical = structuredClone(f.workspace.reports[0].draft); historical.pages[0].tiles = []; historical.importedDatasets = []; Object.assign(historical, { insightReviewPlans: [{ unsupported: true }] }); const before = JSON.stringify(historical);
  expect(editorStudyRemovalBlocker(f.dataset.id, [historical], [], false)).toContain("Undo or Redo"); expect(editorStudyRemovalBlocker(f.dataset.id, [], [historical], false)).toContain("Undo or Redo"); expect(JSON.stringify(historical)).toBe(before);
});

it("enumerates valid references without executing an unreadable-plan getter while keeping removal blocked", async () => {
  const f = await fixture(), draft = f.workspace.reports[0].draft, get = vi.fn(() => { throw Error("Do not execute saved metadata"); }); Object.defineProperty(draft, "insightReviewPlans", { enumerable: true, configurable: true, get });
  expect(importedStudyUsage(f.workspace, f.dataset.id)).toHaveLength(1); expect(importedStudySafeguards(f.workspace, f.dataset.id)).toHaveLength(1); expect(() => removeWorkspaceImportedDataset(f.workspace, f.dataset.id)).toThrow("Unreadable saved insight plans"); expect(get).not.toHaveBeenCalled(); expect(Object.getOwnPropertyDescriptor(draft, "insightReviewPlans")?.get).toBe(get);
});
