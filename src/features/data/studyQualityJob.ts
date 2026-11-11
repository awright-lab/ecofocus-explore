import type {ImportedDatasetField,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import {importedRawFieldValue} from './importedRawValue';
import {validCategoricalProfileReply,validNumericProfileReply} from './profileReplyValidation';
import {qualitySchema,qualitySnapshotCurrent,studyQualityEligibility,type QualityField,type QualitySnapshot} from './studyQualityModel';
export type QualityProgress={phase:'preparing'|'calculating'|'verifying';done:number;total:number};
type WorkerLike={postMessage:(data:{index:number;values:string[];field:ImportedDatasetField})=>void;terminate:()=>void;onmessage:((event:MessageEvent)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent)=>void)|null};
export function runStudyQualityJob(dataset:ImportedDatasetRecord,options:{signal:AbortSignal;onProgress?:(progress:QualityProgress)=>void;createWorker?:()=>WorkerLike}):Promise<QualitySnapshot>{
 return new Promise((resolve,reject)=>{
  const issue=studyQualityEligibility(dataset);if(issue){reject(new Error(issue));return;}
  const rows=dataset.rows,fields=[...dataset.fields],schema=qualitySchema(dataset),rowRefs:ImportedDatasetRecord['rows']=[],rowTexts:string[]=[],values=fields.map(()=>[] as string[]),summaries:QualityField[]=[];
  let timer:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined,worker:WorkerLike|null=null,done=false,index=0,row=0;
  function finish(error?:Error,snapshot?:QualitySnapshot){if(done)return;done=true;if(timer!==undefined)clearTimeout(timer);if(deadline!==undefined)clearTimeout(deadline);options.signal.removeEventListener('abort',cancel);worker?.terminate();if(error)reject(error);else resolve(snapshot!);}
  function cancel(){finish(new DOMException('Study quality review canceled.','AbortError'));}
  function context(){if(studyQualityEligibility(dataset)||dataset.rows!==rows||qualitySchema(dataset)!==schema||fields.some((field,i)=>dataset.fields[i]!==field))throw new Error('The study or its schema changed. Refresh to review the current snapshot.');}
  if(options.signal.aborted){cancel();return;}options.signal.addEventListener('abort',cancel,{once:true});
  function prepare(){try{context();let budget=2000;while(index<fields.length&&budget>0){while(row<rows.length&&budget>0){if(index===0){rowRefs.push(rows[row]);rowTexts.push(JSON.stringify(rows[row]));}const value=importedRawFieldValue(rows[row],fields[index]);if(typeof value!=='string')throw new Error('A stored value is not text. The study was not changed.');values[index].push(value);row++;budget--;}if(row===rows.length){index++;row=0;}}
   options.onProgress?.({phase:'preparing',done:index*rows.length+row,total:fields.length*rows.length});if(done)return;context();if(index<fields.length){timer=setTimeout(prepare,0);return;}
   worker=(options.createWorker??(()=>new Worker(new URL('./studyQuality.worker.ts',import.meta.url),{type:'module'})))();index=0;
   worker.onerror=worker.onmessageerror=()=>finish(new Error('Background study review is unavailable. Retry without changing the study.'));
   worker.onmessage=event=>{if(done)return;try{context();const data=event.data,field=fields[index],raw=values[index];if(!data||data.index!==index)throw new Error('The background review returned an unexpected result. Retry.');
    const expected=field.type==='numeric'||field.modelingRole==='candidate_measure'?'numeric':field.type==='categorical'||field.modelingRole==='candidate_dimension'?'categorical':'other';if(data.kind!==expected)throw new Error('The background review returned the wrong field type. Retry.');
    const label=field.variableLabel||field.label,base={id:field.id,label,sourceColumn:field.sourceColumn};
    if(data.kind==='numeric'&&validNumericProfileReply(data.profile,rows.length)&&data.profile.status==='ready'){const p=data.profile;summaries.push({...base,kind:'numeric',blank:p.blank,nonblank:rows.length-p.blank,valid:p.valid,invalid:p.invalid,distinct:p.distinct});}
    else if(data.kind==='categorical'&&validCategoricalProfileReply(data.profile,rows.length)){const p=data.profile;if(p.status==='ready')summaries.push({...base,kind:'categorical',blank:p.blank,nonblank:p.valid,valid:null,invalid:null,distinct:p.observedCategories});else {const blank=raw.reduce((n,v)=>n+(v.trim()?0:1),0);summaries.push({...base,kind:'categorical',blank,nonblank:rows.length-blank,valid:null,invalid:null,distinct:null,issue:p.reason});}}
    else if(data.kind==='other'&&Number.isSafeInteger(data.blank)&&data.blank>=0&&data.blank<=rows.length&&Number.isSafeInteger(data.distinct)&&data.distinct>=0&&data.distinct<=rows.length-data.blank)summaries.push({...base,kind:'other',blank:data.blank,nonblank:rows.length-data.blank,valid:null,invalid:null,distinct:data.distinct});
    else throw new Error('The background review could not verify a field. Retry.');
    index++;options.onProgress?.({phase:'calculating',done:index,total:fields.length});if(index===fields.length){verify();return;}send();
   }catch(error){finish(error instanceof Error?error:new Error('Study review failed.'));}};
   if(!fields.length){for(const item of rows){rowRefs.push(item);rowTexts.push(JSON.stringify(item));}verify();return;}send();
  }catch(error){finish(error instanceof Error?error:new Error('Study review could not start.'));}}
  function send(){if(done)return;try{context();worker!.postMessage({index,values:values[index],field:fields[index]});}catch(error){finish(error instanceof Error?error:new Error('Study review could not start.'));}}
  function verify(){if(done)return;options.onProgress?.({phase:'verifying',done:0,total:fields.length*rows.length});timer=setTimeout(()=>{if(done)return;const snapshot={dataset,rows,fields,schema,rowRefs,rowTexts,values,summaries};if(!qualitySnapshotCurrent(snapshot,dataset)){finish(new Error('The study changed during review. Refresh to review the current snapshot.'));return;}finish(undefined,snapshot);},0);}
  deadline=setTimeout(()=>finish(new Error('The study review stopped responding. Retry without changing the study.')),120000);timer=setTimeout(prepare,0);
 });
}
