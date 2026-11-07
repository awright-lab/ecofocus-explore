import {initialDashboard} from '../../../document/documentSeeds';
import {importDatasetBuffer} from '../../../data/datasetImportModel';
import {runImportedDatasetQuery} from '../../../data/importedDatasetAnalytics';
import type {DashboardTile} from '../../../../../shared/types/dashboard';
export async function tableExplorerFixture(metric:'count'|'percent_selected'|'average'='count'){
 const extras=Array.from({length:28},(_,i)=>`Extra${i}`),csv=[['Answer','Group',...extras].join(','),...Array.from({length:1000},(_,i)=>[`Answer${i%100}`,`Group${i%20}`,...extras.map((_,j)=>String((i+j)%11))].join(','))].join('\n');
 const{dataset}=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic-table1000x30.csv');if(!dataset)throw Error('Synthetic fixture');
 for(const field of dataset.fields.slice(0,2)){field.type='categorical';field.modelingRole='candidate_dimension';}
 const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],bannerField:dataset.fields[1],measureField:metric==='average'?dataset.fields[2]:null,metric,chartType:'table'});
 const draft=structuredClone(initialDashboard);draft.pages=[draft.pages[0]];draft.importedDatasets=[dataset];draft.pages[0].elements=[];
 const tile:DashboardTile={...draft.pages[0].tiles[0],name:'Synthetic complete table',title:'Synthetic complete table',query:result.query,result,visualization:'table',appearance:{...draft.pages[0].tiles[0].appearance,axisLabelOverrides:{},showBases:true,showValueLabels:true},layout:{x:20,y:20,width:1180,height:600,zIndex:1}};
 draft.pages[0].tiles=[tile];return {draft,tile,dataset};
}
