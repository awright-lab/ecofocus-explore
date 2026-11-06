import type { DashboardDraft, DashboardTile, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { AudienceExpression, SavedImportedAudience } from "../../../shared/types/audience";
import { analysisSettingsMatch } from "../../../shared/analytics/queryFreshness";
import { resultIdentityIssue } from "../../../shared/analytics/resultIdentities";
import { resolveSavedImportedQuery, assertSavedImportedTileSource } from "../data/savedImportedQuery";
import { runImportedDatasetQuery } from "../data/importedDatasetAnalytics";
import { audienceCategoryChoices, audienceSourceIssue, compileAudience } from "../audiences/audienceModel";

export interface LinkedSelection { fieldId: string; sourceColumn: string; value: string; label: string }
export interface LinkedView { tile: DashboardTile; pageTitle: string }
export interface LinkedStudy { dataset: ImportedDatasetRecord; views: LinkedView[]; excluded: { title: string; reason: string }[] }
function configFor(tile: DashboardTile, dataset: ImportedDatasetRecord) {
  const source = tile.result.query.sourceIdentity;
  const issue = resultIdentityIssue(tile.result);
  if (issue) throw new Error(issue);
  if (!analysisSettingsMatch(tile.query,tile.result.query)) throw new Error("Pending query edits: update or undo the original analysis first.");
  if (tile.derivedOutput || tile.result.metadataRefs.authoredVariableSet?.applied) throw new Error("Derived or authored outputs are not respondent-level linked views.");
  if (source?.kind !== "imported" || !source.datasetImportedAt || !Number.isFinite(Date.parse(source.datasetImportedAt)) || source.datasetImportedAt !== dataset.importedAt) throw new Error("The recorded study import is missing or changed. Rerun the source analysis.");
  if (tile.result.metadataRefs.source?.kind !== "imported" || !analysisSettingsMatch({...tile.result.query,sourceIdentity:tile.result.metadataRefs.source},tile.result.query)) throw new Error("Conflicting recorded source context. Refresh the original analysis.");
  if (tile.result.metric.id !== tile.result.query.metric || tile.result.metric.valueFormat !== (["count","average","sum"].includes(tile.result.metric.id)?"number":"percent") || tile.result.weighting.applied || tile.result.weighting.id !== null) throw new Error("The recorded metric or weighting is inconsistent or unsupported.");
  assertSavedImportedTileSource(tile.result.query,tile.source);
  return resolveSavedImportedQuery(tile.result.query,[dataset]);
}
export function linkedStudy(draft: DashboardDraft, datasetId: string): LinkedStudy {
  const studies = draft.importedDatasets.filter(study=>study.id===datasetId);
  if (studies.length!==1) throw new Error("Choose one unambiguous study in this report.");
  const dataset=studies[0],issue=audienceSourceIssue(dataset);
  if (issue) throw new Error(issue);
  if (dataset.remote) throw new Error("Linked exploration requires a complete local study; remote connections are not executed.");
  if (dataset.rowCount>50000) throw new Error("Linked exploration currently supports studies up to 50,000 rows. Your source data is unchanged.");
  const views:LinkedView[]=[],excluded:LinkedStudy["excluded"]=[],ids=new Set<string>();
  for (const page of draft.pages) for (const tile of page.tiles) {
    const source=tile.result.query.sourceIdentity;
    if (source?.kind!=="imported"||source.datasetId!==datasetId) continue;
    if (ids.has(tile.id)) throw new Error("Duplicate analysis IDs prevent unambiguous linked exploration.");
    ids.add(tile.id);
    try { configFor(tile,dataset); views.push({tile,pageTitle:page.title}); }
    catch(error) { excluded.push({title:tile.title||tile.name,reason:error instanceof Error?error.message:"Source is unavailable."}); }
  }
  if(views.length>12) throw new Error("This study has more than 12 eligible views. Linked exploration currently supports up to 12; no views were silently omitted.");
  return {dataset,views,excluded};
}
export function linkedSelection(study:LinkedStudy,tileId:string,rowId:string):LinkedSelection {
  const view=study.views.find(view=>view.tile.id===tileId);
  if(!view) throw new Error("Choose an eligible linked view.");
  const config=configFor(view.tile,study.dataset);
  if(config.groupingScope==="all_respondents")throw new Error("An all-respondent total is not a selectable group.");
  const row=view.tile.result.table.find(row=>row.optionId===rowId);
  let value:unknown;try {value=JSON.parse(row?.sourceCategoryKey??"");}catch {throw new Error("This row lacks a recorded category key. Refresh the source analysis.");}
  if(typeof value!=="string"||!audienceCategoryChoices(study.dataset,config.field).some(choice=>choice.value===value))throw new Error("This row is not an observed selectable category.");
  const fresh=runImportedDatasetQuery(config),verified=fresh.table.find(candidate=>candidate.sourceCategoryKey===row!.sourceCategoryKey);
  if(!verified||verified.label!==row!.label||Object.keys(verified.values).length!==Object.keys(row!.values).length||Object.entries(verified.values).some(([key,value])=>row!.values[key]!==value||row!.bases[key]!==verified.bases[key]))throw new Error("This displayed group does not match the current source rows. Refresh the original analysis before selecting it.");
  return {fieldId:config.field.id,sourceColumn:config.field.sourceColumn,value,label:`${config.field.label}: ${row!.label}`};
}
export function runLinkedViews(study:LinkedStudy,selections:LinkedSelection[]):LinkedView[] {
  if(selections.length>8)throw new Error("Use at most eight linked selections. Go Back or Reset to choose a different path.");
  const expressions:AudienceExpression[]=selections.map(selection=>{
    const field=study.dataset.fields.find(field=>field.id===selection.fieldId&&field.sourceColumn===selection.sourceColumn);
    if(!field||!audienceCategoryChoices(study.dataset,field).some(choice=>choice.value===selection.value))throw new Error("A selected category no longer matches this study.");
    return {kind:"category",fieldId:field.id,sourceColumn:field.sourceColumn,exclude:false,values:[selection.value]};
  });
  return study.views.map(view=>{
    const config=configFor(view.tile,study.dataset);
    if(!selections.length)return view;
    const audience:SavedImportedAudience={version:1,id:"linked-exploration",label:"Linked selection",datasetId:study.dataset.id,importedAt:study.dataset.importedAt,expression:{kind:"group",match:"all",exclude:false,children:[...(config.audience?[config.audience.expression]:[]),...expressions]}};
    compileAudience(audience,study.dataset);
    const result=runImportedDatasetQuery({...config,audience,chartType:view.tile.visualization});
    return {...view,tile:{...view.tile,query:result.query,result}};
  });
}
