import type {DashboardDraft,DashboardTile,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import type {AnalyticsQueryResponse} from '../../../shared/types/analytics';
import type {PreparedExecutionLineage, LocalExecutionCoverage} from '../../../shared/types/localExecution';
import {canonicalLocalEvidence,localEvidenceDigest,sealLocalExecution,verifyLocalExecution,validPreparedExecutionLineage} from '../../../shared/analytics/localExecutionEvidence';
import {analysisSettingsMatch} from '../../../shared/analytics/queryFreshness';
import {resultIdentityIssue} from '../../../shared/analytics/resultIdentities';
import {assertSavedImportedTileSource,resolveSavedImportedQuery} from '../data/savedImportedQuery';
import {runImportedDatasetQuery} from '../data/importedDatasetAnalytics';
import {importedRawFieldValue} from '../data/importedRawValue';
import { normalizeDatasetSourceRefForImportedDataset } from '../data/datasetSourceRegistry';
import { assertStudyPreparation } from '../../../shared/types/dataPreparation';
import { preparationFingerprintInput, verifyPreparedStudy } from '../data-preparation/preparationModel';

export interface VersionedRefreshContext{draft:DashboardDraft;studies:ImportedDatasetRecord[];tileId:string}
export interface VersionedRefreshPreview{binding:string;result:AnalyticsQueryResponse;sourceText:string;tileId:string;previousSourceDigest?:string}
function resolve(context:VersionedRefreshContext){
 const tiles=context.draft.pages.flatMap(p=>p.tiles).filter(t=>t.id===context.tileId);if(tiles.length!==1)throw Error('Choose one unambiguous analysis in the current report.');const tile=tiles[0];
 if(tile.derivedOutput||tile.result.metric.id==='calculated'||tile.result.metadataRefs.authoredVariableSet?.applied)throw Error('Calculated or authored results require their own provenance workflow; they are not replaced with a raw imported calculation.');
 if(tile.result.weighting.applied||tile.result.weighting.id!==null)throw Error('Weighted results are not substituted with an unweighted source refresh.');
 if(resultIdentityIssue(tile.result))throw Error('The recorded result has missing or duplicate identities. Keep it and recreate the analysis before recording a source version.');
 if(!analysisSettingsMatch(tile.query,tile.result.query))throw Error('The analysis has unapplied settings. Apply or discard those edits before a versioned refresh.');
 if(tile.result.table.length*tile.result.columns.length>5000)throw Error('A versioned explanation supports at most 5,000 result cells.');
 const id=tile.result.query.sourceIdentity?.kind==='imported'?tile.result.query.sourceIdentity.datasetId:'';
 if(context.studies.filter(s=>s.id===id).length!==1)throw Error('The analysis study is missing or ambiguous.');
 assertSavedImportedTileSource(tile.result.query,tile.source);const config=resolveSavedImportedQuery(tile.result.query,context.studies),study=config.dataset;
 if(study.remote||study.sourceType!=='local_file'||!Array.isArray(study.rows)||!Array.isArray(study.fields)||!Number.isSafeInteger(study.rowCount)||study.rowCount<1||study.rowCount>50000||study.rows.length!==study.rowCount||study.fields.length!==study.fieldCount)throw Error('Versioned refresh requires a complete original local-file study of 1–50,000 rows. Remote and prepared sources are not substituted.');
 if(normalizeDatasetSourceRefForImportedDataset(study).kind!=='imported_file'||study.sourceRef?.datasetId&&study.sourceRef.datasetId!==study.id)throw Error('The local study has a conflicting explicit source reference.');
 if(new Set(study.fields.map(f=>f.id)).size!==study.fields.length||new Set(study.fields.map(f=>f.sourceColumn)).size!==study.fields.length)throw Error('Ambiguous study fields prevent a versioned refresh.');
 let preparation: PreparedExecutionLineage | undefined, originalText: string | undefined, preparedText: string | undefined, originalSourceRef: ReturnType<typeof normalizeDatasetSourceRefForImportedDataset> | undefined;
 if(study.preparation!==undefined){
  assertStudyPreparation(study.preparation);
  const originals=context.studies.filter(s=>s.id===study.preparation!.sourceDatasetId);
  if(originals.length!==1||originals[0].id===study.id)throw Error('The prepared study needs one retained original source. It was not rebound or refreshed.');
  originalSourceRef=normalizeDatasetSourceRefForImportedDataset(originals[0]);
  if(originalSourceRef.kind!=='imported_file'||originals[0].sourceRef?.datasetId&&originals[0].sourceRef.datasetId!==originals[0].id)throw Error('Prepared lineage requires a retained original local file, not a live or managed source reference.');
  preparation=structuredClone({sourceTitle:originals[0].title,recipe:study.preparation});
  if(!validPreparedExecutionLineage(preparation))throw Error('Prepared lineage exceeds the64KiB recorded-history budget or is invalid. Keep the analysis and inspect its preparation history separately.');
  originalText=preparationFingerprintInput(originals[0]);
  preparedText=preparationFingerprintInput({...study,preparation:undefined});
 }
 const ids=new Set([config.field.id,config.measureField?.id,config.bannerField?.id,config.filter?.field.id]);
 function visit(value:unknown,depth=0){if(!value||typeof value!=='object'||depth>6)return;const node=value as Record<string,unknown>;if(typeof node.fieldId==='string')ids.add(node.fieldId);if(Array.isArray(node.children))node.children.forEach(child=>visit(child,depth+1));}if(config.audience)visit(config.audience.expression);
 const fields=study.fields.filter(f=>ids.has(f.id));if(!fields.length)throw Error('No available source fields were selected.');
 const encoder=new TextEncoder();let bytes=encoder.encode(canonicalLocalEvidence(fields)).length+encoder.encode(canonicalLocalEvidence(tile.result.query)).length;if(bytes>20*1024*1024)throw Error('Selected versioned-refresh metadata exceeds 20 MiB.');
 const rows=study.rows.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('A selected source row is malformed.');const values=fields.map(field=>{const value=importedRawFieldValue(row,field);if(typeof value!=='string'||value.length>20000)throw Error('Selected source values must be bounded text.');return value;});bytes+=encoder.encode(JSON.stringify(values)).length+1;if(bytes>20*1024*1024)throw Error('Selected versioned-refresh inputs exceed 20 MiB.');return values;});
 const categories=(field:typeof config.field,blank:boolean)=>{const index=fields.findIndex(f=>f.id===field.id),codes=new Set(Object.keys(field.valueLabels??{}));for(const row of rows){const raw=index<0?'':row[index].trim();if(raw||blank)codes.add(raw);if(codes.size>5000)throw Error('Unfiltered source categories exceed the 5,000-cell versioned-result budget.');}return Math.max(1,codes.size);};
 const groups=config.groupingScope==='all_respondents'?1:categories(config.field,false),columns=config.bannerField?categories(config.bannerField,true):1;
 if(groups*columns>5000)throw Error('Unfiltered source categories exceed the 5,000-cell versioned-result budget.');
 const execution={metric:config.metric==='column_percent'?'percent_selected':config.metric,groupingScope:config.groupingScope??'categories',groupingFieldId:config.field.id,measureFieldId:config.measureField?.id,bannerFieldId:config.bannerField?.id,filter:config.filter?{fieldId:config.filter.field.id,value:config.filter.value}:null,audience:config.audience};
 const sourceText=canonicalLocalEvidence({schema:'analysis-fields-and-rows-v2',datasetId:study.id,datasetLabel:study.title,importedAt:study.importedAt,sourceRef:study.sourceRef,sourceRowCount:study.rowCount,sourceFieldCount:study.fieldCount,fields,rows,execution,...(preparation?{preparation}:{})});
 if(encoder.encode(sourceText).length>20*1024*1024)throw Error('Selected versioned-refresh inputs exceed 20 MiB.');
 return{tile,config,study,sourceText,fields,rows,preparation,originalText,preparedText,originalSourceRef};
}
export function versionedRefreshBinding(context:VersionedRefreshContext):string{const fixed=resolve(context);return canonicalLocalEvidence({reportId:context.draft.id,tileId:fixed.tile.id,source:fixed.sourceText,...(fixed.preparation?{original:fixed.originalText,originalSourceRef:fixed.originalSourceRef,prepared:fixed.preparedText}:{}),query:fixed.tile.query,result:fixed.tile.result});}
export async function previewVersionedRefresh(context:VersionedRefreshContext,options:{signal:AbortSignal;getCurrentContext?:()=>VersionedRefreshContext}):Promise<VersionedRefreshPreview>{
 const binding=versionedRefreshBinding(context),fixed=resolve(context),abort=()=>{if(options.signal.aborted)throw new DOMException('Versioned refresh canceled. The original analysis was kept.','AbortError');};abort();
 // Parse the already bounded immutable serialization. Never query mutable source rows after yielding.
 const parsed=JSON.parse(fixed.sourceText)as{datasetId:string;importedAt:string;sourceFieldCount:number;fields:ImportedDatasetRecord['fields'];rows:string[][]};const rows=parsed.rows.map(values=>Object.fromEntries(parsed.fields.map((f,i)=>[f.sourceColumn,values[i]])));
 const {rows:_liveRows,previewRows:_livePreview,fields:_liveFields,...header}=fixed.study;
 const recordedResult=structuredClone(fixed.tile.result),targetId=fixed.tile.id;
 const dataset={...structuredClone(header),rows,previewRows:rows.slice(0,5),fields:parsed.fields,fieldCount:parsed.fields.length};const projected=resolveSavedImportedQuery(recordedResult.query,[dataset]);
 if(fixed.preparation){
  // Verify immutable full copies; live objects are checked again by the binding
  // after all asynchronous work. A transient mutation must not change replay.
  const original={...JSON.parse(fixed.originalText!),sourceType:'local_file',notes:[],previewRows:[]} as ImportedDatasetRecord;
  const prepared={...JSON.parse(fixed.preparedText!),sourceType:'local_file',notes:[],previewRows:[],preparation:structuredClone(fixed.preparation.recipe)} as ImportedDatasetRecord;
  await verifyPreparedStudy(original,prepared,options.signal);abort();
 }
 const sourceDigest=await localEvidenceDigest(fixed.sourceText);abort();let coverage:LocalExecutionCoverage|undefined;
 const raw=runImportedDatasetQuery(projected,undefined,c=>{coverage=c;});if(!coverage||raw.table.length*raw.columns.length>5000)throw Error('No bounded exact execution coverage was recorded.');
 const result=await sealLocalExecution(raw,{version:2,method:'local-analysis-inputs-sha256-v2',sourceDigest,datasetId:parsed.datasetId,importedAt:parsed.importedAt,executedAt:new Date().toISOString(),sourceFieldCount:parsed.sourceFieldCount,projectedFieldCount:parsed.fields.length,coverage,...(fixed.preparation?{preparation:JSON.parse(JSON.stringify(fixed.preparation)) as PreparedExecutionLineage}:{})});abort();
 const previousSourceDigest=await verifyLocalExecution(recordedResult)?recordedResult.localExecution!.sourceDigest:undefined;abort();
 if(versionedRefreshBinding(options.getCurrentContext?.()??context)!==binding)throw Error('The source, report or analysis changed during refresh. The original analysis was kept.');
 return{binding,result,sourceText:fixed.sourceText,tileId:targetId,previousSourceDigest};
}
export async function applyVersionedRefresh(context:VersionedRefreshContext,preview:VersionedRefreshPreview):Promise<DashboardDraft>{
 const result=structuredClone(preview.result);
 if(versionedRefreshBinding(context)!==preview.binding||!await verifyLocalExecution(result))throw Error('The preview changed or no longer matches its source. Preview again; the original analysis was kept.');
 if(versionedRefreshBinding(context)!==preview.binding)throw Error('The source changed while checking the preview.');
 return{...context.draft,status:'draft',pages:context.draft.pages.map(page=>({...page,tiles:page.tiles.map(tile=>tile.id===preview.tileId?{...tile,query:structuredClone(result.query),result}:tile)}))};
}
export function versionedRefreshTile(context:VersionedRefreshContext):DashboardTile{return resolve(context).tile;}
