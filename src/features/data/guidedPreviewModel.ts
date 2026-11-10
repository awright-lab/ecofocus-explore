import type {AnalyticsQueryResponse,ChartType,Metric} from '../../../shared/types/analytics';
import type {ImportedDatasetField,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import {assertJsonSize} from '../../../shared/jsonSizeBudget';
import {runImportedDatasetQuery,type ImportedDatasetQueryConfig} from './importedDatasetAnalytics';
import {assertImportedQueryResponse} from './importedQueryResponse';
import {allRespondentsGroupingId} from './numericSummaryScope';

export const guidedPreviewLimits={threshold:5000,rows:50000,fields:4,cells:5000,metadataBytes:2*1024*1024,sourceBytes:20*1024*1024} as const;
export interface GuidedPreviewRequest{fields:ImportedDatasetField[];values:string[][];group:number;measure:number|null;banner:number|null;filter:{field:number;value:string}|null;metric:Metric;chartType:ChartType;allRespondents:boolean}
const encoder=new TextEncoder();
export function previewMetadataText(value:unknown):string{
 assertJsonSize(value,{maxChars:2*1024*1024,maxNodes:100000,maxDepth:24});
 const text=JSON.stringify(value);if(encoder.encode(text).length>guidedPreviewLimits.metadataBytes)throw Error('Selected preview metadata exceeds 2 MiB. No preview was calculated.');return text;
}
function dense(value:unknown,maximum:number):value is unknown[]{return Array.isArray(value)&&value.length<=maximum&&Object.getOwnPropertyNames(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);}
/** Transport-validation identity only when rows are absent; never execute or save that header. */
export function guidedPreviewResponseIdentity(request:GuidedPreviewRequest,rows:Record<string,string>[]=[]):ImportedDatasetQueryConfig{
 const fields=request.fields.map((field,i)=>({...field,id:request.allRespondents&&i===request.group?allRespondentsGroupingId:`preview_field_${i}`,sourceColumn:`preview_${i}`}));
 const dataset:ImportedDatasetRecord={id:'guided-preview-projection',title:'Temporary selected-column preview',sourceType:'local_file',fileName:'',fileType:'unknown',importedAt:'',rowCount:request.values.length,fieldCount:fields.length,fields,rows,previewRows:[],modelingStatus:'initial_model',notes:[]};
 return{dataset,field:fields[request.group],measureField:request.measure===null?null:fields[request.measure],bannerField:request.banner===null?null:fields[request.banner],filter:request.filter?{field:fields[request.filter.field],value:request.filter.value}:null,metric:request.metric,chartType:request.chartType,...(request.allRespondents?{groupingScope:'all_respondents' as const}:{})};
}
/** An ephemeral selected-column projection; never a saved source or result. */
export function guidedPreviewConfig(request:GuidedPreviewRequest):ImportedDatasetQueryConfig{
 if(!dense(request.fields,4)||!request.fields.length||!dense(request.values,50000)||!request.values.length)throw Error('Background preview requires 1–50,000 complete source rows and at most four selected fields.');
 previewMetadataText(request.fields);
 const index=(n:unknown)=>Number.isInteger(n)&&(n as number)>=0&&(n as number)<request.fields.length;
 if(!index(request.group)||request.measure!==null&&!index(request.measure)||request.banner!==null&&!index(request.banner)||request.filter!==null&&(!index(request.filter.field)||typeof request.filter.value!=='string'||request.filter.value.length>20000)||typeof request.allRespondents!=='boolean')throw Error('The selected preview fields are invalid.');
 if(!['count','percent_selected','column_percent','average','sum'].includes(request.metric)||!['table','vertical_bar','horizontal_bar','grouped_bar','stacked_bar','line_chart','donut','heatmap','dot_plot'].includes(request.chartType))throw Error('This calculation is unsupported by background previews.');
 const fields=request.fields.map((field,i)=>({...field,id:`preview_field_${i}`,sourceColumn:`preview_${i}`}));
 const categories=fields.map(field=>new Set(Object.keys(field.valueLabels??{})));let bytes=0;
 for(const values of request.values){if(!dense(values,fields.length)||values.length!==fields.length||values.some(v=>typeof v!=='string'||v.length>20000))throw Error('Preview source values are incomplete or oversized.');bytes+=encoder.encode(JSON.stringify(values)).length+1;if(bytes>guidedPreviewLimits.sourceBytes)throw Error('Selected preview values exceed 20 MiB.');for(let i=0;i<fields.length;i++)if((values[i] as string).trim())categories[i].add((values[i] as string).trim());}
 const rows=request.values.map(values=>Object.fromEntries(fields.map((f,i)=>[f.sourceColumn,values[i]])));
 const groups=request.allRespondents?1:Math.max(1,categories[request.group].size),columns=request.banner===null?1:Math.max(1,categories[request.banner].size+1);
 // Conservative unfiltered raw-category bound, including declared unused codes.
 // Refuse rather than sample/truncate; filtering or aliases could make it smaller.
 if(groups*columns>guidedPreviewLimits.cells)throw Error('This preview can exceed 5,000 result cells. Choose a smaller comparison; no cells were sampled or dropped.');
 return guidedPreviewResponseIdentity(request,rows);
}
export function calculateGuidedPreview(request:GuidedPreviewRequest):AnalyticsQueryResponse{
 const config=guidedPreviewConfig(request),result=runImportedDatasetQuery(config);
 if(result.table.length*result.columns.length>guidedPreviewLimits.cells)throw Error('The complete preview exceeds 5,000 result cells.');
 try{assertJsonSize(result,{maxChars:4*1024*1024,maxNodes:150000,maxDepth:32});}catch{throw Error('The complete preview exceeds its 4,194,304-character result budget or contains unsupported data. Choose a smaller comparison; no cells were dropped.');}
 assertImportedQueryResponse(result,config);return result;
}
