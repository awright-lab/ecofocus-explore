import type {DatasetConnectionVerificationReport,LiveDatasetSourceInspectionReport,LiveDatasetSourceDescriptor} from "../../../shared/types/dataSource";
import {assertJsonSize} from "../../../shared/jsonSizeBudget";
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function string(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=20000;}
function texts(value:unknown):value is string[]{return Array.isArray(value)&&value.length<=200&&Array.from({length:value.length},(_,i)=>Object.hasOwn(value,i)&&typeof value[i]==='string'&&value[i].length<=20000).every(Boolean);}
function common(value:unknown,date:string){assertJsonSize(value,{maxChars:1024*1024,maxNodes:60000,maxDepth:32});return record(value)&&string(value.statusLabel)&&typeof value[date]==='string'&&Number.isFinite(Date.parse(value[date]as string))&&texts(value.diagnostics)&&string(value.nextStep);}
export function readManagedVerification(value:unknown,provider:string,connectionId:string|undefined):DatasetConnectionVerificationReport{
 if(!common(value,'checkedAt')||!record(value)||value.provider!==provider||value.connectionId!==connectionId||!['not_configured','ready_to_verify','verified','failed','unsupported'].includes(value.status as string))throw Error('The readiness reply is incomplete or belongs to another connection. No reply data was applied.');
 return JSON.parse(JSON.stringify(value))as DatasetConnectionVerificationReport;
}
export function readManagedInspection(value:unknown,source:LiveDatasetSourceDescriptor):LiveDatasetSourceInspectionReport{
 if(!common(value,'inspectedAt')||!record(value)||value.provider!==source.sourceRef.provider||value.connectionId!==source.connectionId||value.sourceRefId!==source.sourceRef.id||value.objectPath!==source.objectPath||value.objectType!==source.objectType||!['not_inspected','inspected','failed','unsupported'].includes(value.status as string)||!Array.isArray(value.fields)||value.fields.length>200||value.status==='inspected'&&value.fields.length===0)throw Error('The field reply is incomplete or belongs to another source mapping. Existing fields were kept.');
 const ids=new Set<string>(),names=new Set<string>();for(let i=0;i<value.fields.length;i++){const field=value.fields[i];if(!Object.hasOwn(value.fields,i)||!record(field)||!string(field.id)||typeof field.label!=='string'||field.label.length>20000||!string(field.rawName)||!['text','number','date','boolean','unknown'].includes(field.type as string)||ids.has(field.id)||names.has(field.rawName)||field.modelingRole!==undefined&&!['unmodeled','dimension','measure','date','identifier'].includes(field.modelingRole as string)||['nullable','eligibleForFilter','eligibleForSegment','eligibleForBanner'].some(key=>field[key]!==undefined&&typeof field[key]!=='boolean')||field.sourceType!==undefined&&typeof field.sourceType!=='string'||field.distinctEstimate!==undefined&&(typeof field.distinctEstimate!=='number'||!Number.isFinite(field.distinctEstimate)||field.distinctEstimate<0))throw Error('The field reply has incomplete or repeated field metadata. Existing fields were kept.');ids.add(field.id);names.add(field.rawName);}
 return JSON.parse(JSON.stringify(value))as LiveDatasetSourceInspectionReport;
}

class ManagedReplyError extends Error{constructor(message:string,readonly diagnostics:string[]){super(message);}}
export function managedResponseError(value:unknown,fallback:string):Error{
 let message=fallback,diagnostics=[fallback];try{assertJsonSize(value,{maxChars:1024*1024,maxNodes:60000,maxDepth:32});if(record(value)&&string(value.error)){message=value.error;diagnostics=texts(value.details)&&value.details.length?[...value.details]:[message];}}catch{/* Malformed error data is not applied to the workspace. */}
 return new ManagedReplyError(message,diagnostics);
}
export function managedFailureDiagnostics(error:unknown,fallback:string){return error instanceof ManagedReplyError?[...error.diagnostics]:[error instanceof Error?error.message:fallback];}
