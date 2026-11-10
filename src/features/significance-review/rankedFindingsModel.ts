import { holmLogPValues, thresholdDecision } from './exactComparisonMath';
import type { ComparisonReviewResult, ReviewedComparison } from './comparisonReviewModel';

export interface FindingDisplayOptions { minimumDifference: number; minimumBase: number; priorityCodes: string[]; alpha: number }
export interface RankedFinding {
  code: string; label: string; referenceLabel: string; referenceCode: string;
  event: number; base: number; referenceEvent: number; referenceBase: number;
  missing: number; excluded: number; sourceRows: number; priority: boolean;
  referenceMissing: number; referenceExcluded: number;
  difference: number; adjustedLogP: number; decision: ReviewedComparison['decision']; cautions: string[];
}
export interface FindingFeed { ranked: RankedFinding[]; omitted: Array<{code:string;label:string;reason:string}>; familySize: number }
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 50_000;
const abs = (value: bigint) => value < 0n ? -value : value;
// Array iteration skips holes, including before Holm adjustment. Require own
// positions first. Property count refuses huge sparse arrays without scanning
// their claimed length; extra properties cannot substitute for missing slots.
function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getOwnPropertyNames(value).length - 1 < value.length) return false;
  for (let index = 0; index < value.length; index++) if (!Object.prototype.hasOwnProperty.call(value,index)) return false;
  return true;
}

/** Exploratory display ordering only. Never changes/retests the selected family. */
export function buildRankedFindings(result: ComparisonReviewResult, options: FindingDisplayOptions): FindingFeed {
  if (!Number.isInteger(options.minimumDifference) || options.minimumDifference < 0 || options.minimumDifference > 100) throw Error('Enter a whole-number minimum difference from 0 to 100 percentage points.');
  if (!Number.isInteger(options.minimumBase) || options.minimumBase < 1 || options.minimumBase > 50_000) throw Error('Enter a whole-number minimum valid base from 1 to 50,000.');
  thresholdDecision(null, options.alpha);
  if (!denseArray(result.groups) || !denseArray(result.comparisons) || result.familySize < 1 || result.familySize > 20 ||
      result.comparisons.length !== result.familySize || result.groups.length !== result.familySize + 1 ||
      new Set(result.groups.map(group => group.code)).size !== result.groups.length) throw Error('The reviewed comparison family is incomplete. Run the review again.');
  const codes = new Set(result.comparisons.map(comparison => comparison.code));
  if (!denseArray(options.priorityCodes) || new Set(options.priorityCodes).size !== options.priorityCodes.length || options.priorityCodes.some(code => !codes.has(code))) throw Error('Research priorities must belong to this reviewed comparison family.');
  for (const group of result.groups) {
    if (typeof group.code !== 'string' || typeof group.label !== 'string' ||
        ![group.rows,group.base,group.event,group.nonEvent,group.missingOutcome,group.excludedOutcome].every(count) ||
        group.event + group.nonEvent !== group.base || group.base + group.missingOutcome + group.excludedOutcome !== group.rows) throw Error('Reviewed respondent counts are inconsistent. Run the review again.');
  }
  const reference = result.groups[0];
  if (!reference.base || result.groups.reduce((sum, group) => sum + group.rows, 0) > 50_000) throw Error('Reviewed respondent bases are unsupported.');
  const rawFamily = result.comparisons.map((comparison, index) => {
    if (!denseArray(comparison.warnings) || comparison.warnings.some(warning => typeof warning !== 'string')) throw Error('Reviewed cautions are incomplete. Run the review again.');
    const group = result.groups[index + 1];
    const expected = [group.event, group.nonEvent, reference.event, reference.nonEvent];
    if (comparison.code !== group.code || comparison.label !== group.label || !denseArray(comparison.table) || comparison.table.length !== 4 || comparison.table.some((value,i) => value !== expected[i])) throw Error('The reviewed counts no longer match their groups. Run the review again.');
    const status = !group.base ? 'no_data' : !group.event && !reference.event || !group.nonEvent && !reference.nonEvent ? 'no_variation' : 'tested';
    if (comparison.status !== status) throw Error('The reviewed comparison status is inconsistent.');
    if (status !== 'tested') {
      if (comparison.rawLogP !== null || comparison.adjustedLogP !== null || comparison.decision !== 'unavailable') throw Error('An uninterpreted comparison cannot receive an evidence rank.');
      return 0;
    }
    if (comparison.rawLogP === null || !Number.isFinite(comparison.rawLogP) || comparison.rawLogP > 0) throw Error('Reviewed probability is unavailable.');
    return comparison.rawLogP;
  });
  const adjusted = holmLogPValues(rawFamily);
  const priority = new Set(options.priorityCodes), omitted: FindingFeed['omitted'] = [];
  const candidates: Array<{ finding: RankedFinding; numerator: bigint; denominator: bigint; index: number }> = [];
  result.comparisons.forEach((comparison,index) => {
    const group = result.groups[index + 1];
    if (comparison.status !== 'tested') {
      omitted.push({code:group.code,label:group.label,reason:comparison.status === 'no_data' ? 'No valid outcomes; no interpreted comparison.' : 'No outcome variation; no interpreted test.'}); return;
    }
    if (comparison.adjustedLogP !== adjusted[index] || comparison.decision !== thresholdDecision(adjusted[index],options.alpha)) throw Error('The displayed adjustment or threshold differs from the reviewed family. Run the review again.');
    const numerator = BigInt(group.event) * BigInt(reference.base) - BigInt(reference.event) * BigInt(group.base);
    const denominator = BigInt(group.base) * BigInt(reference.base);
    // Exact rational comparisons avoid excluding an exact 5/10/15 pp boundary
    // because of floating-point rate subtraction or display rounding.
    if (abs(numerator) * 100n < BigInt(options.minimumDifference) * denominator) {
      omitted.push({code:group.code,label:group.label,reason:'Below your minimum absolute difference.'}); return;
    }
    if (Math.min(group.base,reference.base) < options.minimumBase) {
      omitted.push({code:group.code,label:group.label,reason:'Below your minimum valid base in at least one group.'}); return;
    }
    candidates.push({numerator,denominator,index,finding:{code:group.code,label:group.label,referenceCode:reference.code,referenceLabel:reference.label,
      event:group.event,base:group.base,referenceEvent:reference.event,referenceBase:reference.base,
      missing:group.missingOutcome,excluded:group.excludedOutcome,sourceRows:group.rows,priority:priority.has(group.code),
      referenceMissing:reference.missingOutcome,referenceExcluded:reference.excludedOutcome,
      difference:100 * Number(numerator) / Number(denominator),adjustedLogP:adjusted[index],decision:comparison.decision,cautions:[...comparison.warnings]}});
  });
  const tier = (decision: ReviewedComparison['decision']) => decision === 'below' ? 0 : decision === 'boundary' ? 1 : 2;
  candidates.sort((left,right) => {
    const a=left.finding,b=right.finding;
    const evidence=tier(a.decision)-tier(b.decision);if(evidence)return evidence;
    if(a.priority!==b.priority)return a.priority?-1:1;
    const gap=abs(left.numerator)*right.denominator-abs(right.numerator)*left.denominator;
    if(gap)return gap>0n?-1:1;
    const base=Math.min(b.base,b.referenceBase)-Math.min(a.base,a.referenceBase);if(base)return base;
    const missing=BigInt(a.missing+a.excluded)*BigInt(b.sourceRows)-BigInt(b.missing+b.excluded)*BigInt(a.sourceRows);
    return missing ? missing<0n?-1:1 : left.index-right.index;
  });
  return {ranked:candidates.map(candidate=>candidate.finding),omitted,familySize:result.familySize};
}
