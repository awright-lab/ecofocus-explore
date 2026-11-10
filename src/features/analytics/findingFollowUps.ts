import type { AnalyticsQueryRequest } from "../../../shared/types/analytics";
import type { AnalyticsQueryResponse } from "../../../shared/types/analytics";
import { validateAnalyticsQuery } from "../../../shared/analytics/validation";
import type { DashboardTile,ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { SavedImportedAudience } from "../../../shared/types/audience";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { getBannerDimensions,getComparisonDatasetOptions,getDatasetMetadata,getQuestionMetadata } from "../../../shared/metadata/ecofocus2025";
import { resolveSavedImportedQuery,assertSavedImportedTileSource } from "../data/savedImportedQuery";
import { importedFieldDisplayLabel } from "../data/datasetModelingModel";
import { buildImportedFieldSuitability } from "../data/importedDatasetAnalytics";
import { audienceSummary,compileAudience } from "../audiences/audienceModel";

export interface FindingFollowUp {
 id:string; question:string; change:string; rationale:string; query:AnalyticsQueryRequest; title:string;
}
export interface FindingFollowUps {
 finding:string; sourceLabel:string; kept:string[]; options:FindingFollowUp[]; unavailable:string|null; notices:string[];
}
export function findingFollowUps(tile:DashboardTile,rowId:string,columnId:string,studies:ImportedDatasetRecord[],audiences:SavedImportedAudience[]=[]):FindingFollowUps {
 const model:FindingFollowUps={finding:"",sourceLabel:tile.title,kept:[],options:[],unavailable:null,notices:["Follow-ups are questions to investigate, not claims of significance or causality. A separate analysis preserves the original."]};
 function unavailable(message:string){model.unavailable=message;return model;}
 if(resultIdentityIssue(tile.result))return unavailable("This result has ambiguous identities. Refresh the original analysis first.");
 if(!analysisSettingsMatch(tile.query,tile.result.query))return unavailable("Refresh the original analysis or undo pending edits before investigating its saved finding.");
 if(tile.derivedOutput||tile.result.query.authoredVariableSet||tile.result.metadataRefs.authoredVariableSet?.applied)return unavailable("Open the original respondent-level analysis to investigate this authored or derived output.");
 const row=tile.result.table.find(row=>row.optionId===rowId),column=tile.result.columns.find(column=>column.id===columnId);
 if(!row||!column)return unavailable("Choose an available result row and column.");
 const cell=analyticalCell(tile.result,row,columnId);
 const metric=tile.result.metric.id,expectedFormat=metric==="count"||metric==="average"||metric==="sum"?"number":"percent";
 if(!["count","average","sum","column_percent","percent_selected"].includes(metric)||tile.result.query.metric!==metric||tile.result.metric.valueFormat!==expectedFormat||tile.result.weighting.applied!==(tile.result.query.weight!==null)||tile.result.weighting.id!==tile.result.query.weight)return unavailable("The saved metric or weighting is unconfirmed. Refresh the original analysis first.");
 if(cell.status!=="available"||cell.value===null)return unavailable("This cell has no reliable observed value to investigate. Review its explanation first.");
 model.finding=`${row.label} / ${column.label}: ${cell.value}${tile.result.metric.valueFormat==="percent"?"%":""}`;
 const query=structuredClone(tile.result.query),source=query.sourceIdentity;
 model.kept=[`Metric: ${tile.result.metric.label}`,`Weight: ${tile.result.weighting.applied?tile.result.weighting.label:"Unweighted"}`];
 // The imported base is resolved once below; candidates use compatible fields or compiled audiences.
 // Preview and creation revalidate the selected query, avoiding repeated full-column filter scans.
 function add(id:string,question:string,change:string,next:AnalyticsQueryRequest,rationale:string){const planned={...next,chartType:"table" as const};if(planned.sourceIdentity?.kind!=="imported"&&validateAnalyticsQuery(planned).length)return;model.options.push({id,question,change,query:planned,rationale,title:question.slice(0,180)});}
 if(source?.kind==="imported"){
  let config:ReturnType<typeof resolveSavedImportedQuery>;
  try{assertSavedImportedTileSource(query,tile.source);config=resolveSavedImportedQuery(query,studies);}catch(error){return unavailable(error instanceof Error?error.message:"The original study context is unavailable.");}
  const {dataset}=config;
  if(dataset.remote)return unavailable("Follow-ups currently require a complete local imported study. Remote study execution is not verified for this workflow.");
  if(!source.datasetImportedAt||!Number.isFinite(Date.parse(source.datasetImportedAt))||source.datasetImportedAt!==dataset.importedAt)return unavailable("This result has no matching recorded import version. Rerun the original analysis before creating a follow-up.");
  if(tile.result.metadataRefs.source?.kind!=="imported"||!analysisSettingsMatch({...query,sourceIdentity:tile.result.metadataRefs.source},query))return unavailable("The saved result has conflicting study context. Refresh the original analysis first.");
  model.sourceLabel=dataset.title;
  model.kept.push(`Study import: ${source.datasetImportedAt}`,`Grouping: ${source.primaryFieldLabel}`,`Breakout: ${source.bannerFieldLabel??"None"}`,`Filter: ${source.filterFieldLabel?`${source.filterFieldLabel} is ${source.filterValue}`:"None"}`,`Audience: ${source.audience?.label??"All respondents"}`);
  model.notices.push("All original answer rows remain in the follow-up table; inspect the selected answer without changing its denominator. Imported wave comparisons require mapped study versions and are not offered here.");
  for(const field of dataset.fields){
   if(field.id===source.primaryFieldId||field.id===source.bannerFieldId||field.id===source.filterFieldId||field.id===source.measureFieldId||!field.eligibleForBanner||buildImportedFieldSuitability(field).recommendedQueryMode!=="categorical"||field.nonEmptyCount<=0)continue;
   const label=importedFieldDisplayLabel(field);
   add(`breakout:${field.id}`,`Does ${row.label} vary by ${label}?`,source.bannerFieldLabel?`Replace breakout ${source.bannerFieldLabel} with ${label}`:`Add breakout ${label}`,{...query,sourceIdentity:{...source,bannerFieldId:field.id,bannerFieldLabel:label}},`Compare the same recorded answer across ${label}; the metric, filter, audience and source import stay fixed.`);
  }
  for(const audience of audiences){
   if(audience.datasetId!==dataset.id||audience.importedAt!==dataset.importedAt||JSON.stringify(audience)===JSON.stringify(source.audience))continue;
   try{compileAudience(audience,dataset);}catch{continue;}
   add(`audience:${audience.id}`,`What does ${row.label} look like for ${audience.label}?`,`Replace audience ${source.audience?.label??"All respondents"} with ${audience.label}`,{...query,sourceIdentity:{...source,audience:structuredClone(audience)}},`Recalculate the same question for this saved audience. Existing filter conditions also apply; the new base can be smaller. Rules: ${audienceSummary(audience)}`);
  }
 }else if(source?.kind==="seeded"&&source.sourceRef?.kind==="seeded_demo"){
  if(query.filters.some(filter=>filter.values.length&&!filter.values.includes("all")))return unavailable("The sample preview engine does not apply response filters. Use a complete local study to investigate a filtered finding.");
  if(tile.result.metadataRefs.source?.kind!=="seeded"||!analysisSettingsMatch({...query,sourceIdentity:tile.result.metadataRefs.source},query))return unavailable("The sample source metadata is inconsistent. Refresh the original analysis first.");
  const question=getQuestionMetadata(query.dataset,query.question);
  if(!question||source.datasetId!==query.dataset||source.questionId!==query.question)return unavailable("This sample result has mismatched question metadata. Refresh the original analysis first.");
  model.sourceLabel=`${source.datasetLabel??query.dataset} · illustrative sample`;
  model.kept.push(`Question: ${question.label}`,`Filters: ${query.filters.map(filter=>`${filter.field}: ${filter.values.join(" or ")}`).join("; ")||"None"}`);
  model.notices.push("These are illustrative sample comparisons, not evidence from an imported study. Sample preview does not verify a live service.");
  for(const dimension of getBannerDimensions(query.dataset))if(dimension.id!=="SHOPPER_SEGMENT"&&dimension.id!==query.breakBy&&question.allowedBreakBys.includes(dimension.id))add(`breakout:${dimension.id}`,`Does ${row.label} vary by ${dimension.label}?`,`Change breakout to ${dimension.label}`,{...query,breakBy:dimension.id},"Compare the same sample question and metric across this declared audience dimension; existing filters and weight remain.");
  if((query.comparisonMode??"none")==="none")for(const dataset of getComparisonDatasetOptions(query.dataset)){
   const other=getQuestionMetadata(dataset.id,query.question);
   if(!other||other.universe!==question.universe||!other.allowedMetrics.includes(query.metric)||JSON.stringify(other.options.map(option=>option.id))!==JSON.stringify(question.options.map(option=>option.id)))continue;
   add(`wave:${dataset.id}`,`Does ${row.label} change in ${getDatasetMetadata(dataset.id)?.label??dataset.id}?`,`Compare with ${dataset.label} (illustrative sample)`,{...query,comparisonMode:"wave",comparisonDatasets:[dataset.id]},"The sample metadata has matching question populations and answer codes. This does not establish comparability of real study waves.");
  }
 }else return unavailable("This workflow currently supports complete local studies and explicitly identified sample results. Live and unversioned results need verified source context first.");
 if(!model.options.length)model.unavailable="No additional supported groupings or saved audiences are available for this finding. Add an eligible grouping field or a version-matched audience to investigate further.";
 return model;
}

export function followUpPreviewRows(tile:DashboardTile,rowId:string,result:AnalyticsQueryResponse){
 const source=tile.result.table.find(row=>row.optionId===rowId);
 const matches=source?result.table.filter(row=>source.sourceCategoryKey!==undefined?row.sourceCategoryKey===source.sourceCategoryKey:row.optionId===source.optionId):[];
 const selected=matches.length===1?matches[0]:null;
 const rows=result.table.slice(0,8);
 if(selected&&!rows.includes(selected)){rows.splice(7,1,selected);}
 return{rows,selected,selectionIssue:selected?null:"The selected answer is absent or ambiguous in this preview. It has not been treated as an observed zero."};
}
