import {importDatasetBuffer} from '../../datasetImportModel';
import {runImportedDatasetQuery,type ImportedDatasetQueryConfig} from '../../importedDatasetAnalytics';
export async function importedCancellationFixture(rows=4,fields=3){
 const extras=Array.from({length:Math.max(0,fields-3)},(_,i)=>'Extra'+i),csv=[['Answer','Region','Spend',...extras].join(','),...Array.from({length:rows},(_,i)=>[i%2?'No':'Yes',i%2?'South':'North',String(i+1),...extras.map((_,j)=>String((i+j)%7))].join(','))].join('\n');
 const parsed=await importDatasetBuffer(new TextEncoder().encode(csv).buffer,'synthetic-query-cancellation.csv');if(!parsed.dataset)throw Error('fixture');const dataset=parsed.dataset;
 for(const i of[0,1])Object.assign(dataset.fields[i],{type:'categorical',modelingRole:'candidate_dimension',eligibleForBanner:true,eligibleForFilter:true});
 dataset.remote={provider:'netlify',projectUrl:'',bucket:'',objectPath:'synthetic-cancel.csv',uploadedAt:dataset.importedAt};
 const config:ImportedDatasetQueryConfig={dataset,field:dataset.fields[0],metric:'count',chartType:'table'};
 return{dataset,config,response:runImportedDatasetQuery(config),calculate:(metric:ImportedDatasetQueryConfig['metric'])=>runImportedDatasetQuery({...config,metric})};
}
