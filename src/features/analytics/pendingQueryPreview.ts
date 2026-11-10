import type {AnalyticsQueryRequest,AnalyticsQueryResponse} from "../../../shared/types/analytics";
import type {DashboardTile,SavedVariableSet} from "../../../shared/types/dashboard";
import {assertRecoveryImportData,recoveryImportSignature} from "../document/recoveredImportModel";
import {resultIdentityIssue} from "../../../shared/analytics/resultIdentities";
import {analysisSettingsMatch} from "../../../shared/analytics/queryFreshness";
import {validateAnalyticsQuery} from "../../../shared/analytics/validation";
import {tileRefreshQuery} from "../builder/components/inspectorTileQueryModel";
import {assertNonImportedSavedQueryProvenance,executeNonImportedSavedQuery} from "./nonImportedSavedQuery";
import {resolveVariableSetResult} from "./savedQueryRows";
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(item=>typeof item==="string");
const fail=():never=>{throw Error("The analytics service returned an incomplete or mismatched preview. The current result has been kept.");};

/** Validate the displayed table and query binding; not a certification of server
 * calculations, survey variance, inference or source authenticity. */
export function assertPendingPreviewResult(value:unknown,query:AnalyticsQueryRequest):asserts value is AnalyticsQueryResponse{
  recoveryImportSignature(value);
  if(!object(value)||!object(value.query)||!object(value.metric)||!object(value.weighting)||!object(value.statistics)||!object(value.metadataRefs)||!Array.isArray(value.annotations)||!strings(value.labels)||!strings(value.notes)||!strings(value.warnings)||!Array.isArray(value.series)||resultIdentityIssue(value))fail();
  const result=value as unknown as AnalyticsQueryResponse;
  try{if(validateAnalyticsQuery(result.query).length||!analysisSettingsMatch(query,result.query)||result.query.chartType!==query.chartType)fail();}catch{fail();}
  const format=["count","average","sum"].includes(query.metric)?"number":"percent";
  if(result.metric.id!==query.metric||result.metric.valueFormat!==format||typeof result.metric.label!=="string"||typeof result.weighting.applied!=="boolean"||typeof result.weighting.label!=="string"||result.weighting.id!==null&&typeof result.weighting.id!=="string"||result.weighting.applied&&(!query.weight||result.weighting.id!==query.weight)||result.metadataRefs.dataset!==query.dataset||result.metadataRefs.question!==query.question||result.metadataRefs.breakBy!==query.breakBy)fail();
  if(result.metadataRefs.source!==undefined&&!analysisSettingsMatch({...query,sourceIdentity:result.metadataRefs.source},query))fail();
  if(result.series.length!==result.table.length||result.labels.length!==result.columns.length)fail();
  for(const[columnIndex,column]of result.columns.entries())if(typeof column.label!=="string"||result.labels[columnIndex]!==column.label)fail();
  for(const[rowIndex,row]of result.table.entries()){
    const series=result.series[rowIndex];
    if(typeof row.label!=="string"||!object(row.values)||!object(row.bases)||!object(series)||series.id!==row.optionId||series.label!==row.label||!Array.isArray(series.values)||!Array.isArray(series.bases)||series.values.length!==result.columns.length||series.bases.length!==result.columns.length)fail();
    for(const[columnIndex,column]of result.columns.entries()){
      if(!Object.hasOwn(row.values,column.id)||!Object.hasOwn(row.bases,column.id))fail();
      const number=row.values[column.id],base=row.bases[column.id];
      if(!query.weight&&!result.weighting.applied&&(!Number.isSafeInteger(base)||query.metric==="count"&&!Number.isSafeInteger(number)))fail();
      if(typeof number!=="number"||!Number.isFinite(number)||typeof base!=="number"||!Number.isFinite(base)||base<0||format==="percent"&&(number<0||number>100)||query.metric==="count"&&number<0||series.values[columnIndex]!==number||series.bases[columnIndex]!==base)fail();
    }
  }
}

export function pendingQueryPreviewSnapshot(tile:DashboardTile,sets:SavedVariableSet[]){
  // Validate original data before optional-property reads, spread, or filtering.
  assertRecoveryImportData([tile,sets]);
  if(tile.derivedOutput)throw Error("Derived outputs use their dedicated recreation or calculated-metric controls. Preview their original source analysis instead; no query was sent.");
  assertNonImportedSavedQueryProvenance(tile.query,tile.source);
  assertNonImportedSavedQueryProvenance(tile.result.query,tile.source);
  if(tile.result.metadataRefs.source!==undefined)assertNonImportedSavedQueryProvenance({...tile.result.query,sourceIdentity:tile.result.metadataRefs.source},tile.source);
  const text=recoveryImportSignature({id:tile.id,query:tileRefreshQuery(tile),source:tile.source,before:tile.result,sets:tile.source?.kind==="variableSet"?sets.filter(set=>set.id===tile.source?.id):[]});
  const snapshot=JSON.parse(text)as{id:string;query:AnalyticsQueryRequest;source:DashboardTile["source"];before:AnalyticsQueryResponse;sets:SavedVariableSet[]};
  if(validateAnalyticsQuery(snapshot.query).length)throw Error("Correct the pending query settings before requesting a preview.");
  assertPendingPreviewResult(snapshot.before,snapshot.before.query);
  return{key:text,...snapshot};
}
export async function runPendingQueryPreview(snapshot:ReturnType<typeof pendingQueryPreviewSnapshot>,signal?:AbortSignal){
  const response=await executeNonImportedSavedQuery(snapshot.query,snapshot.source,{signal});
  assertPendingPreviewResult(response,snapshot.query);
  const result=resolveVariableSetResult(response,snapshot.query,snapshot.source,snapshot.sets);
  assertPendingPreviewResult(result,result.query);
  return result;
}
