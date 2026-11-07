import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { initialDashboard } from "../../document/documentSeeds";
export async function heatmapFixture() {
  const {dataset} = await importDatasetBuffer(new TextEncoder().encode('Answer,Banner,Amount\nA,X,-20\nA,Y,10\nB,X,0\nB,Y,20\n').buffer,'synthetic-heatmap.csv');
  if(!dataset)throw Error('fixture');
  for(const field of dataset.fields)Object.assign(field,field.sourceColumn==='Amount'?{type:'numeric',modelingRole:'candidate_measure'}:{type:'categorical',modelingRole:'candidate_dimension',eligibleForBanner:true,eligibleForFilter:true});
  const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],measureField:dataset.fields[2],metric:'sum',chartType:'heatmap'});
  const draft=structuredClone(initialDashboard);draft.id='synthetic-heatmap-report';draft.importedDatasets=[dataset];draft.savedAudiences=[];draft.pages=draft.pages.slice(0,1);draft.pages[0].elements=[];
  const tile=draft.pages[0].tiles[0];tile.id='synthetic-heatmap-tile';tile.name='Synthetic heatmap';tile.title='Synthetic heatmap';tile.visualization='heatmap';tile.query=structuredClone(result.query);tile.result=result;tile.derivedOutput=undefined;tile.source={kind:'importedField',id:'heatmap-source',datasetId:dataset.id,fieldId:dataset.fields[0].id,label:'Answer'};tile.layout={x:20,y:20,width:1220,height:700,zIndex:1};tile.appearance.axisLabelOverrides={};tile.appearance.titleX=18;tile.appearance.titleY=10;tile.appearance.titleWidth=1100;tile.appearance.titleFontSize=18;tile.appearance.axisFontSize=12;tile.appearance.labelFontSize=12;draft.pages[0].tiles=[tile];return{draft,tile,dataset};
}
