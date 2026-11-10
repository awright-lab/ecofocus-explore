import type {AnalyticsQueryResponse} from '../types/analytics';
import type {LocalExecutionEvidence, PreparedExecutionLineage} from '../types/localExecution';
import { assertStudyPreparation } from '../types/dataPreparation';
export function canonicalLocalEvidence(value:unknown):string {
 if(value===undefined)return 'null';
 if(Array.isArray(value))return`[${value.map(canonicalLocalEvidence).join(',')}]`;
 if(value!==null&&typeof value==='object')return`{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${canonicalLocalEvidence(v)}`).join(',')}}`;
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite values cannot receive execution evidence.');return JSON.stringify(value);
}
export async function localEvidenceDigest(text:string):Promise<string>{
 if(!globalThis.crypto?.subtle)throw Error('Source fingerprinting is unavailable. The original analysis was kept.');
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function validPreparedExecutionLineage(value: unknown): value is PreparedExecutionLineage {
 try {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const lineage = value as PreparedExecutionLineage;
  if (typeof lineage.sourceTitle !== 'string' || !lineage.sourceTitle.trim() || lineage.sourceTitle.length > 4096 || !lineage.recipe) return false;
  assertStudyPreparation(lineage.recipe);
  return new TextEncoder().encode(canonicalLocalEvidence(lineage)).length <= 64 * 1024;
 } catch { return false; }
}
export function localExecutionShape(result:AnalyticsQueryResponse):boolean {
 try{const e=result.localExecution;if(!e||e.version!==2||e.method!=='local-analysis-inputs-sha256-v2'||!['sourceDigest','resultDigest'].every(k=>typeof e[k as 'sourceDigest']==='string'&&/^[a-f0-9]{64}$/.test(e[k as 'sourceDigest']))||!e.datasetId?.trim()||![e.importedAt,e.executedAt].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))return false;
  if(!Number.isSafeInteger(e.sourceFieldCount)||!Number.isSafeInteger(e.projectedFieldCount)||e.projectedFieldCount<1||e.sourceFieldCount<e.projectedFieldCount)return false;
  if(e.preparation!==undefined&&(!validPreparedExecutionLineage(e.preparation)||e.preparation.recipe.sourceDatasetId===e.datasetId))return false;
  const c=e.coverage,keys=['sourceRows','audienceExcluded','audienceUnknown','filterExcluded','missingGrouping','invalidNumeric','includedRows']as const;if(!c||!keys.every(k=>Number.isSafeInteger(c[k])&&c[k]>=0&&c[k]<=50000)||c.sourceRows<1||c.sourceRows!==keys.filter(k=>k!=='sourceRows').reduce((sum,k)=>sum+c[k],0))return false;
  const a=result.query.sourceIdentity,b=result.metadataRefs.source;return a?.kind==='imported'&&b?.kind==='imported'&&canonicalLocalEvidence(a)===canonicalLocalEvidence(b)&&a.datasetId===e.datasetId&&b.datasetId===e.datasetId&&a.datasetImportedAt===e.importedAt&&b.datasetImportedAt===e.importedAt&&result.query.weight===null&&!result.weighting.applied&&result.weighting.id===null&&!result.query.authoredVariableSet&&!result.metadataRefs.authoredVariableSet?.applied&&result.query.metric===result.metric.id&&['count','percent_selected','average','sum'].includes(result.metric.id);
 }catch{return false;}
}
function sealInput(result:AnalyticsQueryResponse){const e=result.localExecution;if(!e)throw Error('No local execution evidence.');const{resultDigest:_digest,...record}=e;const{chartType:_chart,...query}=result.query;const text=canonicalLocalEvidence({record,query,table:result.table,columns:result.columns,series:result.series,metric:result.metric,weighting:result.weighting,metadataRefs:result.metadataRefs,calculationInputs:result.calculationInputs});if(new TextEncoder().encode(text).length>4*1024*1024)throw Error('The result evidence exceeds the 4 MiB integrity-check budget. The original analysis was kept.');return text;}
export async function sealLocalExecution(result:AnalyticsQueryResponse,record:Omit<LocalExecutionEvidence,'resultDigest'>):Promise<AnalyticsQueryResponse>{
 const next={...structuredClone(result),localExecution:{...structuredClone(record),resultDigest:'0'.repeat(64)}};if(!localExecutionShape(next))throw Error('Execution evidence is inconsistent. The original analysis was kept.');next.localExecution.resultDigest=await localEvidenceDigest(sealInput(next));return next;
}
export function localExecutionSignature(result:AnalyticsQueryResponse):string{try{return result.localExecution?sealInput(result)+result.localExecution.resultDigest:'';}catch{return 'invalid';}}
export async function verifyLocalExecution(result:AnalyticsQueryResponse):Promise<boolean>{try{if(!localExecutionShape(result))return false;const snapshot=structuredClone(result),signature=localExecutionSignature(snapshot);return await localEvidenceDigest(sealInput(snapshot))===snapshot.localExecution!.resultDigest&&localExecutionSignature(result)===signature;}catch{return false;}}
