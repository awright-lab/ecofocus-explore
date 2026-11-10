import type {AnalyticsQueryRequest} from "../../../shared/types/analytics";
import type {DashboardTile} from "../../../shared/types/dashboard";
import {runAnalyticsQuery} from "../../lib/api";
import {runIllustrativeFollowUpQuery} from "./illustrativeFollowUpQuery";
import {assertRecoveryImportData} from "../document/recoveredImportModel";

/** Inspect every explicit source role before selecting the generic endpoint. */
export function assertNonImportedSavedQueryProvenance(query:AnalyticsQueryRequest,source:DashboardTile["source"]){
  assertRecoveryImportData([query,source]);
  if(!query||typeof query!=="object"||Array.isArray(query))throw Error("The saved query context is unavailable. No analytics query was sent.");
  const references=[query.sourceRef,query.sourceIdentity?.sourceRef,source?.sourceRef];
  if(query.sourceIdentity?.kind==="imported"||source?.kind==="importedField"||references.some(ref=>ref&&["imported_file","workspace_database"].includes(ref.kind)))throw Error("This saved analysis is missing its imported study context. Recreate it from the original result.");
  if(query.sourceIdentity?.kind==="live"||references.some(ref=>ref?.kind==="live_connection"))throw Error("Connected-source queries require the live-query workflow and a verified source revision. No generic analytics query was sent.");
  if(query.sourceIdentity!==undefined&&query.sourceIdentity?.kind!=="seeded"||source!==undefined&&source?.kind!=="question"&&source?.kind!=="variableSet"||references.some(ref=>ref!==undefined&&ref?.kind!=="seeded_demo"))throw Error("This saved analysis has unsupported source references. No generic analytics query was sent.");
}

/** Shared route for a saved ordinary query and its read-only preview. */
export async function executeNonImportedSavedQuery(query:AnalyticsQueryRequest,source:DashboardTile["source"],options:{signal?:AbortSignal}={}){
  assertNonImportedSavedQueryProvenance(query,source);
  const canceled=()=>{if(options.signal?.aborted)throw new DOMException("Query preview canceled.","AbortError");};canceled();
  const result=query.sourceIdentity?.kind==="seeded"&&query.sourceIdentity.sourceRef?.kind==="seeded_demo"
    ?runIllustrativeFollowUpQuery(query):await runAnalyticsQuery(query,options);
  canceled();return result;
}
