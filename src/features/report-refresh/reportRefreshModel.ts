import { validateWaveMapping, type WaveFieldMapping } from './reportRefreshMapping';
import { withSafeInference } from '../../../shared/analytics/inferenceSafety';
import type { DatasetSourceRef } from '../../../shared/types/dataSource';
import type { AnalyticsQueryResponse } from '../../../shared/types/analytics';
import type { DashboardDraft, DashboardWorkspace, ImportedDatasetField, ImportedDatasetRecord } from '../../../shared/types/dashboard';
import { getCompatibleChartTypes } from '../analytics/analyticsDisplay';
import { runImportedDatasetQuery } from '../data/importedDatasetAnalytics';
import { normalizeDatasetSourceRefForImportedDataset } from '../data/datasetSourceRegistry';
import { allRespondentsGroupingField } from '../data/numericSummaryScope';
import { assertSavedImportedTileSource, resolveSavedImportedQuery } from '../data/savedImportedQuery';
import { assertRecoveryImportData, prepareRecoveredImports, recoveryImportSignature } from '../document/recoveredImportModel';
import { createReportRecord } from '../document/workspacePersistence';
import { draftImportedStudyReferences } from '../document/importedStudyUsage';
import { narrativeState } from '../narratives/narrativeEvidence';

export interface ReportRefreshContext { draft: DashboardDraft; studies: ImportedDatasetRecord[] }
export interface WaveCellChange { label: string; before: number | null; after: number | null; beforeBase: number | null; afterBase: number | null; unit: string }
export interface ReportRefreshPreview {
  sourceTitle: string; targetTitle: string; reportTitle: string;
  mappings: Array<{ column: string; label: string; targetLabel: string; categories: Array<{source:string;target:string}> }>;
  analyses: Array<{ title: string; changes: WaveCellChange[] }>;
  retainedText: string[]; retainedLibraryReferences: string[]; linkedClaims: number;
}
type Receipt = { binding: string; draft: string; preview: string; recoveryBinding?: string; reviewedAt?: string };
const receipts = new WeakMap<ReportRefreshPreview, Receipt>();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function fail(message: string): never { throw Error(message); }
function completeStudy(study: ImportedDatasetRecord) {
  if (study.sourceType !== 'local_file' || study.remote || study.preparation || !['csv','xlsx','sav'].includes(study.fileType) ||
      !Number.isFinite(Date.parse(study.importedAt)) || !Number.isSafeInteger(study.rowCount) || study.rowCount < 1 || study.rowCount > 50_000 ||
      study.rows.length !== study.rowCount || study.fieldCount !== study.fields.length || !study.fields.length || Object.hasOwn(study,'rowStorage'))
    fail('Choose complete, original local studies with 1–50,000 rows. Remote, prepared and incomplete studies need a dedicated review.');
  if(study.sourceRef && (study.sourceRef.kind!=='imported_file'||study.sourceRef.provider!=='local_file'||study.sourceRef.datasetId!==study.id))fail('The local study has conflicting source provenance. Review the source before refreshing this report.');
  if (new Set(study.fields.map(field=>field.id)).size !== study.fields.length || new Set(study.fields.map(field=>field.sourceColumn)).size !== study.fields.length) fail('The study has ambiguous field identities.');
}
function assertLocalReferences(references:Array<DatasetSourceRef|undefined>,source:ImportedDatasetRecord) {
  const expected=normalizeDatasetSourceRefForImportedDataset(source);
  const routing=(ref:DatasetSourceRef)=>JSON.stringify(Object.keys(ref).filter(key=>key!=='label'&&ref[key as keyof DatasetSourceRef]!==undefined).sort().map(key=>[key,ref[key as keyof DatasetSourceRef]]));
  for(const ref of references)if(ref!==undefined && (!ref||ref.kind!=='imported_file'||ref.provider!=='local_file'||ref.datasetId!==source.id||routing(ref)!==routing(expected)))
    fail('This report has conflicting local source references. Review its recorded provenance before refreshing; no source was substituted.');
}
function fieldContext(field: ImportedDatasetField) {
  const {id:_id, nonEmptyCount:_nonEmpty, distinctCount:_distinct, sampleValues:_sample,...meaning}=field;
  // Key order is not meaning; do not coerce codes, labels or source-column spelling.
  return JSON.stringify(Object.keys(meaning).sort().map(key=>[key,meaning[key as keyof typeof meaning]]));
}
function cells(result: AnalyticsQueryResponse) {
  if (!result.columns.length || !result.table.length || result.columns.length * result.table.length > 5_000 || result.weighting.applied || result.query.weight !== null)
    fail('Each analysis needs a nonempty unweighted result of at most 5,000 cells.');
  const rows = new Set<string>(), columns = new Set<string>();
  const key=(raw: string | undefined, summary=false)=>{
    if (summary && raw===undefined) return 'summary';
    try { const value=JSON.parse(raw!); if (value===null || typeof value==='string') return raw!; } catch { /* refuse below */ }
    return fail('Refresh the original analysis to record its raw answer identities before refreshing this report.');
  };
  const columnKeys=result.columns.map(column=>{const value=key(column.sourceCategoryKey,result.columns.length===1 && result.query.sourceIdentity?.kind==='imported' && !result.query.sourceIdentity.bannerFieldId);if(columns.has(value))fail('This result has ambiguous columns.');columns.add(value);return value;});
  const values=new Map<string,WaveCellChange>();
  for(const row of result.table){const rowKey=key(row.sourceCategoryKey);if(rows.has(rowKey))fail('This result has ambiguous answers.');rows.add(rowKey);
    result.columns.forEach((column,index)=>{const base=row.bases[column.id],value=row.values[column.id];if(!Object.hasOwn(row.bases,column.id)||!Object.hasOwn(row.values,column.id)||!Number.isSafeInteger(base)||base<0||!Number.isFinite(value))fail('This result has an invalid value or sample base. Refresh the original analysis first.');
      values.set(JSON.stringify([rowKey,columnKeys[index]]),{label:`${row.label} / ${column.label}`,before:base===0?null:value,after:null,beforeBase:base,afterBase:null,unit:result.metric.valueFormat==='percent'?'percentage points':'units'});
    });
  }
  return values;
}
function sameCells(left: AnalyticsQueryResponse,right: AnalyticsQueryResponse) {
  if(JSON.stringify(left.labels)!==JSON.stringify(right.labels) || JSON.stringify(left.series)!==JSON.stringify(right.series) || JSON.stringify(left.metric)!==JSON.stringify(right.metric) || JSON.stringify(left.metadataRefs.source)!==JSON.stringify(left.query.sourceIdentity))return false;
  const a=cells(left),b=cells(right);
  return a.size===b.size && [...a].every(([key,value])=>{const other=b.get(key);return other && value.before===other.before && value.beforeBase===other.beforeBase && value.label===other.label;});
}
function includes(a:unknown,b:unknown):boolean {
  if(Array.isArray(a))return Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>includes(value,b[index]));
  if(a&&typeof a==='object')return !!b&&typeof b==='object'&&Object.keys(a).every(key=>includes((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
  return Object.is(a,b);
}
function contextBinding(context: ReportRefreshContext) { return recoveryImportSignature(context); }

/** Explicit, local, descriptive refresh. No inference, source replacement or publication. */
export async function previewReportRefresh(context: ReportRefreshContext, targetId: string, title: string, options: {signal?: AbortSignal; getCurrentContext?:()=>ReportRefreshContext; mappings?: WaveFieldMapping[]} = {}): Promise<ReportRefreshPreview> {
  assertRecoveryImportData(context); // Validate original objects before reads, spreads or serialization.
  const binding=contextBinding(context), frozen=JSON.parse(binding) as ReportRefreshContext;
  const {draft,studies}=frozen;
  if (!title.trim() || title.trim().length>160) fail('Name the new draft using 1–160 characters.');
  if (new Set(studies.map(study=>study.id)).size!==studies.length) fail('The study library has conflicting identities.');
  const tiles=draft.pages.flatMap(page=>page.tiles);
  if (!tiles.length || tiles.length>20 || new Set(tiles.map(tile=>tile.id)).size!==tiles.length || new Set(draft.pages.map(page=>page.id)).size!==draft.pages.length)
    fail('Choose a report with 1–20 uniquely identified local analyses.');
  const sourceId=tiles[0].query.sourceIdentity?.kind==='imported'?tiles[0].query.sourceIdentity.datasetId:undefined;
  const source=studies.find(study=>study.id===sourceId),target=studies.find(study=>study.id===targetId);
  if (!source || !target || source.id===target.id) fail('Choose a different imported wave for this local report.');
  completeStudy(source); completeStudy(target);
  if (source.fileType!==target.fileType) fail('These waves use different file formats. Review their missing-value and code conventions separately.');
  if(tiles.some(tile=>tile.query.weight!==null || tile.result.weighting.applied))fail('Weighted report refresh is unsupported. Create and review an unweighted report separately.');
  const pendingClaims=draft.pages.flatMap(page=>page.elements).filter(element=>{const state=narrativeState(element,draft.pages);return state && !state.current;});
  if(pendingClaims.length) fail('Review the original report’s stale linked claims before using it as a reporting template.');
  const mapped=new Map<string,ImportedDatasetField>();
  const explicitMappings=options.mappings ? clone(options.mappings) : undefined;
  if(explicitMappings && (new Set(explicitMappings.map(item=>item.sourceFieldId)).size!==explicitMappings.length || explicitMappings.some(item=>!source.fields.some(field=>field.id===item.sourceFieldId)))) fail("The field mapping contains duplicate or unknown source fields.");
  function mapField(field: ImportedDatasetField) {
    if(explicitMappings){const validated=validateWaveMapping(source!,target!,field,explicitMappings);mapped.set(field.id,validated.field);return validated.field;}
    const matches=target!.fields.filter(candidate=>candidate.sourceColumn===field.sourceColumn);
    if(matches.length!==1 || source!.fields.filter(candidate=>candidate.sourceColumn===field.sourceColumn).length!==1 || fieldContext(field)!==fieldContext(matches[0]))
      fail(`Review the question or answer mapping for “${field.label}” (${field.sourceColumn}). Exact, unambiguous metadata is required; no field was substituted.`);
    mapped.set(field.id,matches[0]);return matches[0];
  }
  const analyses: ReportRefreshPreview['analyses']=[];let totalPreviewCells=0;
  const next=clone(draft);
  function current(){if(options.signal?.aborted)throw Error('Report refresh canceled. The original report is unchanged.');if(options.getCurrentContext && contextBinding(options.getCurrentContext())!==binding)fail('The report or studies changed. Preview the current version again.');}
  current();
  for(const page of next.pages)for(const tile of page.tiles){
    current();
    const identity=tile.query.sourceIdentity;
    if(identity?.kind!=='imported'||identity.datasetId!==source.id||identity.datasetImportedAt!==source.importedAt||identity.audience||identity.intersectionAudience||tile.derivedOutput||tile.analysisLifecycle?.role==='derived')
      fail('Every analysis must use the same recorded local wave without applied audiences or derived outputs. Those workflows need separate mapping.');
    assertLocalReferences([tile.source?.sourceRef,tile.query.sourceRef,identity.sourceRef,tile.result.query.sourceRef,tile.result.query.sourceIdentity?.sourceRef,tile.result.metadataRefs.source?.sourceRef],source);
    if(JSON.stringify(tile.query)!==JSON.stringify(tile.result.query))fail('Refresh pending query edits in the original report before creating a new-wave draft.');
    if(tile.source && tile.source.kind!=='importedField')fail('This tile has conflicting question or library provenance. Review the original source first.');
    assertSavedImportedTileSource(tile.query,tile.source);
    if(Object.keys(tile.appearance.barStyles).length || Object.keys(tile.appearance.axisLabelOverrides).length || tile.appearance.reportColorSlots || tile.appearance.dotPlotIntervals)
      fail('This chart has category-bound styling or recorded intervals. Review those bindings in a separate copy before using the new-wave workflow; no styling was discarded.');
    const oldConfig=resolveSavedImportedQuery(tile.query,[source]);
    const oldResult=runImportedDatasetQuery(oldConfig);
    if(!sameCells(tile.result,oldResult))fail(`“${tile.title || tile.name}” no longer matches its source. Refresh and review the original analysis first.`);
    const config={...oldConfig,dataset:target,field:oldConfig.groupingScope==='all_respondents'?allRespondentsGroupingField(target):mapField(oldConfig.field),measureField:oldConfig.measureField?mapField(oldConfig.measureField):null,bannerField:oldConfig.bannerField?mapField(oldConfig.bannerField):null,filter:oldConfig.filter?{field:mapField(oldConfig.filter.field),value:oldConfig.filter.value}:null};
    if(explicitMappings && oldConfig.filter) fail('Filters require a separate category review; remove the filter in a separate report copy before mapping renamed categories.');
    const result=withSafeInference(runImportedDatasetQuery(config)),before=cells(oldResult),after=cells(result);
    if(explicitMappings){
      const remap=(raw:string,fieldId:string|undefined)=>{if(!fieldId)return raw;const entry=explicitMappings.find(item=>item.sourceFieldId===fieldId);const value=JSON.parse(raw);if(value===null)return raw;const category=entry?.categories.find(item=>item.target===value);return category?JSON.stringify(category.source):raw;};
      const aligned=new Map<string,WaveCellChange>();
      for(const [key,value] of after){const [row,column]=JSON.parse(key);aligned.set(JSON.stringify([remap(row,oldConfig.groupingScope==='all_respondents'?undefined:oldConfig.field.id),column==='summary'?column:remap(column,oldConfig.bannerField?.id)]),value);}
      after.clear();for(const [key,value] of aligned)after.set(key,value);
    }
    if(!getCompatibleChartTypes(result).includes(tile.visualization))fail('The new results are incompatible with the original chart. Review the visualization in a separate copy first.');
    const changes=[...new Set([...before.keys(),...after.keys()])].map(key=>{const a=before.get(key),b=after.get(key);return{label:b?.label??a!.label,before:a?.before??null,after:b?.before??null,beforeBase:a?.beforeBase??null,afterBase:b?.beforeBase??null,unit:(a??b)!.unit};});
    totalPreviewCells+=changes.length;if(totalPreviewCells>5_000)fail('The combined report preview exceeds 5,000 cells. Review a smaller report rather than truncating its results.');
    analyses.push({title:tile.title||tile.name,changes});tile.query=clone(result.query);tile.result=result;
    if(tile.source?.kind==='importedField')tile.source={...tile.source,id:`${target.id}:${result.query.sourceIdentity?.kind==='imported'?result.query.sourceIdentity.primaryFieldId:''}`,datasetId:target.id,fieldId:result.query.sourceIdentity?.kind==='imported'?result.query.sourceIdentity.primaryFieldId:undefined,sourceRef:result.query.sourceRef};
    // Yield between analyses. Individual calculations are still synchronous and cannot be interrupted.
    await new Promise<void>(resolve=>setTimeout(resolve,0));current();
  }
  if(typeof globalThis.crypto?.randomUUID!=='function')fail('This browser cannot create a safely identified draft. Keep the original report and use a supported browser.');
  next.id=`wave-report-${crypto.randomUUID()}`;next.title=title.trim();next.status='draft';next.publishMetadata={publishCount:0,versionLabel:'Draft'};
  // The writer must retain every embedded source at workspace level before dropping draft copies.
  next.importedDatasets=[];
  next.waveRefresh={version:1,sourceReportId:draft.id,sourceReportTitle:draft.title,sourceStudy:{datasetId:source.id,importedAt:source.importedAt},targetStudy:{datasetId:target.id,importedAt:target.importedAt},categoryMappings:explicitMappings,fieldMappings:[...mapped].map(([id,field])=>({sourceFieldId:id,targetFieldId:field.id,sourceColumn:field.sourceColumn})),declaration:'The user reviewed the mappings, descriptive result changes, retained claims and libraries, and question meaning, sampling and populations. This is not statistical validation or publication approval.'};
  const preview:ReportRefreshPreview={sourceTitle:source.title,targetTitle:target.title,reportTitle:next.title,mappings:[...mapped].map(([id,field])=>({column:field.sourceColumn,label:source.fields.find(item=>item.id===id)!.label,targetLabel:field.label,categories:explicitMappings?.find(item=>item.sourceFieldId===id)?.categories??[]})),analyses,
    retainedText:draft.pages.flatMap(page=>[`Page title: ${page.title}`,...page.tiles.map(tile=>`Analysis title: ${tile.title||tile.name}`),...page.elements.filter(element=>element.type==='text').map(element=>element.content)]),
    retainedLibraryReferences:[...new Set(draftImportedStudyReferences({...draft,pages:[],importedDatasets:[]}).map(ref=>ref.location))],
    linkedClaims:draft.pages.flatMap(page=>page.elements).filter(element=>element.evidence!==undefined).length};
  // Normalize fresh descriptive results through the same safe-inference path as persistence.
  const normalized=createReportRecord(next).draft;
  if(!includes(next,normalized))fail('The current report format cannot retain the new-wave draft. Nothing was replaced.');
  current();receipts.set(preview,{binding,draft:JSON.stringify(normalized),preview:JSON.stringify(preview)});return preview;
}

export function reportRefreshPreviewIsCurrent(context: ReportRefreshContext,preview: ReportRefreshPreview):boolean {
  try{const receipt=receipts.get(preview),binding=contextBinding(context);return !!receipt && (binding===receipt.binding||binding===receipt.recoveryBinding) && recoveryImportSignature(preview)===receipt.preview;}catch{return false;}
}

/** Additive, idempotent candidate; the caller must save it with this same candidate as recovery. */
export function createRefreshedReportWorkspace(workspace: DashboardWorkspace, context: ReportRefreshContext, preview: ReportRefreshPreview, reviewed: boolean): {workspace:DashboardWorkspace;report:DashboardDraft} {
  if(reviewed!==true)fail("Review the mappings, changes and retained text before creating the new-wave draft.");
  const receipt=receipts.get(preview);
  if(!receipt || !reportRefreshPreviewIsCurrent(context,preview))fail('This preview changed or expired. Preview the current report and sources again.');
  assertRecoveryImportData(workspace);
  // The preview's study library must still be the writer's root library, not a stale component copy.
  if(recoveryImportSignature(workspace.importedDatasets)!==recoveryImportSignature(context.studies))fail('The workspace study library changed. Preview the current sources again.');
  const original=workspace.reports.find(item=>item.id===context.draft.id&&!item.archived);
  if(!original || recoveryImportSignature(original.draft)!==recoveryImportSignature(context.draft))fail('The original report is not saved at the previewed version. Save and review the current report before creating its new-wave copy.');
  const report=JSON.parse(receipt.draft) as DashboardDraft;
  receipt.reviewedAt??=new Date().toISOString();
  report.waveRefresh!.reviewedAt=receipt.reviewedAt;
  const next=prepareRecoveredImports(workspace,context.draft.importedDatasets);
  const recoveryBinding=contextBinding({...context,studies:next.importedDatasets});
  const existing=next.reports.find(item=>item.id===report.id);
  if(existing){if(JSON.stringify(existing.draft)!==JSON.stringify(createReportRecord(report,existing.createdAt).draft))fail('The new draft identity is already in use. No report was replaced.');receipt.recoveryBinding=recoveryBinding;return{workspace:{...next,activeReportId:report.id},report:existing.draft};}
  const record=createReportRecord(report);
  // Normalization may supply defaults, but must preserve every retained authored property.
  if(!includes(report,record.draft))fail('The current report format cannot preserve this draft exactly. Nothing was replaced.');
  receipt.recoveryBinding=recoveryBinding;
  return{workspace:{...next,activeReportId:record.id,reports:[record,...next.reports]},report:record.draft};
}
