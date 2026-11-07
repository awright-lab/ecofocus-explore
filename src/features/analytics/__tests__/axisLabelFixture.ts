import {initialDashboard} from '../../document/documentSeeds';
import {importDatasetBuffer} from '../../data/datasetImportModel';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
import type {DashboardTile} from '../../../../shared/types/dashboard';
/** Valid cached identities deliberately exercise JS dictionary names. The normal
 * CSV engine uses suffixed slugs; no claim that it generates these IDs. */
export async function axisLabelFixture(singleColumn=false){
 const extra=Array.from({length:28},(_,i)=>`Extra${i}`),csv=[['Answer','Group',...extra].join(','),...Array.from({length:1000},(_,i)=>[String.fromCharCode(65+i%3),'Group'+i%2,...extra.map((_,j)=>String((i+j)%11))].join(','))].join('\n');
 const{dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic-labels1000x30.csv');if(!dataset)throw Error('Synthetic fixture');
 for(const field of dataset.fields.slice(0,2)){field.type='categorical';field.modelingRole='candidate_dimension';}
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:singleColumn?null:dataset.fields[1],metric:'count',chartType:'table'}),rowIds=['__proto__','constructor','toString'],columnIds=['constructor','__proto__'];
 result.columns=result.columns.map((column,index)=>({...column,id:columnIds[index]}));
 result.table=result.table.map((row,index)=>({...row,optionId:rowIds[index],values:Object.fromEntries(result.columns.map((column,c)=>[column.id,result.series[index].values[c]])),bases:Object.fromEntries(result.columns.map((column,c)=>[column.id,result.series[index].bases[c]]))}));
 result.series=result.series.map((series,index)=>({...series,id:rowIds[index]}));
 const draft=structuredClone(initialDashboard);draft.pages=[draft.pages[0]];draft.importedDatasets=[dataset];draft.pages[0].elements=[];
 const tile:DashboardTile={...draft.pages[0].tiles[0],name:'Synthetic labels',title:'Synthetic labels',query:result.query,result,visualization:'table',appearance:{...draft.pages[0].tiles[0].appearance,axisLabelOverrides:{},axisFontSize:12,labelFontSize:12,showBases:true,showValueLabels:true},layout:{x:20,y:20,width:1180,height:600,zIndex:1}};
 draft.pages[0].tiles=[tile];return {draft,tile,dataset};
}
