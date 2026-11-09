import type { DashboardDraft, ImportedDatasetRecord } from '../../../shared/types/dashboard';
import { comparisonContextBinding, runComparisonReview, type ComparisonReviewContext, type ComparisonReviewPlan, type ComparisonReviewResult } from './comparisonReviewModel';
import { buildRankedFindings, type RankedFinding } from './rankedFindingsModel';
import { holmLogPValues, thresholdDecision } from './exactComparisonMath';

export const reportInsightLimits = { families: 5, comparisons: 20, planBytes: 2 * 1024 * 1024, sourceBytes: 20 * 1024 * 1024 } as const;
import type {ReviewedInsightPlan} from '../../../shared/types/reportInsights';
export type {ReviewedInsightPlan} from '../../../shared/types/reportInsights';
export interface ReportInsightContext { draft: DashboardDraft; studies: ImportedDatasetRecord[] }
export interface ReportInsightFinding extends RankedFinding { familyId: string; question: string; study: string; datasetId: string; importedAt: string; outcome: string; audience: string; rawLogP: number; originalAdjustedLogP: number; originalAlpha: number; methodology: string }
export interface ReportInsightRun { families: Array<{ entry: ReviewedInsightPlan; result: ComparisonReviewResult }>; familySize: number; sourceStillCurrent: () => boolean }
export interface ReportInsightDisplay { minimumDifference: number; minimumBase: number; priorityFamilies: string[]; alpha: number }
const acceptedRuns = new WeakMap<ReportInsightRun, () => boolean>();
const planKeys = ['reportId','datasetId','importedAt','idFieldId','idBinding','groupFieldId','groupBinding','outcomeFieldId','outcomeBinding','audienceId','reference','targets','eventCodes','excludedCodes','alpha','design','question','methodology'];
const resultKeys = ['coverage','groups','comparisons','familySize','binding','sourceStillCurrent','audienceLabel','sourceTitle','outcomeLabel','groupLabel'];
function dataRecord(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype=Object.getPrototypeOf(value); if (prototype!==Object.prototype && prototype!==null) return false;
    if(Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length!==keys.length)return false;
    return keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return !!d?.enumerable && Object.hasOwn(d,'value');});
  } catch { return false; }
}
// Walk only the bounded, trusted snapshot shape. Never stringify a mutated
// result: a sparse/enlarged array or extra huge property must fail cheaply.
function sameSnapshot(actual: unknown, expected: unknown): boolean {
  if (!expected || typeof expected!=='object') return actual===expected;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length!==expected.length || !dense(actual)) return false;
    for(let i=0;i<expected.length;i++){const d=Object.getOwnPropertyDescriptor(actual,String(i));if(!d||!Object.hasOwn(d,'value')||!sameSnapshot(d.value,expected[i]))return false;}
    return true;
  }
  const keys=Object.keys(expected);if(!dataRecord(actual,keys))return false;
  return keys.every(key=>sameSnapshot(Object.getOwnPropertyDescriptor(actual,key)!.value,(expected as Record<string,unknown>)[key]));
}

function dense(value: unknown): boolean {
  if (!Array.isArray(value) || Object.getPrototypeOf(value)!==Array.prototype || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i++) { const d=Object.getOwnPropertyDescriptor(value,String(i)); if (!d || !Object.hasOwn(d,'value')) return false; }
  return true;
}
const encoder = new TextEncoder();
function abort(signal: AbortSignal) { if (signal.aborted) throw new DOMException('Report insight review canceled. Source data and reports were not changed.', 'AbortError'); }
async function digest(value: string) {
  if (!globalThis.crypto?.subtle) throw Error('Source verification is unavailable in this browser. Reviewed plans were not added or run.');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function codes(value: unknown, minimum: number, maximum: number) {
  return Array.isArray(value) && value.length >= minimum && value.length <= maximum && dense(value) && value.every(code => typeof code === 'string' && code.length <= 128 && !!code.trim()) && new Set(value).size === value.length;
}
function planIssue(plan: ComparisonReviewPlan, reportId: string): string | null {
  if (!dataRecord(plan,planKeys) || typeof plan.reportId!=='string' || plan.reportId.length>512 || plan.reportId !== reportId || plan.design !== 'unweighted_independent') return 'Use reviewed unweighted independent plans from this report.';
  for (const key of ['datasetId','importedAt','idFieldId','idBinding','groupFieldId','groupBinding','outcomeFieldId','outcomeBinding','reference','question','methodology'] as const)
    if (typeof plan[key] !== 'string' || plan[key].length > (key.endsWith('Binding') ? 200000 : key === 'methodology' ? 2000 : key === 'question' ? 300 : 512) || !plan[key].trim()) return 'A reviewed plan has missing or oversized context. Review it again.';
  if (typeof plan.audienceId !== 'string' || plan.audienceId.length>512 || !codes(plan.targets,1,20) || !codes(plan.eventCodes,1,100) || !codes(plan.excludedCodes,0,200) || plan.targets.includes(plan.reference) || plan.excludedCodes.some(code => plan.eventCodes.includes(code))) return 'Reviewed group, event or exclusion codes are invalid.';
  try { thresholdDecision(null,plan.alpha); } catch { return 'A reviewed plan has invalid alpha.'; }
  return null;
}
function definition(plan: ComparisonReviewPlan) {
  return JSON.stringify([plan.reportId,plan.datasetId,plan.importedAt,plan.idFieldId,plan.groupFieldId,plan.outcomeFieldId,plan.audienceId,plan.reference,[...plan.targets].sort(),[...plan.eventCodes].sort(),[...plan.excludedCodes].sort(),plan.design]);
}
function hypothesis(plan: ComparisonReviewPlan, target: string) {
  return JSON.stringify([plan.datasetId,plan.importedAt,plan.idFieldId,plan.groupFieldId,plan.outcomeFieldId,plan.audienceId,[plan.reference,target].sort(),[...plan.eventCodes].sort(),[...plan.excludedCodes].sort(),plan.design]);
}
export function reportInsightQueueIssue(entries: readonly ReviewedInsightPlan[], reportId: string): string | null {
  if (!Array.isArray(entries) || entries.length > reportInsightLimits.families || !dense(entries)) return 'Keep at most five complete reviewed families in this report feed.';
  const ids = new Set<string>(), definitions = new Set<string>(), hypotheses = new Set<string>();
  let comparisons = 0;
  for (const entry of entries) {
    if (!dataRecord(entry,['version','id','sourceDigest','plan']) || entry.version !== 1 || typeof entry.id !== 'string' || !/^[a-f0-9]{64}$/.test(entry.id) || typeof entry.sourceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sourceDigest)) return 'A queued review has invalid source-verification metadata.';
    const issue = planIssue(entry.plan,reportId); if (issue) return issue;
    const key = definition(entry.plan);
    if (ids.has(entry.id) || definitions.has(key)) return 'The same reviewed family is queued more than once.';
    ids.add(entry.id); definitions.add(key); comparisons += entry.plan.targets.length;
    for (const target of entry.plan.targets) { const test = hypothesis(entry.plan,target); if (hypotheses.has(test)) return 'Queued families share a comparison. Keep one complete family or revise the plans; overlapping comparisons are not silently dropped.'; hypotheses.add(test); }
  }
  if (comparisons > reportInsightLimits.comparisons) return 'The complete report feed supports at most 20 comparisons, including empty or invariant groups.';
  if (encoder.encode(JSON.stringify(entries)).length > reportInsightLimits.planBytes) return 'Reviewed plan metadata exceeds the 2 MiB temporary queue limit.';
  return null;
}
export function addReportInsightPlan(entries: readonly ReviewedInsightPlan[], entry: ReviewedInsightPlan, reportId: string): ReviewedInsightPlan[] {
  const currentIssue = reportInsightQueueIssue(entries,reportId); if (currentIssue) throw Error(currentIssue);
  const singleIssue = reportInsightQueueIssue([entry],reportId); if (singleIssue) throw Error(singleIssue);
  const prior = entries.find(old => old.id === entry.id);
  if (prior && definition(prior.plan) !== definition(entry.plan)) throw Error('A different reviewed family cannot replace this queue entry.');
  const next = prior ? entries.map(old => old.id === entry.id ? structuredClone(entry) : old) : [...entries,structuredClone(entry)];
  const issue = reportInsightQueueIssue(next,reportId); if (issue) throw Error(issue);
  return next;
}
export async function captureReportInsightPlan(context: ComparisonReviewContext, result: ComparisonReviewResult, options: { signal: AbortSignal; getCurrentContext?: () => ComparisonReviewContext }): Promise<ReviewedInsightPlan> {
  abort(options.signal);
  const issue = planIssue(context.plan,context.draft.id); if (issue) throw Error(issue);
  const plan = structuredClone(context.plan);
  const fixed = { ...context, plan }, binding = comparisonContextBinding(fixed);
  if (encoder.encode(binding).length > reportInsightLimits.sourceBytes) throw Error('The reviewed source exceeds the report feed verification limit.');
  if (result.binding !== binding || !result.sourceStillCurrent()) throw Error('The source or plan changed. Run and review the current comparisons before adding them.');
  buildRankedFindings(result,{minimumDifference:0,minimumBase:1,priorityCodes:[],alpha:plan.alpha});
  const sourceDigest = await digest(binding), id = await digest(definition(plan)); abort(options.signal);
  if (comparisonContextBinding(options.getCurrentContext?.() ?? fixed) !== binding || !result.sourceStillCurrent()) throw Error('The source changed while adding the review. No plan was queued.');
  return { version:1,id,sourceDigest,plan };
}

// The queue holds plans and source digests, never cached probabilities or raw
// respondent rows. Run every complete family again before adjusting the union.
export async function runReportInsightReview(context: ReportInsightContext, entries: readonly ReviewedInsightPlan[], options: { signal: AbortSignal; getCurrentContext?: () => ReportInsightContext; onProgress?: (text: string) => void }): Promise<ReportInsightRun> {
  abort(options.signal); const issue = reportInsightQueueIssue(entries,context.draft.id); if (issue) throw Error(issue);
  if (!entries.length) throw Error('Add at least one explicitly reviewed comparison family.');
  const fixedEntries = structuredClone(entries), families: ReportInsightRun['families'] = []; let bytes = 0;
  for (let i = 0; i < fixedEntries.length; i++) {
    abort(options.signal); const entry = fixedEntries[i], current = () => ({ ...(options.getCurrentContext?.() ?? context), plan: entry.plan });
    const input = current(), binding = comparisonContextBinding(input); bytes += encoder.encode(binding).length;
    if (bytes > reportInsightLimits.sourceBytes) throw Error('The combined selected source bindings exceed 20 MiB. Use fewer complete families.');
    if (await digest(definition(entry.plan)) !== entry.id || await digest(binding) !== entry.sourceDigest) throw Error('A queued source, audience, import or plan changed. Remove it and explicitly review the current inputs again.');
    abort(options.signal); options.onProgress?.(`Reviewing family ${i+1} of ${fixedEntries.length}: ${entry.plan.question}`);
    const result = await runComparisonReview(input,{signal:options.signal,reviewedBinding:binding,getCurrentContext:current,onProgress:(stage)=>options.onProgress?.(`Family ${i+1}/${fixedEntries.length}: ${stage}`)});
    buildRankedFindings(result,{minimumDifference:0,minimumBase:1,priorityCodes:[],alpha:entry.plan.alpha});
    families.push({entry,result});
  }
  const bindings = families.map(f => f.result.binding), currentChecks = families.map(f => f.result.sourceStillCurrent);
  const snapshots = () => families.map(f => ({entry:f.entry,counts:{coverage:f.result.coverage,groups:f.result.groups,comparisons:f.result.comparisons,familySize:f.result.familySize,audienceLabel:f.result.audienceLabel,sourceTitle:f.result.sourceTitle,outcomeLabel:f.result.outcomeLabel,groupLabel:f.result.groupLabel}}));
  const expected = structuredClone(snapshots()), familySize = fixedEntries.reduce((n,e)=>n+e.plan.targets.length,0), familyCount=families.length;
  const output: ReportInsightRun = {families,familySize,sourceStillCurrent:()=>false};
  const sourceStillCurrent = () => { try { return output.families === families && output.familySize === familySize && families.length===familyCount && dense(families) && families.every(f=>dataRecord(f,['entry','result'])&&dataRecord(f.result,resultKeys)) && sameSnapshot(snapshots(),expected) && families.every((family,i) => family.result.binding === bindings[i] && family.result.sourceStillCurrent === currentChecks[i] && currentChecks[i]()); } catch { return false; } };
  abort(options.signal); if (!sourceStillCurrent()) throw Error('The source changed during report review. No feed was accepted.');
  output.sourceStillCurrent = sourceStillCurrent; acceptedRuns.set(output,sourceStillCurrent);
  return output;
}

export function rankReportInsights(run: ReportInsightRun, options: ReportInsightDisplay) {
  const current = acceptedRuns.get(run);
  if (!current || !current()) throw Error('The report feed is stale or its reviewed counts changed. Review the current sources again.');
  if (!dense(run.families) || !run.families.length || run.families.length > 5) throw Error('The report comparison family is incomplete.');
  const entries = run.families.map(f => f.entry), issue = reportInsightQueueIssue(entries,entries[0].plan.reportId); if (issue) throw Error(issue);
  validateReportInsightDisplay(options,entries.map(e=>e.id));
  const all: Array<{finding:ReportInsightFinding|null; log:number; order:number}> = [];
  for (const {entry,result} of run.families) {
    if (result.familySize !== entry.plan.targets.length) throw Error('The reviewed family no longer matches its queued plan.');
    assertQueuedResultPlan(result,entry);
    const feed = buildRankedFindings(result,{minimumDifference:0,minimumBase:1,priorityCodes:[],alpha:entry.plan.alpha});
    for (const c of result.comparisons) {
      const f = feed.ranked.find(f=>f.code===c.code);
      all.push({log:c.rawLogP??0,order:all.length,finding:f?{...f,familyId:entry.id,question:entry.plan.question,study:result.sourceTitle,datasetId:entry.plan.datasetId,importedAt:entry.plan.importedAt,outcome:result.outcomeLabel,audience:result.audienceLabel,methodology:entry.plan.methodology,rawLogP:c.rawLogP!,originalAdjustedLogP:c.adjustedLogP!,originalAlpha:entry.plan.alpha,priority:options.priorityFamilies.includes(entry.id)}:null});
    }
  }
  if (all.length !== run.familySize) throw Error('The full report comparison count changed.');
  const adjusted = holmLogPValues(all.map(item=>item.log)), omitted: Array<{familyId:string;code:string;reason:string}> = [], ranked: Array<{finding:ReportInsightFinding;order:number}> = [];
  all.forEach((item,index)=>{
    if (!item.finding) return;
    const f={...item.finding,adjustedLogP:adjusted[index],decision:thresholdDecision(adjusted[index],options.alpha)};
    const numerator=BigInt(f.event)*BigInt(f.referenceBase)-BigInt(f.referenceEvent)*BigInt(f.base), denominator=BigInt(f.base)*BigInt(f.referenceBase);
    if ((numerator<0n?-numerator:numerator)*100n < BigInt(options.minimumDifference)*denominator) omitted.push({familyId:f.familyId,code:f.code,reason:'Below the minimum absolute difference.'});
    else if (Math.min(f.base,f.referenceBase)<options.minimumBase) omitted.push({familyId:f.familyId,code:f.code,reason:'Below the minimum valid base.'});
    else ranked.push({finding:f,order:item.order});
  });
  const tier=(f:ReportInsightFinding)=>f.decision==='below'?0:f.decision==='boundary'?1:2;
  const magnitude=(f:ReportInsightFinding)=>{const n=BigInt(f.event)*BigInt(f.referenceBase)-BigInt(f.referenceEvent)*BigInt(f.base);return{n:n<0n?-n:n,d:BigInt(f.base)*BigInt(f.referenceBase)};};
  ranked.sort((a,b)=>{const x=a.finding,y=b.finding,t=tier(x)-tier(y);if(t)return t;if(x.priority!==y.priority)return x.priority?-1:1;const l=magnitude(x),r=magnitude(y),gap=l.n*r.d-r.n*l.d;if(gap)return gap>0n?-1:1;const base=Math.min(y.base,y.referenceBase)-Math.min(x.base,x.referenceBase);if(base)return base;
    const missing=BigInt(x.missing+x.excluded+x.referenceMissing+x.referenceExcluded)*BigInt(y.sourceRows+y.referenceBase+y.referenceMissing+y.referenceExcluded)-BigInt(y.missing+y.excluded+y.referenceMissing+y.referenceExcluded)*BigInt(x.sourceRows+x.referenceBase+x.referenceMissing+x.referenceExcluded);return missing?missing<0n?-1:1:a.order-b.order;});
  return {ranked:ranked.map(r=>r.finding),omitted,familySize:all.length,uninterpreted:all.filter(item=>!item.finding).length};
}

// Verify the captured plan without reading mutable component state. Source
// currentness is checked separately against live report context before use.
function assertQueuedResultPlan(result: ComparisonReviewResult, entry: ReviewedInsightPlan): void {
  const parsed=JSON.parse(result.binding) as {plan?:ComparisonReviewPlan};
  if (JSON.stringify(parsed.plan)!==JSON.stringify(entry.plan)) throw Error('The reviewed plan changed.');
}

export function validateReportInsightDisplay(options: ReportInsightDisplay, familyIds: readonly string[]) {
  thresholdDecision(null,options.alpha);
  if (!Number.isInteger(options.minimumDifference) || options.minimumDifference < 0 || options.minimumDifference > 100 || !Number.isInteger(options.minimumBase) || options.minimumBase < 1 || options.minimumBase > 50000) throw Error('Use a whole-number difference from 0–100 and valid base from 1–50,000.');
  const ids = new Set(familyIds);
  if (!Array.isArray(options.priorityFamilies) || options.priorityFamilies.length>5 || !dense(options.priorityFamilies) || new Set(options.priorityFamilies).size !== options.priorityFamilies.length || options.priorityFamilies.some(id=>!ids.has(id))) throw Error('Choose research priorities from this report feed.');
}
