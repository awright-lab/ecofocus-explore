import {expect,it,vi} from 'vitest';
import {initialDashboard} from '../documentSeeds';
import {importDatasetBuffer} from '../../data/datasetImportModel';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
import {buildAnalyticalTemplateFromTile} from '../../builder/components/libraryReuseModel';
import {createReportRecord,normalizeDashboardWorkspace,createPublishedSnapshot,removeWorkspaceImportedDataset,saveDashboardWorkspace,loadDashboardWorkspace} from '../workspacePersistence';
import {draftImportedStudyReferences,editorStudyRemovalBlocker} from '../importedStudyUsage';
import {normalizeDatasetSourceRefForImportedDataset} from '../../data/datasetSourceRegistry';
import type {DashboardDraft,DashboardTile,SavedCompositionBlock} from '../../../../shared/types/dashboard';
it('keeps source data when a saved template has explicit imported source but incomplete legacy query context',async()=>{
 const parsed=await importDatasetBuffer(new TextEncoder().encode('Answer\nYes\nNo\n').buffer,'synthetic_legacy.csv'),dataset=parsed.dataset!,draft=structuredClone(initialDashboard);
 const tile={...draft.pages[0].tiles[0],source:{kind:'importedField' as const,id:dataset.id+':'+dataset.fields[0].id,label:'Answer',datasetId:dataset.id,fieldId:dataset.fields[0].id}};
 draft.pages.forEach(page=>page.tiles=[]);draft.importedDatasets=[];draft.analysisLibrary.templates=[buildAnalyticalTemplateFromTile(tile)];
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});
 expect(()=>removeWorkspaceImportedDataset(workspace,dataset.id)).toThrow(/still used/);
});

async function dependencyFixture(){
 const parsed=await importDatasetBuffer(new TextEncoder().encode('Answer,Amount\n'+'Yes,10\n'.repeat(60)).buffer,'synthetic_library_sources.csv'),study=parsed.dataset!;
 const result=runImportedDatasetQuery({dataset:study,field:study.fields[0],metric:'count',chartType:'table'}),draft=structuredClone(initialDashboard);
 const tile:DashboardTile={...draft.pages[0].tiles[0],query:result.query,result,visualization:'table',source:{kind:'importedField',id:study.id+':'+study.fields[0].id,label:'Answer',datasetId:study.id,fieldId:study.fields[0].id}};
 draft.pages.forEach(page=>page.tiles=[]);draft.importedDatasets=[];draft.analysisLibrary.templates=[];draft.analysisLibrary.derivedDefinitions=[];draft.designLibrary.compositionBlocks=[];draft.designLibrary.compositionStarters=[];
 return {study,draft,tile};
}
function clearDraftDependencies(draft:DashboardDraft){draft.pages.forEach(page=>page.tiles=[]);draft.analysisLibrary.templates=[];draft.analysisLibrary.derivedDefinitions=[];draft.designLibrary.compositionBlocks=[];draft.designLibrary.compositionStarters=[];draft.importedDatasets=[];}
it.each(['derived calculation','layout','starter','executed query','template source reference','template query reference'] as const)('captures and protects a study referenced only by %s',async kind=>{
 const {study,draft,tile}=await dependencyFixture();
 if(kind==='derived calculation')draft.analysisLibrary.derivedDefinitions.push({id:'derived',datasetId:tile.query.dataset,label:'Saved calculation',description:'',source:{kind:'question',id:tile.query.question,label:'Answer'},sourceTileId:tile.id,sourceTileTitle:tile.title,query:tile.query,outputKind:'lead_row_summary',spec:{columnId:'summary',columnLabel:'Total'},summary:{outputLabel:'Summary',sourceLabel:'Answer',structureLabel:'Total',queryLabel:'Count'}});
 if(kind==='layout'||kind==='starter'){
  const block:SavedCompositionBlock={id:'block',label:'Saved layout',description:'',category:'chart_commentary',createdAt:1,summary:{objectCount:1,tileCount:1,elementCount:0,width:tile.layout.width,height:tile.layout.height},items:[{kind:'tile',tile,relativeLayout:tile.layout}]};
  (kind==='layout'?draft.designLibrary.compositionBlocks:draft.designLibrary.compositionStarters).push(block);
 }
 if(kind==='executed query'){
  const legacy=structuredClone(tile);legacy.source=structuredClone(initialDashboard.pages[0].tiles[0].source);legacy.query=structuredClone(initialDashboard.pages[0].tiles[0].query);delete legacy.result.metadataRefs.source;draft.pages[0].tiles=[legacy];
 }
 if(kind.startsWith('template')){
  const legacy=structuredClone(initialDashboard.pages[0].tiles[0]),ref=normalizeDatasetSourceRefForImportedDataset(study);
  if(kind==='template source reference')legacy.source={kind:'question',id:legacy.query.question,label:'Legacy source',sourceRef:ref};
  else legacy.query.sourceRef=ref;
  draft.analysisLibrary.templates=[buildAnalyticalTemplateFromTile(legacy)];
 }
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[study]});
 expect(()=>removeWorkspaceImportedDataset(workspace,study.id)).toThrow(/still used/);expect(editorStudyRemovalBlocker(study.id,[workspace.reports[0].draft],[],false)).not.toBeNull();
 const published=createPublishedSnapshot(workspace,workspace.reports[0].draft);expect(published.snapshot.dashboard.importedDatasets[0].rows).toEqual(study.rows);
 clearDraftDependencies(published.workspace.reports[0].draft);expect(()=>removeWorkspaceImportedDataset(published.workspace,study.id)).not.toThrow();
});
it('retains all conflicting explicit identity and source-reference IDs conservatively',async()=>{
 const {study,draft,tile}=await dependencyFixture(),studies=Array.from({length:7},(_,index)=>({...structuredClone(study),id:`conflict_${index}`})),ref=(index:number)=>normalizeDatasetSourceRefForImportedDataset(studies[index]);
 tile.source={...tile.source!,kind:'importedField',datasetId:studies[0].id,sourceRef:ref(1)};
 if(tile.query.sourceIdentity?.kind!=='imported'||tile.result.metadataRefs.source?.kind!=='imported')throw Error('fixture');
 tile.query=structuredClone(tile.query);if(tile.query.sourceIdentity?.kind!=='imported')throw Error('fixture');
 tile.query.sourceIdentity.datasetId=studies[2].id;tile.query.sourceIdentity.sourceRef=ref(3);tile.query.sourceRef=ref(4);
 tile.result.metadataRefs.source=structuredClone(tile.result.metadataRefs.source);tile.result.metadataRefs.source.datasetId=studies[5].id;tile.result.metadataRefs.source.sourceRef=ref(6);tile.result.query=tile.query;
 draft.pages[0].tiles=[tile];const before=structuredClone(draft),workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:studies});
 expect(new Set(draftImportedStudyReferences(draft).map(item=>item.datasetId))).toEqual(new Set(studies.map(item=>item.id)));
 const published=createPublishedSnapshot(workspace,workspace.reports[0].draft);expect(new Set(published.snapshot.dashboard.importedDatasets.map(item=>item.id))).toEqual(new Set(studies.map(item=>item.id)));
 for(const item of studies)expect(()=>removeWorkspaceImportedDataset(workspace,item.id)).toThrow(/still used/);expect(draft).toEqual(before);
});
it('keeps explicit imported source references even when their identity discriminator is contradictory legacy metadata',async()=>{
 const {study,draft,tile}=await dependencyFixture(),second={...structuredClone(study),id:'metadata-source'},ref=normalizeDatasetSourceRefForImportedDataset;
 tile.source=undefined;tile.query=structuredClone(initialDashboard.pages[0].tiles[0].query);
 tile.query.sourceIdentity={kind:'seeded',datasetId:tile.query.dataset,questionId:tile.query.question,sourceRef:ref(study)};
 tile.result.query=tile.query;tile.result.metadataRefs.source={kind:'seeded',datasetId:tile.query.dataset,questionId:tile.query.question,sourceRef:ref(second)};
 draft.pages[0].tiles=[tile];const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[study,second]});
 expect(new Set(draftImportedStudyReferences(draft).map(item=>item.datasetId))).toEqual(new Set([study.id,second.id]));
 for(const source of [study,second])expect(()=>removeWorkspaceImportedDataset(workspace,source.id)).toThrow(/still used/);
 const published=createPublishedSnapshot(workspace,workspace.reports[0].draft);expect(new Set(published.snapshot.dashboard.importedDatasets.map(item=>item.id))).toEqual(new Set([study.id,second.id]));
});
it('uses current workspace source data, deep-clones it and retains a library-only snapshot across save/reopen and removal',async()=>{
 const {study,draft,tile}=await dependencyFixture(),current=structuredClone(study);current.rows[0].Amount='99';
 draft.importedDatasets=[study];draft.analysisLibrary.templates=[buildAnalyticalTemplateFromTile(tile)];
 // Build an already-loaded workspace, where the editor gives its workspace copy precedence.
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[study]});workspace.importedDatasets=[current];
 const published=createPublishedSnapshot(workspace,workspace.reports[0].draft);expect(published.snapshot.dashboard.importedDatasets[0].rows[0].Amount).toBe('99');
 current.rows[0].Amount='101';study.rows[0].Amount='102';expect(published.snapshot.dashboard.importedDatasets[0].rows[0].Amount).toBe('99');
 clearDraftDependencies(published.workspace.reports[0].draft);const removed=removeWorkspaceImportedDataset(published.workspace,study.id);
 const stored=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)}});
 try{expect(saveDashboardWorkspace(removed)).toBe(true);const reopened=loadDashboardWorkspace();expect(reopened.importedDatasets).toHaveLength(0);expect(reopened.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Amount).toBe('99');expect(reopened.publishedSnapshots[0].dashboard.importedDatasets[0].rows).toHaveLength(60);}
 finally{vi.unstubAllGlobals();}
});
it('snapshots own study data referenced only by a saved imported analytical template',async()=>{
 const parsed=await importDatasetBuffer(new TextEncoder().encode('Answer\nYes\nNo\n').buffer,'synthetic.csv'),dataset=parsed.dataset!;
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:'count',chartType:'table'}),draft=structuredClone(initialDashboard);
 const source={...draft.pages[0].tiles[0],query:result.query,result,visualization:'table' as const,source:{kind:'importedField' as const,id:dataset.id+':'+dataset.fields[0].id,label:'Answer',datasetId:dataset.id,fieldId:dataset.fields[0].id}};
 draft.pages.forEach(page=>page.tiles=[]);draft.importedDatasets=[];draft.analysisLibrary.templates=[buildAnalyticalTemplateFromTile(source)];
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(draft)],importedDatasets:[dataset]});
 const published=createPublishedSnapshot(workspace,workspace.reports[0].draft);
 expect.soft(published.snapshot.dashboard.importedDatasets.map(item=>item.id),'historical template source retained').toContain(dataset.id);
 published.workspace.reports[0].draft.analysisLibrary.templates=[];
 expect(()=>removeWorkspaceImportedDataset(published.workspace,dataset.id),'current source can be removed after draft references are cleared because snapshot owns its copy').not.toThrow();
});
