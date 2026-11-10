import type {DashboardDraft, ImportedDatasetField, ImportedDatasetRecord} from '../../../shared/types/dashboard';
import type {AudienceExpression, SavedImportedAudience} from '../../../shared/types/audience';
import {assertSavedAudiences, audienceCategoryKey} from '../audiences/audienceModel';

export interface DiscoveryPlan {
 reportId:string; datasetId:string; importedAt:string; idFieldId:string; outcomeFieldId:string;
 dimensionIds:string[]; fieldBindings:Record<string,string>; eventCodes:string[]; excludedCodes:string[];
 question:string; design:'unknown'|'independent_unweighted'|'unsupported';
}
export interface DiscoveryContext {draft:DashboardDraft; studies:ImportedDatasetRecord[]; plan:DiscoveryPlan}
export interface RateCount {events:number; base:number}
export interface SegmentFold {inside:RateCount; outside:RateCount; unknown:number; difference:number|null}
export interface SegmentCandidate {
 key:string; label:string; expression:AudienceExpression;
 full:SegmentFold; discovery:SegmentFold; validation:SegmentFold;
 stability:'repeated'|'changed'|'small'|'unavailable'; warnings:string[];
}
export interface DiscoveryResult {
 binding:string; candidates:SegmentCandidate[]; discoveryRows:number; validationRows:number;
 missingOutcome:number; excludedOutcome:number; validOutcome:number; sourceTitle:string;
}
const maxBytes=20*1024*1024;
export function discoveryStudyIssue(study:ImportedDatasetRecord|undefined):string|null {
 if(!study||study.sourceType!=='local_file'||study.remote||study.preparation)return 'Choose a complete original local-file study. Remote, partial and prepared studies are not substituted.';
 if(!Array.isArray(study.rows)||!Array.isArray(study.fields)||!Number.isSafeInteger(study.rowCount)||study.rowCount<1||study.rowCount>50000||study.rows.length!==study.rowCount||study.fieldCount!==study.fields.length)return 'Audience discovery requires all rows and fields from a study with 1–50,000 respondents.';
 if(study.fields.some(f=>!f||!f.id?.trim()||!f.sourceColumn?.trim())||new Set(study.fields.map(f=>f.id)).size!==study.fields.length||new Set(study.fields.map(f=>f.sourceColumn)).size!==study.fields.length)return 'Ambiguous field identities prevent discovery.';
 return null;
}
export function discoveryLabel(field:ImportedDatasetField,code:string):string {
 return Object.hasOwn(field.valueLabels??{},code)?field.valueLabels![code]:code;
}
export function discoveryCodes(study:ImportedDatasetRecord,field:ImportedDatasetField,dimension=false):string[] {
 const values=new Set<string>();
 for(const row of study.rows){const raw=Object.hasOwn(row,field.sourceColumn)?row[field.sourceColumn]:'';if(typeof raw!=='string'||raw.length>128)throw Error('Selected categorical codes must be text of at most 128 characters.');const code=dimension?audienceCategoryKey(field,raw):raw.trim();if(code)values.add(code);if(values.size>(dimension?20:200))throw Error(dimension?'Choose dimensions with at most 20 observed categories each.':'Choose an outcome with at most 200 observed codes.');}
 return [...values].sort(compareText);
}
function compareText(a:string,b:string){return a<b?-1:a>b?1:0;}
function value(row:Record<string,string>,field:ImportedDatasetField){const raw=Object.hasOwn(row,field.sourceColumn)?row[field.sourceColumn]:'';if(typeof raw!=='string'||raw.length>20000)throw Error('A selected source value is malformed or too long.');return raw;}
export function discoveryBinding({draft,studies,plan}:DiscoveryContext):string {
 const matches=studies.filter(s=>s.id===plan.datasetId);if(matches.length>1)throw Error('The selected study identity is ambiguous.');const study=matches[0];
 if(!study)return JSON.stringify({reportId:draft.id,plan,source:null});const issue=discoveryStudyIssue(study);if(issue)throw Error(issue);
 const ids=new Set([plan.idFieldId,plan.outcomeFieldId,...plan.dimensionIds]),fields=study.fields.filter(f=>ids.has(f.id));
 const encoder=new TextEncoder();let bytes=encoder.encode(JSON.stringify(fields)).length;
 const rows=study.rows.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw Error('A source row is malformed.');const values=fields.map(f=>value(row,f));bytes+=encoder.encode(JSON.stringify(values)).length+1;if(bytes>maxBytes)throw Error('Selected discovery inputs exceed the 20 MiB limit. Choose a smaller study.');return values;});
 return JSON.stringify({reportId:draft.id,plan,source:{id:study.id,importedAt:study.importedAt,title:study.title,sourceRef:study.sourceRef,rowCount:study.rowCount,fieldCount:study.fieldCount,fields,rows}});
}
function resolve(context:DiscoveryContext,binding:string){
 const {draft,plan}=context;const source=(JSON.parse(binding) as {source:{id:string;importedAt:string;title:string;fields:ImportedDatasetField[];rows:string[][]}|null}).source;
 if(draft.id!==plan.reportId||!source||source.id!==plan.datasetId||source.importedAt!==plan.importedAt||!Number.isFinite(Date.parse(plan.importedAt)))throw Error('The report or study import changed. Reset the discovery plan.');
 if(plan.design!=='independent_unweighted')throw Error('Declare independent unweighted respondents. Weighted, repeated, clustered and unknown designs are unsupported.');
 if(!plan.question.trim()||plan.question.length>300)throw Error('Record a research question of 1–300 characters.');
 const ids=[plan.idFieldId,plan.outcomeFieldId,...plan.dimensionIds];
 if(plan.dimensionIds.length<1||plan.dimensionIds.length>2||new Set(ids).size!==ids.length)throw Error('Choose a distinct ID, outcome and one or two categorical dimensions.');
 const fields=ids.map(id=>source.fields.find(f=>f.id===id));if(fields.some(f=>!f))throw Error('A selected field is missing. Reset the plan.');
 for(const field of fields as ImportedDatasetField[])if(plan.fieldBindings[field.id]!==JSON.stringify(field))throw Error('Selected field metadata changed. Reset and explicitly choose the fields again.');
 const [idField,outcomeField,...dimensions]=fields as ImportedDatasetField[];
 if(![outcomeField,...dimensions].every(f=>['categorical','text'].includes(f.type)||f.modelingRole==='candidate_dimension'))throw Error('Use explicitly categorical single-choice dimensions and outcome; numeric measures are not silently grouped.');
 const rows=source.rows.map(row=>Object.fromEntries(source.fields.map((f,index)=>[f.sourceColumn,row[index]])));
 const fixed={rows} as ImportedDatasetRecord;
 const codes=new Set(discoveryCodes(fixed,outcomeField));
 if(!plan.eventCodes.length||plan.eventCodes.length>100||new Set(plan.eventCodes).size!==plan.eventCodes.length||plan.eventCodes.some(c=>!codes.has(c)))throw Error('Choose 1–100 observed event codes.');
 if(plan.excludedCodes.length>200||new Set(plan.excludedCodes).size!==plan.excludedCodes.length||plan.excludedCodes.some(c=>!codes.has(c)||plan.eventCodes.includes(c)))throw Error('Excluded codes must be observed, distinct and separate from events.');
 return{source,rows,idField,outcomeField,dimensions,dimensionCodes:dimensions.map(f=>discoveryCodes(fixed,f,true))};
}
// Stable, non-cryptographic ordering only. This is not random sampling or a representativeness guarantee.
export function discoveryHash(id:string):number {let hash=2166136261;for(const character of `EcoFocus-discovery-v1:${id}`){hash^=character.codePointAt(0)!;hash=Math.imul(hash,16777619);}return hash>>>0;}
export function discoveryPartitions(ids:string[]):Map<string,'discovery'|'validation'> {
 if(ids.some(id=>!id||id!==id.trim()||id.length>256)||new Set(ids).size!==ids.length)throw Error('Respondent IDs must be nonblank and unique throughout the source, including excluded rows.');
 const ordered=ids.map(id=>({id,hash:discoveryHash(id)})).sort((a,b)=>a.hash-b.hash||compareText(a.id,b.id));
 return new Map(ordered.map((entry,index)=>[entry.id,index<Math.ceil(ids.length/2)?'discovery':'validation']));
}
function blankFold():SegmentFold{return{inside:{events:0,base:0},outside:{events:0,base:0},unknown:0,difference:null};}
function finishFold(fold:SegmentFold){fold.difference=fold.inside.base&&fold.outside.base?100*(fold.inside.events/fold.inside.base-fold.outside.events/fold.outside.base):null;}
function exactDifference(fold:SegmentFold):{n:bigint;d:bigint}|null {
 const {inside:a,outside:b}=fold;
 if(![a.base,b.base,a.events,b.events].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=50000)||!a.base||!b.base||a.events>a.base||b.events>b.base)return null;
 return{n:BigInt(a.events)*BigInt(b.base)-BigInt(b.events)*BigInt(a.base),d:BigInt(a.base)*BigInt(b.base)};
}
const absolute=(n:bigint)=>n<0n?-n:n;
export function assessStability(candidate:Pick<SegmentCandidate,'full'|'discovery'|'validation'>):Pick<SegmentCandidate,'stability'|'warnings'> {
 const {full,discovery,validation}=candidate,warnings:string[]=[];
 const a=exactDifference(discovery),b=exactDifference(validation);
 if(!exactDifference(full)||!a||!b)return{stability:'unavailable',warnings:['A segment or its comparison remainder has no valid outcomes or invalid counts in a required split. No repeatability assessment is available.']};
 if(full.inside.base<30||full.outside.base<30||[discovery,validation].some(f=>f.inside.base<15||f.outside.base<15))return{stability:'small',warnings:['Small sample: require at least 30 valid segment and remainder responses overall and 15 in each split. Do not treat this pattern as reliable.']};
 // Compare count-derived rational effects exactly. Even within the 50k-row
 // bound, denominator cross-products can exceed Number's safe-integer range.
 const repeated=absolute(a.n)*100n>=10n*a.d && a.n*b.n>0n &&
  2n*absolute(b.n)*a.d>=absolute(a.n)*b.d &&
  absolute(a.n*b.d-b.n*a.d)*100n<=15n*a.d*b.d;
 if(!repeated)warnings.push('The discovery pattern did not repeat under the stated descriptive rule. A small or changed difference is not evidence of no population relationship.');
 if(full.unknown)warnings.push(`${full.unknown} valid outcomes had unknown segment membership and were excluded from both segment and remainder bases.`);
 return{stability:repeated?'repeated':'changed',warnings};
}
export async function discoverAudiences(context:DiscoveryContext,options:{signal:AbortSignal;reviewedBinding:string;getCurrentContext?:()=>DiscoveryContext;onProgress?:(done:number,total:number)=>void}):Promise<DiscoveryResult>{
 const binding=discoveryBinding(context);if(binding!==options.reviewedBinding)throw Error('The source or plan changed after review. Review the current inputs again.');
 const fixed=resolve(context,binding),plan=structuredClone(context.plan),ids=fixed.rows.map(row=>value(row,fixed.idField).trim()),partitions=discoveryPartitions(ids);
 const candidates:SegmentCandidate[]=[];
 const add=(selections:{index:number;code:string}[])=>{
  const rules:AudienceExpression[]=selections.map(({index,code})=>({kind:'category',fieldId:fixed.dimensions[index].id,sourceColumn:fixed.dimensions[index].sourceColumn,values:[code],exclude:false}));
  candidates.push({key:JSON.stringify(selections),label:selections.map(({index,code})=>`${fixed.dimensions[index].variableLabel||fixed.dimensions[index].label}: ${discoveryLabel(fixed.dimensions[index],code)} [${code}]`).join(' AND '),expression:rules.length===1?rules[0]:{kind:'group',match:'all',exclude:false,children:rules},full:blankFold(),discovery:blankFold(),validation:blankFold(),stability:'unavailable',warnings:[]});
 };
 fixed.dimensionCodes.forEach((codes,index)=>codes.forEach(code=>add([{index,code}])));
 if(fixed.dimensions.length===2)for(const first of fixed.dimensionCodes[0])for(const second of fixed.dimensionCodes[1])add([{index:0,code:first},{index:1,code:second}]);
 if(!candidates.length)throw Error('Selected dimensions contain no observed categories.');
 const predicates=candidates.map(candidate=>{const rules=candidate.expression.kind==='group'?candidate.expression.children:[candidate.expression];return rules.map(rule=>{if(rule.kind!=='category')throw Error('Unsupported discovery rule.');return{index:fixed.dimensions.findIndex(f=>f.id===rule.fieldId),code:rule.values[0]};});});
 const events=new Set(plan.eventCodes),excluded=new Set(plan.excludedCodes);let missingOutcome=0,excludedOutcome=0,validOutcome=0;
 const abort=()=>{if(options.signal.aborted)throw new DOMException('Discovery canceled. No audiences or source data were changed.','AbortError');};
 for(let start=0;start<fixed.rows.length;start+=250){abort();for(let i=start;i<Math.min(start+250,fixed.rows.length);i++){
  const row=fixed.rows[i],code=value(row,fixed.outcomeField).trim();if(!code){missingOutcome++;continue;}if(excluded.has(code)){excludedOutcome++;continue;}validOutcome++;
  const event=events.has(code),fold=partitions.get(ids[i])!,values=fixed.dimensions.map(f=>audienceCategoryKey(f,value(row,f)));
  for(let j=0;j<candidates.length;j++){
   const answers=predicates[j].map(rule=>!values[rule.index]?null:values[rule.index]===rule.code),member=answers.includes(false)?false:answers.includes(null)?null:true;
   for(const counts of [candidates[j].full,candidates[j][fold]]){if(member===null)counts.unknown++;else{const group=member?counts.inside:counts.outside;group.base++;if(event)group.events++;}}
  }
 }options.onProgress?.(Math.min(start+250,fixed.rows.length),fixed.rows.length);await new Promise<void>(resolve=>setTimeout(resolve,0));}
 abort();if(!validOutcome)throw Error('No valid outcomes remain after missing values and explicit exclusions.');
 for(const candidate of candidates){[candidate.full,candidate.discovery,candidate.validation].forEach(finishFold);Object.assign(candidate,assessStability(candidate));}
 // Ranking uses discovery only. Validation outcomes must never improve a candidate's rank.
 candidates.sort((a,b)=>{
  const eligible=(c:SegmentCandidate)=>c.discovery.inside.base>=15&&c.discovery.outside.base>=15;
  const first=exactDifference(a.discovery)??{n:0n,d:1n},second=exactDifference(b.discovery)??{n:0n,d:1n};
  const delta=absolute(second.n)*first.d-absolute(first.n)*second.d;
  return Number(eligible(b))-Number(eligible(a))||(delta>0n?1:delta<0n?-1:0)||compareText(a.key,b.key);
 });
 if(discoveryBinding(options.getCurrentContext?.()??context)!==binding)throw Error('The source or plan changed while discovery ran. No results were accepted.');
 return{binding,candidates,discoveryRows:Math.ceil(ids.length/2),validationRows:Math.floor(ids.length/2),missingOutcome,excludedOutcome,validOutcome,sourceTitle:fixed.source.title};
}
export function audienceFromDiscovery(context:DiscoveryContext,result:DiscoveryResult,key:string,name:string,id:string):SavedImportedAudience {
 if(discoveryBinding(context)!==result.binding)throw Error('The source or discovery plan changed. Rerun discovery before adding an audience.');
 const candidate=result.candidates.find(c=>c.key===key);if(!candidate||candidate.full.inside.base<1)throw Error('Select a segment with valid respondents.');
 const saved:SavedImportedAudience={version:1,id,label:name.trim(),datasetId:context.plan.datasetId,importedAt:context.plan.importedAt,expression:structuredClone(candidate.expression)};
 assertSavedAudiences([...(context.draft.savedAudiences??[]),saved]);return saved;
}
