import type {ComparisonReviewResult} from './comparisonReviewModel';
import {buildRankedFindings} from './rankedFindingsModel';

const percentage=new Intl.NumberFormat('en-US',{minimumFractionDigits:1,maximumFractionDigits:4});
export function intervalPercentLabel(probability:number):string{
  if(!Number.isFinite(probability)||probability<0||probability>1)throw Error('A displayed probability must be between zero and one.');
  // At n<=50,000 even the smallest positive Wilson endpoint remains nonzero
  // at this precision; 0/50,000 must not read as a certain 0.0%-0.0% range.
  return `${percentage.format(probability*100)}%`;
}

/** Two-sided, individual 95% Wilson score interval without continuity correction.
 * Binomial independent unweighted respondents only; not a difference interval,
 * survey variance estimate, simultaneous interval or Fisher-test inversion.
 * NIST: https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm
 */
export function wilson95(events:number,base:number):{rate:number;lower:number;upper:number}|null {
  if(!Number.isSafeInteger(base)||base<0||base>50_000||!Number.isSafeInteger(events)||events<0||events>base)throw Error('Wilson intervals require whole respondent counts from 0 to 50,000 with events no greater than the valid base.');
  if(base===0)return null;
  const z=1.959963984540054,z2=z*z,p=events/base,denominator=1+z2/base;
  const center=(p+z2/(2*base))/denominator;
  const radius=z*Math.sqrt(p*(1-p)/base+z2/(4*base*base))/denominator;
  return {rate:p,lower:events===0?0:Math.max(0,center-radius),upper:events===base?1:Math.min(1,center+radius)};
}

export function reviewedProportionIntervals(result:ComparisonReviewResult,alpha:number){
  if(!result.sourceStillCurrent())throw Error('The reviewed source changed. Run the current comparison plan again.');
  // Reuse full family/count/base consistency checks rather than trusting cached
  // percentages or inferring an unweighted denominator from a displayed value.
  buildRankedFindings(result,{minimumDifference:0,minimumBase:1,priorityCodes:[],alpha});
  const binding=JSON.parse(result.binding) as {plan?:{design?:string}};
  if(binding.plan?.design!=='unweighted_independent')throw Error('These intervals require an explicitly reviewed independent unweighted design.');
  return result.groups.map((group,index)=>({...group,reference:index===0,interval:wilson95(group.event,group.base)}));
}
