import type { DashboardDraft, ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { compileAudience } from "../audiences/audienceModel";

export type ComparabilityDeclaration = "same" | "changed" | "unknown";
export interface WaveSourcePlan { datasetId: string; importedAt: string; fieldId: string; fieldBinding: string; idFieldId: string; idBinding: string; audienceId: string; year: number; population: string; weighting: "unweighted" | "weighted" | "unknown" }
export interface WaveAnswerMapping { id: string; label: string; codes: [string[], string[]] }
export interface WaveReviewPlan { reportId: string; question: string; waves: [WaveSourcePlan, WaveSourcePlan]; mappings: WaveAnswerMapping[]; exclusions: [string[], string[]]; declarations: { question: ComparabilityDeclaration; population: ComparabilityDeclaration; weighting: ComparabilityDeclaration; sampling: ComparabilityDeclaration }; methodology: string }
export interface WaveReviewContext { draft: DashboardDraft; studies: ImportedDatasetRecord[]; plan: WaveReviewPlan }
type ResolvedWave = { dataset: ImportedDatasetRecord; field: ImportedDatasetField; idField: ImportedDatasetField; membership: (row: Record<string,string>) => boolean | null; audienceLabel: string; choices: string[]; referencedFields: ImportedDatasetField[] };
type ProjectedRow = { id: string; raw: string; member: boolean | null };
export interface WaveCoverage { rows: number; audience: number; outsideAudience: number; unknownAudience: number; missing: number; excludedCodes: number; base: number; counts: number[] }
export interface WaveReviewResult { binding: string; sourceLabels: [string,string]; questionLabels: [string,string]; coverage: [WaveCoverage,WaveCoverage]; percentages: [Array<number|null>,Array<number|null>]; differences: Array<number|null>; flags: string[]; changesAllowed: boolean; sourceStillCurrent: () => boolean }

export function waveStudyIssue(dataset: ImportedDatasetRecord | undefined): string | null {
  if (!dataset) return "Choose a complete original local study for each year.";
  if (dataset.remote || dataset.sourceType !== "local_file" || dataset.preparation) return "Year comparison currently supports original local-file imports. Remote and prepared copies are not silently substituted.";
  if (dataset.rows.length !== dataset.rowCount || dataset.fields.length !== dataset.fieldCount || !Number.isSafeInteger(dataset.rowCount) || dataset.rowCount < 1 || dataset.rowCount > 50000) return "Each year requires all source rows and fields, with 1–50,000 rows.";
  if (new Set(dataset.fields.map(field=>field.id)).size !== dataset.fields.length || new Set(dataset.fields.map(field=>field.sourceColumn)).size !== dataset.fields.length) return "Ambiguous field identities prevent a safe year comparison.";
  return null;
}
export function waveCodeChoices(dataset: ImportedDatasetRecord, field: ImportedDatasetField): string[] {
  const choices = new Set<string>();
  for (const raw of [...Object.keys(field.valueLabels??{}), ...dataset.rows.map(row=>Object.hasOwn(row,field.sourceColumn)?row[field.sourceColumn]:"")]) {
    if (typeof raw !== "string" || raw.length > 128) throw Error("Answer codes must be text of at most 128 characters; source data was not changed.");
    if (raw.trim()) choices.add(raw.trim());
    if (choices.size > 200) throw Error("Choose a categorical question with at most 200 declared or observed nonblank codes.");
  }
  return [...choices].sort((a,b)=>a.localeCompare(b));
}
export function waveCodeLabel(field: ImportedDatasetField, code: string): string { return field.valueLabels && Object.hasOwn(field.valueLabels,code) ? field.valueLabels[code] : code; }

export function resolveWaveReview({draft,studies,plan}:WaveReviewContext): { waves: [ResolvedWave,ResolvedWave]; binding: string } {
  if (plan.reportId !== draft.id) throw Error("The report changed. Review this comparison in the current report.");
  if (!plan.question.trim() || plan.question.length > 300) throw Error("Name the common research question using 1–300 characters.");
  if (plan.waves.length!==2 || plan.waves[0].datasetId===plan.waves[1].datasetId) throw Error("Choose two different original study imports; one study cannot compare with itself.");
  if (!plan.waves.every(wave=>Number.isInteger(wave.year)&&wave.year>=1900&&wave.year<=9999) || plan.waves[0].year>=plan.waves[1].year) throw Error("Enter two different years in chronological order (1900–9999).");
  if (Object.values(plan.declarations).length!==4 || !["question","population","weighting","sampling"].every(key=>["same","changed","unknown"].includes(plan.declarations[key as keyof typeof plan.declarations]))) throw Error("Record each comparability declaration explicitly.");
  if (!plan.methodology.trim() || plan.methodology.length>2000) throw Error("Record a methodology/source note (1–2,000 characters). The app does not independently verify study instruments.");
  const waves=plan.waves.map(wave=>{
    const matches=studies.filter(study=>study.id===wave.datasetId); if(matches.length!==1)throw Error("Choose unambiguous study identities for each year.");const dataset=matches[0],issue=waveStudyIssue(dataset);if(issue)throw Error(issue);
    if(!wave.importedAt||wave.importedAt!==dataset.importedAt||!Number.isFinite(Date.parse(wave.importedAt)))throw Error("A study import was replaced. Explicitly reset its question and code mappings.");
    if(!wave.population.trim()||wave.population.length>300||!["unweighted","weighted","unknown"].includes(wave.weighting))throw Error("Describe each target population and record its weighting context.");
    const field=dataset.fields.find(item=>item.id===wave.fieldId),idField=dataset.fields.find(item=>item.id===wave.idFieldId);
    if(!field||!idField||field.id===idField.id||!field.sourceColumn||!idField.sourceColumn)throw Error("Choose separate available question and respondent-ID fields for each year.");
    if(JSON.stringify(field)!==wave.fieldBinding||JSON.stringify(idField)!==wave.idBinding)throw Error("Question or respondent-ID metadata changed. Reset its fields and review the code mappings; saved identities were not silently rebound.");
    if(!["text","categorical"].includes(field.type)&&field.modelingRole!=="candidate_dimension")throw Error("Model coded answers as categorical before comparing; numeric measurements are not silently treated as response categories.");
    const audiences=(draft.savedAudiences??[]).filter(audience=>audience.id===wave.audienceId);if(wave.audienceId&&audiences.length!==1)throw Error("A selected population audience is missing or ambiguous.");
    const audience=wave.audienceId?audiences[0]:undefined;
    const referenced=new Set([field.id,idField.id]);
    function visit(expression:NonNullable<typeof audience>['expression']){if(expression.kind==='group')expression.children.forEach(visit);else referenced.add(expression.fieldId);}
    if(audience)visit(audience.expression);
    return {dataset,field,idField,membership:audience?compileAudience(audience,dataset):()=>true,audienceLabel:audience?.label??"All respondents",choices:waveCodeChoices(dataset,field),referencedFields:dataset.fields.filter(item=>referenced.has(item.id))};
  }) as [ResolvedWave,ResolvedWave];
  if(plan.mappings.length<1||plan.mappings.length>30||new Set(plan.mappings.map(mapping=>mapping.id)).size!==plan.mappings.length||new Set(plan.mappings.map(mapping=>mapping.label.trim().toLocaleLowerCase())).size!==plan.mappings.length)throw Error("Create 1–30 uniquely named common answer categories.");
  plan.mappings.forEach(mapping=>{if(!mapping.id||!mapping.label.trim()||mapping.label.length>160||mapping.codes.length!==2)throw Error("Give each common category a unique identity, name and both-year code mappings.");});
  for(let w=0;w<2;w++){
    const seen=new Set<string>(),available=new Set(waves[w].choices);
    for(const mapping of plan.mappings){if(mapping.codes[w].length<1||mapping.codes[w].length>100)throw Error("Each common category needs at least one explicit raw code in both years; an absent option is not assumed to mean zero.");for(const code of mapping.codes[w]){if(typeof code!=="string"||!available.has(code)||seen.has(code))throw Error("Every mapped raw code must be available and assigned to only one category in its year.");seen.add(code);}}
    if(plan.exclusions[w].length>200)throw Error("Too many excluded answer codes.");for(const code of plan.exclusions[w]){if(!available.has(code)||seen.has(code))throw Error("Excluded codes must be available and cannot overlap any mapping or exclusion.");seen.add(code);}
    // Zero-frequency metadata options may remain unmapped. Every observed code
    // must be explicitly mapped or excluded when actual rows are counted below.
  }
  const binding=JSON.stringify({plan,studies:waves.map(wave=>({id:wave.dataset.id,importedAt:wave.dataset.importedAt,title:wave.dataset.title,rows:wave.dataset.rowCount,fieldCount:wave.dataset.fieldCount,fields:wave.referencedFields,sourceRef:wave.dataset.sourceRef})),audiences:(draft.savedAudiences??[]).filter(audience=>plan.waves.some(wave=>wave.audienceId===audience.id))});
  return {waves,binding};
}
function project(wave:ResolvedWave,index:number):ProjectedRow{
  const row=wave.dataset.rows[index];if(!row||typeof row!=="object"||Array.isArray(row))throw Error("A source row is malformed; comparison was not accepted.");
  const id=Object.hasOwn(row,wave.idField.sourceColumn)?row[wave.idField.sourceColumn]:"",raw=Object.hasOwn(row,wave.field.sourceColumn)?row[wave.field.sourceColumn]:"";
  if(typeof id!=="string"||id.length>256||typeof raw!=="string"||raw.length>128)throw Error("Respondent IDs support up to 256 text characters and raw answers up to 128.");
  return {id,raw,member:wave.membership(row)};
}
export function runWaveReview(input:WaveReviewContext, options:{signal:AbortSignal;getCurrentContext?:()=>WaveReviewContext;onProgress?:(done:number,total:number)=>void}):Promise<WaveReviewResult>{
 return new Promise((resolve,reject)=>{
  let resolved:ReturnType<typeof resolveWaveReview>;try{resolved=resolveWaveReview(input);}catch(error){reject(error);return;}
  const {waves,binding}=resolved,plan=structuredClone(input.plan),projections:[ProjectedRow[],ProjectedRow[]]=[[],[]],ids=[new Set<string>(),new Set<string>()];
  const coverage=waves.map(wave=>({rows:wave.dataset.rowCount,audience:0,outsideAudience:0,unknownAudience:0,missing:0,excludedCodes:0,base:0,counts:plan.mappings.map(()=>0)})) as [WaveCoverage,WaveCoverage];
  const mapped=[new Map<string,number>(),new Map<string,number>()];plan.mappings.forEach((mapping,index)=>mapping.codes.forEach((codes,w)=>codes.forEach(code=>mapped[w].set(code,index))));const excluded=plan.exclusions.map(codes=>new Set(codes));
  let timer:ReturnType<typeof setTimeout>|undefined,finished=false,w=0;
  const sourceStillCurrent=()=>{try{const latest=resolveWaveReview(options.getCurrentContext?.()??input);if(latest.binding!==binding)return false;for(let j=0;j<2;j++){if(latest.waves[j].dataset.rows.length!==projections[j].length)return false;for(let i=0;i<projections[j].length;i++){const a=project(latest.waves[j],i),b=projections[j][i];if(a.id!==b.id||a.raw!==b.raw||a.member!==b.member)return false;}}return true;}catch{return false;}};
  function finish(error?:unknown,result?:WaveReviewResult){if(finished)return;finished=true;if(timer!==undefined)clearTimeout(timer);options.signal.removeEventListener('abort',abort);if(error)reject(error);else resolve(result!);}
  function abort(){finish(new DOMException("Year comparison canceled. Studies and reports are preserved.","AbortError"));}if(options.signal.aborted){abort();return;}options.signal.addEventListener('abort',abort,{once:true});
  function batch(){if(finished)return;try{
    const wave=waves[w],stats=coverage[w],end=Math.min(wave.dataset.rows.length,projections[w].length+500);
    for(let i=projections[w].length;i<end;i++){const row=project(wave,i);projections[w].push(row);const id=row.id.trim();if(!id||ids[w].has(id))throw Error(`Respondent IDs must be nonblank and unique across the complete ${plan.waves[w].year} study (source row ${i+1}). Repeated records are not silently deduplicated.`);ids[w].add(id);if(row.member!==true){if(row.member===null)stats.unknownAudience++;else stats.outsideAudience++;continue;}stats.audience++;const code=row.raw.trim();if(!code){stats.missing++;continue;}const category=mapped[w].get(code);if(category!==undefined){stats.counts[category]++;stats.base++;}else if(excluded[w].has(code))stats.excludedCodes++;else throw Error(`Year ${plan.waves[w].year} has observed answer ${JSON.stringify(code)} that is neither mapped nor explicitly excluded. Complete the code mapping; no result was accepted.`);}
    options.onProgress?.(projections[0].length+projections[1].length,coverage[0].rows+coverage[1].rows);if(finished)return;
    if(projections[w].length<wave.dataset.rows.length){timer=setTimeout(batch,0);return;}if(w===0){w=1;timer=setTimeout(batch,0);return;}
    if(!sourceStillCurrent())throw Error("A study, field mapping, population audience or review choice changed during comparison. Review and run again.");
    const flags:string[]=[];const names={question:'Question meaning',population:'Target population',weighting:'Weighting approach',sampling:'Sampling/collection method'};for(const key of Object.keys(names) as Array<keyof typeof names>)if(plan.declarations[key]!=='same')flags.push(`${names[key]} ${plan.declarations[key]==='changed'?'changed: comparability break':'is unknown: comparability unverified'}.`);
    if(plan.waves.some(wave=>wave.weighting!=='unweighted'))flags.push('Weighting is weighted or unknown. These are raw unweighted descriptions; no weighted comparison is calculated.');
    coverage.forEach((stats,index)=>{if(!stats.base)flags.push(`Year ${plan.waves[index].year} has no mapped valid respondents.`);if(stats.base<30)flags.push(`Year ${plan.waves[index].year} has fewer than 30 mapped respondents; sample size alone does not establish reliability.`);if(stats.excludedCodes)flags.push(`Year ${plan.waves[index].year}: ${stats.excludedCodes} respondents with explicitly excluded codes are outside its reported response base.`);});
    const changesAllowed=Object.values(plan.declarations).every(value=>value==='same')&&plan.waves.every(wave=>wave.weighting==='unweighted')&&coverage.every(stats=>stats.base>0),percentages=coverage.map(stats=>stats.counts.map(count=>stats.base?count/stats.base*100:null)) as WaveReviewResult['percentages'];
    finish(undefined,{binding,sourceLabels:[waves[0].dataset.title,waves[1].dataset.title],questionLabels:[waves[0].field.variableLabel??waves[0].field.label,waves[1].field.variableLabel??waves[1].field.label],coverage,percentages,differences:plan.mappings.map((_,i)=>changesAllowed?percentages[1][i]!-percentages[0][i]!:null),flags,changesAllowed,sourceStillCurrent});
   }catch(error){finish(error instanceof Error?error:Error('Year comparison failed; source data is preserved.'));}}
  timer=setTimeout(batch,0);
 });
}
