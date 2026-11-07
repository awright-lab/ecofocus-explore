import type {DashboardDraft,ImportedDatasetField,ImportedDatasetRecord} from '../../../shared/types/dashboard';
import {compileAudience} from '../audiences/audienceModel';
import {fisherExactTwoSided,holmLogPValues,thresholdDecision} from './exactComparisonMath';

export interface ComparisonReviewPlan {
 reportId:string;datasetId:string;importedAt:string;idFieldId:string;idBinding:string;groupFieldId:string;groupBinding:string;outcomeFieldId:string;outcomeBinding:string;
 audienceId:string;reference:string;targets:string[];eventCodes:string[];excludedCodes:string[];alpha:number;
 design:'unknown'|'unweighted_independent'|'weighted'|'paired_or_clustered';question:string;methodology:string;
}
export interface ComparisonReviewContext {draft:DashboardDraft;studies:ImportedDatasetRecord[];plan:ComparisonReviewPlan}
export interface ComparisonCoverage {total:number;audienceIncluded:number;audienceExcluded:number;audienceUnknown:number;missingGroup:number;unselectedGroups:number;missingOutcome:number;excludedOutcome:number;valid:number}
export interface ComparisonGroup {code:string;label:string;rows:number;missingOutcome:number;excludedOutcome:number;event:number;nonEvent:number;base:number}
export interface ReviewedComparison {
 code:string;label:string;status:'tested'|'no_data'|'no_variation';table:[number,number,number,number];difference:number|null;
 rawLogP:number|null;adjustedLogP:number|null;decision:ReturnType<typeof thresholdDecision>;warnings:string[];
}
export interface ComparisonReviewResult {coverage:ComparisonCoverage;groups:ComparisonGroup[];comparisons:ReviewedComparison[];familySize:number;binding:string;sourceStillCurrent:()=>boolean;audienceLabel:string;sourceTitle:string;outcomeLabel:string;groupLabel:string}
const maximumBytes=20*1024*1024;
export function comparisonStudyIssue(study:ImportedDatasetRecord|undefined):string|null{
 if(!study)return 'Choose a complete original local study.';
 if(study.remote||study.preparation||study.sourceType!=='local_file')return 'Exact group review supports original local-file imports. Remote, partial and prepared studies are not substituted.';
 if(!Number.isSafeInteger(study.rowCount)||study.rowCount<1||study.rowCount>50000||!Array.isArray(study.rows)||!Array.isArray(study.fields)||study.rows.length!==study.rowCount||study.fields.length!==study.fieldCount)return 'Use all source rows and fields from a study with 1–50,000 respondents.';
 if(study.fields.some(f=>!f||typeof f.id!=='string'||!f.id.trim()||typeof f.sourceColumn!=='string'||!f.sourceColumn.trim())||new Set(study.fields.map(f=>f.id)).size!==study.fields.length||new Set(study.fields.map(f=>f.sourceColumn)).size!==study.fields.length)return 'Ambiguous field identities prevent a trustworthy comparison.';
 return null;
}
export function comparisonCodeLabel(field:ImportedDatasetField,code:string){return Object.hasOwn(field.valueLabels??{},code)?field.valueLabels![code]:code;}
export function comparisonChoices(study:ImportedDatasetRecord,field:ImportedDatasetField):string[]{
 const values=new Set<string>();for(const row of study.rows){const raw=Object.hasOwn(row,field.sourceColumn)?row[field.sourceColumn]:'';if(typeof raw!=='string'||raw.length>128)throw Error('Group and outcome codes must be text up to 128 characters.');if(raw.trim())values.add(raw.trim());if(values.size>200)throw Error('Choose fields with at most 200 observed/declared codes.');}
 for(const raw of Object.keys(field.valueLabels??{})){if(raw.length>128)throw Error('Declared codes exceed 128 characters.');if(raw.trim())values.add(raw.trim());if(values.size>200)throw Error('Choose fields with at most 200 observed/declared codes.');}return[...values].sort((a,b)=>a.localeCompare(b));
}
/** Exact ephemeral binding of every input used by this review, including audience values. */
export function comparisonContextBinding({draft,studies,plan}:ComparisonReviewContext):string{
 const matches=studies.filter(s=>s.id===plan.datasetId);if(matches.length>1)throw Error('The selected study identity is ambiguous.');const study=matches[0];
 if(!study)return JSON.stringify({reportId:draft.id,plan,source:null});
 const issue=comparisonStudyIssue(study);if(issue)throw Error(issue);
 const audiences=(draft.savedAudiences??[]).filter(a=>a.id===plan.audienceId),ids=new Set([plan.idFieldId,plan.groupFieldId,plan.outcomeFieldId]);let visited=0;
 function visit(value:unknown,depth=0){if(++visited>64||depth>6||!value||typeof value!=='object')return;const node=value as Record<string,unknown>;if(typeof node.fieldId==='string')ids.add(node.fieldId);if(Array.isArray(node.children))node.children.forEach(child=>visit(child,depth+1));}audiences.forEach(a=>visit(a.expression));
 const fields=study.fields.filter(f=>ids.has(f.id)),encoder=new TextEncoder();let bytes=encoder.encode(JSON.stringify(fields)).length;
 if(bytes>maximumBytes)throw Error('Selected comparison source exceeds the 20 MiB review limit.');
 const values=study.rows.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('A comparison source row is malformed.');const selected=fields.map(f=>{const value=Object.hasOwn(row,f.sourceColumn)?row[f.sourceColumn]:'';if(typeof value!=='string'||value.length>20000)throw Error('Selected raw source values are unsupported.');return value;});bytes+=encoder.encode(JSON.stringify(selected)).length+1;if(bytes>maximumBytes)throw Error('Selected comparison source exceeds the 20 MiB review limit.');return selected;});
 return JSON.stringify({reportId:draft.id,plan,source:{id:study.id,title:study.title,importedAt:study.importedAt,rowCount:study.rowCount,fieldCount:study.fieldCount,fields,values,sourceRef:study.sourceRef},audiences});
}
function resolveReview(input:ComparisonReviewContext,binding:string){
 const{draft,studies,plan}=input;if(plan.reportId!==draft.id)throw Error('The report changed. Start the review in the current report.');
 const matches=studies.filter(s=>s.id===plan.datasetId);if(matches.length!==1)throw Error('Choose one available original study.');const dataset=matches[0],issue=comparisonStudyIssue(dataset);if(issue)throw Error(issue);
 if(!plan.importedAt||plan.importedAt!==dataset.importedAt||!Number.isFinite(Date.parse(plan.importedAt)))throw Error('The study import changed. Reset and explicitly review its fields and codes.');
 if(plan.design!=='unweighted_independent')throw Error('This exact review requires independently sampled, unweighted respondents. Weighted, paired, clustered and unknown designs need different methods.');
 if(!plan.question.trim()||plan.question.length>300||!plan.methodology.trim()||plan.methodology.length>2000)throw Error('Record a research question and sampling/assumption note before testing.');
 thresholdDecision(null,plan.alpha);
 const fields=[plan.idFieldId,plan.groupFieldId,plan.outcomeFieldId].map(id=>dataset.fields.find(f=>f.id===id));if(fields.some(f=>!f)||new Set(fields.map(f=>f!.id)).size!==3)throw Error('Choose three separate, available ID, group and outcome fields.');const[idField,groupField,outcomeField]=fields as ImportedDatasetField[];
 if([plan.idBinding,plan.groupBinding,plan.outcomeBinding].some(binding=>binding.length>200000))throw Error('Selected field metadata is too large for this review binding.');
 if(JSON.stringify(idField)!==plan.idBinding||JSON.stringify(groupField)!==plan.groupBinding||JSON.stringify(outcomeField)!==plan.outcomeBinding)throw Error('Selected field metadata changed. Reset the fields before reviewing; old identities were not silently rebound.');
 if(![groupField,outcomeField].every(f=>['text','categorical'].includes(f.type)||f.modelingRole==='candidate_dimension'))throw Error('Group and outcome fields must represent single-valued categories; numeric measures are not silently tested as categories.');
 const groups=new Set(comparisonChoices(dataset,groupField)),outcomes=new Set(comparisonChoices(dataset,outcomeField));
 if(!groups.has(plan.reference)||plan.targets.length<1||plan.targets.length>20||new Set(plan.targets).size!==plan.targets.length||plan.targets.some(code=>!groups.has(code)||code===plan.reference))throw Error('Choose one reference and 1–20 distinct other groups for the complete comparison family.');
 if(!plan.eventCodes.length||plan.eventCodes.length>100||new Set(plan.eventCodes).size!==plan.eventCodes.length||plan.eventCodes.some(code=>!outcomes.has(code)))throw Error('Choose 1–100 available event codes explicitly. All other nonblank, non-excluded codes count as non-events.');
 if(plan.excludedCodes.length>200||new Set(plan.excludedCodes).size!==plan.excludedCodes.length||plan.excludedCodes.some(code=>!outcomes.has(code)||plan.eventCodes.includes(code)))throw Error('Excluded outcomes must be available, unique and separate from event codes.');
 const snapshot=JSON.parse(binding) as {source:{fields:ImportedDatasetField[];values:string[][]};audiences:NonNullable<DashboardDraft['savedAudiences']>};
 if(plan.audienceId&&snapshot.audiences.length!==1)throw Error('A selected saved audience is missing or ambiguous.');const audience=plan.audienceId?snapshot.audiences[0]:undefined;
 const rows=snapshot.source.values.map(values=>Object.fromEntries(snapshot.source.fields.map((field,index)=>[field.sourceColumn,values[index]])));
 const fixed={...dataset,fields:snapshot.source.fields,fieldCount:snapshot.source.fields.length,rows,previewRows:rows.slice(0,5)};
 const membership=audience?compileAudience(audience,fixed):()=>true;
 return{dataset,idField:structuredClone(idField),groupField:structuredClone(groupField),outcomeField:structuredClone(outcomeField),rows,membership,audienceLabel:audience?.label??'All respondents'};
}
export async function runComparisonReview(input:ComparisonReviewContext,options:{signal:AbortSignal;reviewedBinding:string;getCurrentContext?:()=>ComparisonReviewContext;onProgress?:(stage:string,done:number,total:number)=>void}):Promise<ComparisonReviewResult>{
 const binding=comparisonContextBinding(input);if(options.reviewedBinding!==binding)throw Error('The source, audience or comparison plan changed after assumption review. Confirm the current inputs again.');
 const resolved=resolveReview(input,binding),plan=structuredClone(input.plan),coverage:ComparisonCoverage={total:resolved.rows.length,audienceIncluded:0,audienceExcluded:0,audienceUnknown:0,missingGroup:0,unselectedGroups:0,missingOutcome:0,excludedOutcome:0,valid:0};
 const groups=[plan.reference,...plan.targets].map(code=>({code,label:comparisonCodeLabel(resolved.groupField,code),rows:0,missingOutcome:0,excludedOutcome:0,event:0,nonEvent:0,base:0})),groupMap=new Map(groups.map(g=>[g.code,g])),events=new Set(plan.eventCodes),excluded=new Set(plan.excludedCodes),ids=new Set<string>();
 const abort=()=>{if(options.signal.aborted)throw new DOMException('Comparison canceled. Reports and source data were not changed.','AbortError');};
 const current=()=>{try{return comparisonContextBinding(options.getCurrentContext?.()??input)===binding;}catch{return false;}};abort();
 for(let offset=0;offset<resolved.rows.length;offset+=500){abort();for(let i=offset;i<Math.min(offset+500,resolved.rows.length);i++){
  const row=resolved.rows[i],rawId=row[resolved.idField.sourceColumn],id=rawId.trim();if(!id||rawId.length>256||ids.has(id))throw Error(`Respondent IDs must be nonblank and unique throughout the source, including excluded rows (source row ${i+1}).`);ids.add(id);
  const member=resolved.membership(row);if(member!==true){if(member===null)coverage.audienceUnknown++;else coverage.audienceExcluded++;continue;}coverage.audienceIncluded++;
  const groupCode=row[resolved.groupField.sourceColumn].trim();if(!groupCode){coverage.missingGroup++;continue;}const group=groupMap.get(groupCode);if(!group){coverage.unselectedGroups++;continue;}group.rows++;
  const outcome=row[resolved.outcomeField.sourceColumn].trim();if(!outcome){group.missingOutcome++;coverage.missingOutcome++;continue;}if(excluded.has(outcome)){group.excludedOutcome++;coverage.excludedOutcome++;continue;}group.base++;coverage.valid++;if(events.has(outcome))group.event++;else group.nonEvent++;
 }options.onProgress?.('Counting source respondents',Math.min(offset+500,resolved.rows.length),resolved.rows.length);await new Promise<void>(resolve=>setTimeout(resolve,0));}
 abort();if(!groups[0].base)throw Error('The reference group has no valid outcomes under these rules. No comparisons were accepted.');
 const comparisons:ReviewedComparison[]=[];const rawFamily:number[]=[];
 for(let i=1;i<groups.length;i++){
  abort();const group=groups[i],reference=groups[0],table:[number,number,number,number]=[group.event,group.nonEvent,reference.event,reference.nonEvent],hasVariation=group.event+reference.event>0&&group.nonEvent+reference.nonEvent>0;
  const status=!group.base?'no_data':!hasVariation?'no_variation':'tested',logP=status==='tested'?fisherExactTwoSided(table).logPValue:null;
  const warnings:string[]=[];if(group.base<30||reference.base<30)warnings.push('A group has fewer than 30 valid respondents. Exact testing does not establish precision, power or representativeness.');if(!group.base)warnings.push('This group has no valid outcomes; it contributes p=1 only to preserve the selected adjustment family.');else if(!hasVariation)warnings.push('This 2 by 2 table has no outcome variation; no significance conclusion is interpreted, and p=1 preserves its place in the adjustment family.');if(table.some(v=>v<5))warnings.push('A cell count is below five. This is a Fisher exact test, not a normal/chi-square approximation.');
  rawFamily.push(logP??0);comparisons.push({code:group.code,label:group.label,status,table,difference:group.base?100*(group.event/group.base-reference.event/reference.base):null,rawLogP:logP,adjustedLogP:null,decision:'unavailable',warnings});options.onProgress?.('Testing selected comparison family',i,plan.targets.length);await new Promise<void>(resolve=>setTimeout(resolve,0));
 }
 abort();const adjusted=holmLogPValues(rawFamily);comparisons.forEach((comparison,i)=>{if(comparison.status==='tested'){comparison.adjustedLogP=adjusted[i];comparison.decision=thresholdDecision(adjusted[i],plan.alpha);}});
 if(!current())throw Error('Source values, field metadata, saved audience or plan changed during testing. Review the current inputs and run again.');
 return {coverage,groups,comparisons,familySize:plan.targets.length,binding,sourceStillCurrent:current,audienceLabel:resolved.audienceLabel,sourceTitle:resolved.dataset.title,outcomeLabel:resolved.outcomeField.variableLabel??resolved.outcomeField.label,groupLabel:resolved.groupField.variableLabel??resolved.groupField.label};
}
