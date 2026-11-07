import type {AnalyticsQueryResponse} from '../../../shared/types/analytics';
import {assertJsonSize} from '../../../shared/jsonSizeBudget';
import {getImportedDatasetQuerySupport,type ImportedDatasetQueryConfig} from './importedDatasetAnalytics';
import {importedRawFieldValue} from './importedRawValue';
import {assertImportedQueryResponse} from './importedQueryResponse';
import {guidedPreviewLimits,guidedPreviewResponseIdentity,previewMetadataText,type GuidedPreviewRequest} from './guidedPreviewModel';
export type GuidedPreviewProgress={phase:'preparing';done:number;total:number}|{phase:'calculating';total:number};
export interface GuidedPreviewWorker{postMessage:(request:GuidedPreviewRequest)=>void;terminate:()=>void;onmessage:((event:MessageEvent)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent)=>void)|null}
export interface GuidedPreviewAcceptance{result:AnalyticsQueryResponse;sourceStillCurrent:()=>boolean}
function selection(config:ImportedDatasetQueryConfig){
 const dataset=config.dataset;
 if(config.groupingScope==='all_respondents'&&[config.measureField,config.bannerField,config.filter?.field].some(field=>field!==null&&field!==undefined&&field===config.field))throw Error('Use a separate virtual grouping field for background overall summaries; a physical measure, breakout or filter cannot reuse that object. Your source and report were kept.');
 if(dataset.remote||dataset.sourceType!=='local_file'||config.audience!==undefined||!Array.isArray(dataset.rows)||!Array.isArray(dataset.fields)||dataset.rows.length!==dataset.rowCount||dataset.fields.length!==dataset.fieldCount||!Number.isSafeInteger(dataset.rowCount)||dataset.rowCount<1||dataset.rowCount>guidedPreviewLimits.rows)throw Error('Background preview requires a complete local-file study of 1–50,000 rows, without a saved audience. No partial or remote preview is substituted.');
 const support=getImportedDatasetQuerySupport(dataset,config.field,{groupingScope:config.groupingScope,measureField:config.measureField,bannerField:config.bannerField,filter:config.filter,metric:config.metric,chartType:config.chartType});if(!support.executable)throw Error(support.reason);
 const chosen=[config.field,...[config.measureField,config.bannerField,config.filter?.field].filter((field):field is NonNullable<typeof field>=>!!field)];
 const sameField=(left:typeof config.field,right:typeof config.field)=>config.groupingScope==='all_respondents'&&(left===config.field||right===config.field)?left===right:left.id===right.id;
 const fields=chosen.filter((field,index,all)=>all.findIndex(other=>sameField(other,field))===index);
 const role=(field:typeof config.field|null|undefined)=>field?fields.findIndex(f=>sameField(f,field)):null;
 for(const field of chosen){if(config.groupingScope==='all_respondents'&&field===config.field)continue;const found=dataset.fields.filter(f=>f.id===field.id);if(found.length!==1||previewMetadataText(found[0])!==previewMetadataText(field))throw Error('A selected preview field is missing, ambiguous or changed. Choose the current field again.');}
 const metadata={source:{id:dataset.id,title:dataset.title,importedAt:dataset.importedAt,rows:dataset.rowCount,fields:dataset.fieldCount},fields,group:0,measure:role(config.measureField),banner:role(config.bannerField),filter:config.filter?{field:role(config.filter.field)!,value:config.filter.value}:null,metric:config.metric,chartType:config.chartType,allRespondents:config.groupingScope==='all_respondents'};
 const text=previewMetadataText(metadata);return {fields,text,metadata:JSON.parse(text) as typeof metadata};
}
export function runGuidedPreviewJob(config:ImportedDatasetQueryConfig,options:{signal:AbortSignal;onProgress?:(progress:GuidedPreviewProgress)=>void;getCurrentConfig?:()=>ImportedDatasetQueryConfig|null;createWorker?:()=>GuidedPreviewWorker}):Promise<GuidedPreviewAcceptance>{
 return new Promise((resolve,reject)=>{
  let worker:GuidedPreviewWorker|null=null,timer:ReturnType<typeof setTimeout>|undefined,preparationTimer:ReturnType<typeof setTimeout>|undefined,finished=false;
  function finish(error?:Error,accepted?:GuidedPreviewAcceptance){if(finished)return;finished=true;if(timer!==undefined)clearTimeout(timer);if(preparationTimer!==undefined)clearTimeout(preparationTimer);options.signal.removeEventListener('abort',cancel);if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();}if(error)reject(error);else resolve(accepted!);}
  function cancel(){finish(new DOMException('Background preview canceled. Your report and source data were not changed.','AbortError'));}
  if(options.signal.aborted){cancel();return;}options.signal.addEventListener('abort',cancel,{once:true});
  try{
   const selected=selection(config),source=config.dataset.rows,values:string[][]=[],encoder=new TextEncoder();let bytes=0;
   const request:GuidedPreviewRequest={...selected.metadata,values};
   // Source identity is only needed on this side of the worker boundary.
   Reflect.deleteProperty(request,'source');
   function current(){try{const latest=options.getCurrentConfig?options.getCurrentConfig():config;if(!latest||latest.dataset.rows!==source||selection(latest).text!==selected.text||values.length!==source.length)return false;for(let i=0;i<values.length;i++)for(let j=0;j<selected.fields.length;j++){const raw=request.allRespondents&&j===0?'':importedRawFieldValue(source[i],selected.fields[j]);if(raw!==values[i][j])return false;}return true;}catch{return false;}}
   function prepare(){if(finished)return;try{
    const end=Math.min(source.length,values.length+250);
    for(let i=values.length;i<end;i++){const row=source[i];if(!row||typeof row!=='object'||Array.isArray(row))throw Error('A selected source row is malformed.');const projected=selected.fields.map((field,j)=>request.allRespondents&&j===0?'':importedRawFieldValue(row,field));if(projected.some(value=>typeof value!=='string'||value.length>20000))throw Error('Selected preview values are oversized or not text.');bytes+=encoder.encode(JSON.stringify(projected)).length+1;if(bytes>guidedPreviewLimits.sourceBytes)throw Error('Selected preview values exceed the 20 MiB background limit.');values.push(projected);}
    options.onProgress?.({phase:'preparing',done:values.length,total:source.length});if(finished)return;
    if(values.length<source.length){timer=setTimeout(prepare,0);return;}
    if(!current())throw Error('The study or selected fields changed while preparing the preview. Recalculate the current setup.');
    try{worker=options.createWorker?options.createWorker():new Worker(new URL('./guidedPreview.worker.ts',import.meta.url),{type:'module'});}catch{throw Error('Background previews cannot start in this browser. Your report and source data were kept. Creating can still run a fresh calculation.');}
    worker.onmessage=event=>{if(finished)return;try{const data=event.data;if(data?.type==='failed')throw Error(typeof data.message==='string'?data.message.slice(0,500):'The complete preview could not be calculated.');if(data?.type!=='complete'||!data.result||!Array.isArray(data.result.table)||!Array.isArray(data.result.columns)||data.result.table.length*data.result.columns.length>guidedPreviewLimits.cells)throw Error('The background preview returned an incomplete result.');assertJsonSize(data.result,{maxChars:4*1024*1024,maxNodes:150000,maxDepth:32});assertImportedQueryResponse(data.result,guidedPreviewResponseIdentity(request));if(!current())throw Error('The source or setup changed during preview calculation. Recalculate the current setup.');finish(undefined,{result:data.result,sourceStillCurrent:current});}catch(error){finish(error instanceof Error?error:Error('The preview result was not accepted.'));}};
    worker.onerror=worker.onmessageerror=()=>finish(Error('Background preview is unavailable in this browser. No preview or source data was changed.'));
    options.onProgress?.({phase:'calculating',total:source.length});if(finished)return;
    if(preparationTimer!==undefined){clearTimeout(preparationTimer);preparationTimer=undefined;}
    timer=setTimeout(()=>finish(Error('The background preview exceeded 30 seconds. Retry a smaller comparison.')),30000);try{worker.postMessage(request);}catch{finish(Error('Selected values could not be sent to the background preview. Your report and source data were kept.'));}
   }catch(error){finish(error instanceof Error?error:Error('Background preview could not start.'));}}
   preparationTimer=setTimeout(()=>finish(Error('Preparing the background preview exceeded 30 seconds. Your setup, report and source data were kept. Retry when the browser is ready or choose a smaller comparison.')),30000);
   timer=setTimeout(prepare,0);
  }catch(error){finish(error instanceof Error?error:Error('The selected preview could not be prepared.'));}
 });
}
