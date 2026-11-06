// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { createCanvasElement } from "../../builder/builderDocumentCommands";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { captureNarrativeCell, narrativeState, narrativeCitation, narrativeEvidenceIssue, narrativeStudyIds, reviewNarrative } from "../narrativeEvidence";
import { createReportRecord,normalizeDashboardWorkspace,saveDashboardWorkspace,loadDashboardWorkspace,workspaceStorageKey,createPublishedSnapshot,duplicateReportRecord } from "../../document/workspacePersistence";
import { draftImportedStudyReferences } from "../../document/importedStudyUsage";
import { assertExportResultsCurrent } from "../../export/exportIntegrity";
import { buildReportPreflight } from "../../export/reportPreflight";
import { buildPageVisualSvg } from "../../export/pageVisualExport";
import { buildXlsxBlob,buildPptxBlob,buildPdfBlob } from "../../export/coreDocumentExports";
import { buildEditableSlideReconstruction } from "../../export/pptxEditableReconstruction";
import type { AnalyticsSourceIdentity } from "../../../../shared/types/analytics";
import type { SavedCompositionBlock } from "../../../../shared/types/dashboard";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasElementRenderer } from "../../builder/components/CanvasRenderers";

async function fixture(){
 const imported=await importDatasetBuffer(new TextEncoder().encode("Region,Spend\nNorth,10\nSouth,20\nNorth,30\n").buffer,"synthetic-narrative.csv");
 const dataset=imported.dataset!,draft=structuredClone(initialDashboard),result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:"count",chartType:"table"});
 draft.importedDatasets=[dataset];draft.pages[0].tiles=[{...draft.pages[0].tiles[0],id:"source",title:"Regional responses",result,query:result.query,visualization:"table",layout:{x:10,y:10,width:1200,height:690,zIndex:1}}];draft.pages[0].elements=[];
 const notePage=structuredClone(draft.pages[0]);notePage.id="claim-page";notePage.title="Conclusions";notePage.order=2;notePage.tiles=[];
 const element=createCanvasElement("text",notePage);element.id="claim";element.content="North has two responses.";element.layout={x:30,y:30,width:1180,height:500,zIndex:1};element.style.fontSize=18;element.style.padding=12;notePage.elements=[element];draft.pages.push(notePage);
 const row=result.table.find(row=>row.label==="North")!,ref={tileId:"source",rowId:row.optionId,columnId:result.columns[0].id};
 element.evidence=reviewNarrative(element,draft.pages,[ref]);return{draft,dataset,element,ref,tile:draft.pages[0].tiles[0]};
}
beforeEach(()=>localStorage.clear());
async function zipXml(blob:Blob){const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),files=new Map<string,string>();let offset=0;while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),names=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),start=offset+30+names+extra,name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+names));if(name.endsWith(".xml"))files.set(name,new TextDecoder().decode(bytes.subarray(start,start+size)));offset=start+size;}return files;}
it("records exact evidence across pages without modifying text or result and treats styling as cosmetic",async()=>{
 const {draft,element,tile,ref}=await fixture(),before=structuredClone(tile);expect(narrativeState(element,draft.pages)).toEqual({current:true,reasons:[]});
 expect(element.evidence!.links[0].snapshot).toMatchObject({value:2,base:3,rowLabel:"North",tileTitle:"Regional responses"});expect(narrativeCitation(element)).toContain("North / Total = 2");
 tile.appearance.labelColor="#ff0000";tile.visualization="vertical_bar";tile.query={...tile.query,chartType:"vertical_bar"};expect(narrativeState(element,draft.pages)?.current).toBe(true);
 expect(element.content).toBe("North has two responses.");expect(tile.result).toEqual(before.result);expect(captureNarrativeCell(draft.pages,ref).snapshot.value).toBe(2);
});
it.each(["value","base","source","metric","weight","inference","wording","sourceCategoryKey"])("requires review when recorded %s changes",async change=>{
 const {draft,element,tile}=await fixture(),result=tile.result,row=result.table.find(row=>row.label==="North")!,column=result.columns[0].id;
 if(change==="value")row.values[column]=3;if(change==="base")row.bases[column]=4;
 if(change==="source")result.metadataRefs.source={...result.metadataRefs.source!,datasetLabel:"A replacement source"};
 if(change==="metric")result.metric.label="Different metric";if(change==="weight")result.weighting.label="Different weighting context";
 if(change==="inference")result.statistics.confidenceLevel=0.9;if(change==="wording")row.label="North renamed";if(change==="sourceCategoryKey")row.sourceCategoryKey="changed-source-key";
 expect(narrativeState(element,draft.pages)?.current).toBe(false);expect(element.evidence!.links[0].snapshot.value).toBe(2);expect(element.content).toBe("North has two responses.");
 element.evidence=reviewNarrative(element,draft.pages,element.evidence!.links);expect(narrativeState(element,draft.pages)?.current).toBe(true);
});
it("flags changed text, pending settings, removed sources/cells and ambiguous IDs instead of rebinding",async()=>{
 const {draft,element,tile}=await fixture();element.content="North now has three responses.";expect(narrativeState(element,draft.pages)?.reasons[0]).toContain("written claim changed");
 element.content=element.evidence!.reviewedContent;tile.query={...tile.query,weight:"population" as typeof tile.query.weight};expect(narrativeState(element,draft.pages)?.reasons.join()).toContain("Refresh the source");tile.query=tile.result.query;
 draft.pages[0].tiles.push(structuredClone(tile));expect(narrativeState(element,draft.pages)?.reasons.join()).toContain("ambiguous");draft.pages[0].tiles=[];expect(narrativeState(element,draft.pages)?.current).toBe(false);
 draft.pages[0].tiles=[tile];tile.result.table=[];expect(narrativeState(element,draft.pages)?.current).toBe(false);
});
it("declines unavailable cells, duplicate links and invalid saved metadata without changing raw recovery",async()=>{
 const {draft,element,tile,ref}=await fixture();expect(()=>reviewNarrative(element,draft.pages,[ref,ref])).toThrow(/duplicate/);
 tile.result.table.find(row=>row.optionId===ref.rowId)!.values[ref.columnId]=NaN;expect(()=>captureNarrativeCell(draft.pages,ref)).toThrow(/unavailable|invalid/);
 for(const value of [null,false,{}, {version:1,links:[]}])expect(narrativeEvidenceIssue(value)).toBeTruthy();
 const good=await fixture(),workspace=normalizeDashboardWorkspace({reports:[createReportRecord(good.draft)],importedDatasets:[good.dataset]});expect(saveDashboardWorkspace(workspace)).toBe(true);
 const raw=JSON.parse(localStorage.getItem(workspaceStorageKey)!);raw.reports[0].draft.pages[1].elements[0].evidence={version:1};const damaged=JSON.stringify(raw);localStorage.setItem(workspaceStorageKey,damaged);expect(()=>loadDashboardWorkspace()).toThrow(/evidence/);expect(localStorage.getItem(workspaceStorageKey)).toBe(damaged);
});
it("persists and duplicates links, preserves snapshot-only source data and retains orphaned evidence dependencies",async()=>{
 const {draft,dataset,element}=await fixture(),workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});expect(saveDashboardWorkspace(workspace)).toBe(true);
 const reopened=loadDashboardWorkspace();expect(reopened.reports[0].draft.pages[1].elements[0].evidence).toEqual(element.evidence);expect(narrativeState(reopened.reports[0].draft.pages[1].elements[0],reopened.reports[0].draft.pages)?.current).toBe(true);
 const copy=duplicateReportRecord(reopened,reopened.reports[0]).report.draft;expect(narrativeState(copy.pages[1].elements[0],copy.pages)?.current).toBe(true);
 draft.pages[0].tiles=[];expect(draftImportedStudyReferences(draft)).toContainEqual({datasetId:dataset.id,location:"Conclusions: evidence for Text"});
 const snap=createPublishedSnapshot(workspace,draft).snapshot;expect(snap.dashboard.importedDatasets.find(item=>item.id===dataset.id)?.rows).toEqual(dataset.rows);expect(snap.dashboard.pages[1].elements[0].evidence).toEqual(element.evidence);
});
it("includes citations in SVG, editable PowerPoint and Excel and blocks stale exports before rasterization",async()=>{
 const {draft,element,tile}=await fixture();expect(()=>assertExportResultsCurrent(draft.pages)).not.toThrow();expect(buildPageVisualSvg(draft.pages[1])).toContain("Recorded evidence:");
 const ppt=buildEditableSlideReconstruction(draft.pages[1],1);expect(ppt.editableXml).toContain("Recorded evidence:");expect(ppt.editableXml).toContain("North has two responses.");
 const xlsx=await zipXml(buildXlsxBlob(draft,draft.pages));expect(xlsx.get("xl/workbook.xml")).toContain("2-Evidence");const evidenceSheet=[...xlsx.values()].find(xml=>xml.includes("Written claim"))!;expect(evidenceSheet).toContain("North has two responses.");expect(evidenceSheet).toContain("Recorded evidence:");expect(evidenceSheet).toContain("Evidence definition (JSON)");expect(evidenceSheet).toContain("recorded base 3");
 tile.result.table.find(row=>row.label==="North")!.values.summary=3;expect(buildReportPreflight(draft)[1].issues.some(issue=>issue.check==="Narrative evidence")).toBe(true);
 expect(()=>buildXlsxBlob(draft,draft.pages)).toThrow(/Review evidence/);await expect(buildPptxBlob(draft.pages)).rejects.toThrow(/Review evidence/);await expect(buildPdfBlob(draft.pages)).rejects.toThrow(/Review evidence/);
 expect(element.content).toBe("North has two responses.");expect(element.evidence!.links[0].snapshot.value).toBe(2);
});
it("requires source pages for a subset export and leaves ordinary unlinked text unchanged",async()=>{
 const {draft,element}=await fixture();expect(()=>assertExportResultsCurrent([draft.pages[1]])).toThrow(/source analysis is missing/);delete element.evidence;expect(narrativeState(element,draft.pages)).toBeNull();expect(narrativeCitation(element)).toBe("");expect(()=>assertExportResultsCurrent([draft.pages[1]])).not.toThrow();
});
it("refuses clipped linked text and keeps complete citations within the readable text block",async()=>{
 const {draft,element}=await fixture();element.layout.x=518;expect(()=>assertExportResultsCurrent(draft.pages)).toThrow(/inside the page/);expect(()=>buildPageVisualSvg(draft.pages[1])).toThrow(/inside the page/);
 element.layout.x=30;const svg=buildPageVisualSvg(draft.pages[1]);expect(svg).toContain("Recorded evidence:");expect(svg).toContain("recorded base 3");const lines=[...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(match=>match[1]);expect(lines.length).toBeGreaterThan(2);expect(lines.join(" ")).toContain("North / Total = 2 (recorded base 3)");
 element.layout.height=35;expect(()=>buildPageVisualSvg(draft.pages[1])).toThrow(/cannot fit/);
});
it.each(["seeded","cached_live"] as const)("tracks recorded %s result context without claiming a live service check",async kind=>{
 const {draft,element,tile,ref}=await fixture();
 const source:AnalyticsSourceIdentity=kind==="seeded"?{kind:"seeded",datasetId:"ecofocus_2025",questionId:tile.result.query.question,datasetLabel:"Synthetic sample",questionLabel:"Synthetic wording"}:
  {kind:"live",connectionId:"synthetic-connection",provider:"snowflake",datasetLabel:"Synthetic cached result",objectPath:"TEST.PUBLIC.SYNTHETIC",objectType:"table",syncMode:"snapshot",sourceRef:{id:"synthetic-live",kind:"live_connection",provider:"snowflake",label:"Synthetic cached source",datasetId:"synthetic-live",connectionId:"synthetic-connection"}};
 tile.result={...tile.result,query:{...tile.result.query,sourceIdentity:source,sourceRef:source.sourceRef},metadataRefs:{...tile.result.metadataRefs,source}};tile.query=tile.result.query;
 element.evidence=reviewNarrative(element,draft.pages,[ref]);expect(narrativeState(element,draft.pages)?.current).toBe(true);
 tile.result.metadataRefs.source=source.kind==="live"?{...source,objectPath:"TEST.PUBLIC.REPLACED"}:{...source,questionLabel:"Changed wording"};expect(narrativeState(element,draft.pages)?.current).toBe(false);
});
it("records weighted bases as totals without treating them as respondent counts",async()=>{
 const {draft,element,tile,ref}=await fixture();tile.result.table.find(row=>row.optionId===ref.rowId)!.bases[ref.columnId]=2.5;expect(()=>captureNarrativeCell(draft.pages,ref)).toThrow(/invalid base/);tile.result.weighting={applied:true,id:tile.result.weighting.id,label:"Synthetic weights"};
 element.evidence=reviewNarrative(element,draft.pages,[ref]);expect(element.evidence.links[0].snapshot.base).toBe(2.5);expect(JSON.parse(element.evidence.links[0].snapshot.context).weighting.applied).toBe(true);expect(narrativeCitation(element)).toContain("recorded base 2.5");
});
it("retains multiple reviewed cells and flags a change to either linked result",async()=>{
 const {draft,element,tile,ref}=await fixture(),south=tile.result.table.find(row=>row.label==="South")!;
 element.evidence=reviewNarrative(element,draft.pages,[ref,{...ref,rowId:south.optionId}]);const original=structuredClone(element.evidence);expect(narrativeState(element,draft.pages)?.current).toBe(true);
 south.values[ref.columnId]=2;expect(narrativeState(element,draft.pages)?.current).toBe(false);expect(element.evidence).toEqual(original);expect(narrativeCitation(element)).toContain("South / Total = 1");
});
it("retains study rows for linked claims stored only in reusable layouts and rejects damaged library evidence without overwriting recovery",async()=>{
 const {draft,dataset,element}=await fixture();
 const block:SavedCompositionBlock={id:"saved-claim",label:"Saved claim",description:"Synthetic saved narrative",category:"narrative",createdAt:1,summary:{objectCount:1,tileCount:0,elementCount:1,width:element.layout.width,height:element.layout.height},items:[{kind:"element",element:structuredClone(element),relativeLayout:element.layout}]};
 draft.designLibrary.compositionBlocks=[block];draft.pages.forEach(page=>{page.elements=[];page.tiles=[];});draft.importedDatasets=[];
 expect(draftImportedStudyReferences(draft)).toContainEqual({datasetId:dataset.id,location:"Saved layout: Saved claim"});
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});const snapshot=createPublishedSnapshot(workspace,draft).snapshot;expect(snapshot.dashboard.importedDatasets.find(item=>item.id===dataset.id)?.rows).toEqual(dataset.rows);
 expect(saveDashboardWorkspace(workspace)).toBe(true);const reopened=loadDashboardWorkspace();expect(reopened.reports[0].draft.designLibrary.compositionBlocks[0].items[0]).toMatchObject({kind:"element",element:{evidence:element.evidence}});
 const raw=JSON.parse(localStorage.getItem(workspaceStorageKey)!);raw.reports[0].draft.designLibrary.compositionBlocks[0].items[0].element.evidence=null;const damaged=JSON.stringify(raw);localStorage.setItem(workspaceStorageKey,damaged);expect(()=>loadDashboardWorkspace()).toThrow(/evidence/);expect(localStorage.getItem(workspaceStorageKey)).toBe(damaged);
});
it.each(["999999%","2%"," 2","NaN"])("rejects altered stored citation %s across state, rendering, exports and persisted recovery",async altered=>{
 const {draft,element,dataset}=await fixture(),original=structuredClone(draft),link=element.evidence!.links[0];link.snapshot.displayValue=altered;
 expect(narrativeEvidenceIssue(element.evidence)).toMatch(/display value is inconsistent/);const state=narrativeState(element,draft.pages)!;expect(state.current).toBe(false);expect(narrativeCitation(element)).not.toContain(altered);expect(narrativeCitation(element)).toContain("Evidence needs review");
 const html=renderToStaticMarkup(createElement(CanvasElementRenderer,{element,selected:false,onSelect:()=>{},evidenceWarning:state.reasons.join(" ")}));expect(html).toContain("Evidence needs review");expect(html).not.toContain(`= ${altered} (`);
 expect(()=>buildXlsxBlob(draft,draft.pages)).toThrow(/display value is inconsistent/);await expect(buildPdfBlob(draft.pages)).rejects.toThrow(/display value is inconsistent/);await expect(buildPptxBlob(draft.pages)).rejects.toThrow(/display value is inconsistent/);
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(original)],importedDatasets:[dataset]});expect(saveDashboardWorkspace(workspace)).toBe(true);const raw=JSON.parse(localStorage.getItem(workspaceStorageKey)!);raw.reports[0].draft.pages[1].elements[0].evidence.links[0].snapshot.displayValue=altered;const damaged=JSON.stringify(raw);localStorage.setItem(workspaceStorageKey,damaged);expect(()=>loadDashboardWorkspace()).toThrow(/display value is inconsistent/);expect(localStorage.getItem(workspaceStorageKey)).toBe(damaged);
 expect(original.pages[1].elements[0].evidence!.links[0].snapshot.displayValue).toBe("2");
});
it("rejects missing or unsupported stored citation formats and detects a coherent but changed format",async()=>{
 const {draft,element}=await fixture(),snapshot=element.evidence!.links[0].snapshot,context=JSON.parse(snapshot.context);
 context.metric.valueFormat="unknown";snapshot.context=JSON.stringify(context);expect(narrativeEvidenceIssue(element.evidence)).toContain("invalid metric format");
 context.metric.valueFormat="percent";snapshot.context=JSON.stringify(context);snapshot.displayValue="2%";expect(narrativeEvidenceIssue(element.evidence)).toBeNull();expect(narrativeState(element,draft.pages)?.current).toBe(false);
});
it.each([{stored:[]},{stored:["unrelated-study"]},{stored:["duplicate","duplicate"]}])("rejects inconsistent stored study references $stored while retaining readable source dependencies",async({stored})=>{
 const {draft,element,dataset}=await fixture();element.evidence!.links[0].snapshot.studyIds=stored;
 expect(narrativeEvidenceIssue(element.evidence)).toMatch(/study references are inconsistent/);expect(narrativeState(element,draft.pages)?.current).toBe(false);expect(()=>assertExportResultsCurrent(draft.pages)).toThrow(/study references are inconsistent/);
 draft.pages[0].tiles=[];expect(narrativeStudyIds(element.evidence)).toContain(dataset.id);expect(draftImportedStudyReferences(draft)).toContainEqual({datasetId:dataset.id,location:"Conclusions: evidence for Text"});
 const valid=await fixture(),workspace=normalizeDashboardWorkspace({reports:[createReportRecord(valid.draft)],importedDatasets:[valid.dataset]});expect(saveDashboardWorkspace(workspace)).toBe(true);
 const raw=JSON.parse(localStorage.getItem(workspaceStorageKey)!);raw.reports[0].draft.pages[1].elements[0].evidence.links[0].snapshot.studyIds=stored;const damaged=JSON.stringify(raw);localStorage.setItem(workspaceStorageKey,damaged);expect(()=>loadDashboardWorkspace()).toThrow(/study references are inconsistent/);expect(localStorage.getItem(workspaceStorageKey)).toBe(damaged);
});
