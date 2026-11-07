import {expect,it} from 'vitest';
import {wilson95,reviewedProportionIntervals,intervalPercentLabel} from '../proportionIntervalModel';
import {wilsonReference} from './wilsonReference';
import {reportInsightFixture} from './reportInsightFixtures';
import {comparisonContextBinding,runComparisonReview} from '../comparisonReviewModel';

it('matches independent high-precision score-equation roots across boundaries, small bases and 50,000 respondents',()=>{
 for(const row of wilsonReference){const actual=wilson95(row.events,row.base)!;expect(Math.abs(actual.lower-Number(row.lower)),JSON.stringify(row)).toBeLessThan(2e-15);expect(Math.abs(actual.upper-Number(row.upper)),JSON.stringify(row)).toBeLessThan(2e-15);}
});
it('retains uncertainty for observed zero and 100% and contains every observed proportion for all bases through 100',()=>{
 for(let n=1;n<=100;n++)for(let k=0;k<=n;k++){const interval=wilson95(k,n)!;expect(interval.lower).toBeGreaterThanOrEqual(0);expect(interval.upper).toBeLessThanOrEqual(1);expect(interval.lower).toBeLessThanOrEqual(interval.rate+1e-15);expect(interval.upper).toBeGreaterThanOrEqual(interval.rate-1e-15);const complement=wilson95(n-k,n)!;expect(interval.lower).toBeCloseTo(1-complement.upper,14);expect(interval.upper).toBeCloseTo(1-complement.lower,14);}
 expect(wilson95(0,10)!.upper).toBeGreaterThan(.27);expect(wilson95(10,10)!.lower).toBeLessThan(.73);
});
it('has no interval or invented estimate for an empty valid base',()=>expect(wilson95(0,0)).toBeNull());
it('does not round away endpoint uncertainty for zero/all events at the maximum base',()=>{
 const zero=wilson95(0,50000)!,all=wilson95(50000,50000)!,one=wilson95(1,50000)!;
 expect(intervalPercentLabel(zero.lower)).toBe('0.0%');expect(intervalPercentLabel(zero.upper)).toBe('0.0077%');expect(intervalPercentLabel(all.lower)).toBe('99.9923%');expect(intervalPercentLabel(all.upper)).toBe('100.0%');expect(intervalPercentLabel(one.lower)).toBe('0.0004%');expect(intervalPercentLabel(.8)).toBe('80.0%');
 expect(()=>intervalPercentLabel(NaN)).toThrow();expect(()=>intervalPercentLabel(1.1)).toThrow();
});
it.each([[1,0],[-1,10],[11,10],[.5,10],[1,2.5],[1,-1],[1,50001],[NaN,10],[1,Infinity],[1,Number.MAX_SAFE_INTEGER+1]])('refuses unsupported events/base %s/%s',(events,base)=>expect(()=>wilson95(events,base)).toThrow('whole respondent'));
it('uses own valid bases and missing/excluded counts without changing sources, plans or test decisions',async()=>{
 const f=await reportInsightFixture(),context=f.contexts[0];f.dataset.rows[0].Outcome='';f.dataset.rows[1].Outcome='DK';
 const original=structuredClone({dataset:f.dataset,plan:context.plan});const result=await runComparisonReview(context,{signal:new AbortController().signal,reviewedBinding:comparisonContextBinding(context)}),before=JSON.stringify(result),groups=reviewedProportionIntervals(result,.05);
 expect(groups[0]).toMatchObject({base:248,event:123,missingOutcome:1,excludedOutcome:1});expect(groups[0].interval).toEqual(wilson95(123,248));expect(groups[1].interval).toEqual(wilson95(200,250));expect(JSON.stringify(result)).toBe(before);expect({dataset:f.dataset,plan:context.plan}).toEqual(original);
 context.plan.alpha=.1;const rerun=await runComparisonReview(context,{signal:new AbortController().signal,reviewedBinding:comparisonContextBinding(context)});expect(reviewedProportionIntervals(rerun,.1).map(g=>g.interval)).toEqual(groups.map(g=>g.interval));
});
it.each(['stale','fraction','missing','count','weighted','sparse'] as const)('refuses inconsistent or unsupported reviewed input: %s',async mode=>{
 const f=await reportInsightFixture(),context=f.contexts[0],result=await runComparisonReview(context,{signal:new AbortController().signal,reviewedBinding:comparisonContextBinding(context)});
 if(mode==='stale')f.dataset.rows[0].Outcome='N';if(mode==='fraction')result.groups[0].base=.5;if(mode==='missing')result.groups[0].missingOutcome++;if(mode==='count')result.comparisons[0].table[0]++;if(mode==='weighted')result.binding=JSON.stringify({plan:{design:'weighted'}});if(mode==='sparse')delete result.groups[1];
 expect(()=>reviewedProportionIntervals(result,.05)).toThrow();
});
it('keeps zero-variation rates visible with nonzero intervals and zero-base groups explicitly unavailable',async()=>{
 const f=await reportInsightFixture(),context=f.contexts[0];for(const row of f.dataset.rows)row.Outcome='Y';f.dataset.fields[1].valueLabels={Empty:'Empty group'};context.plan.groupBinding=JSON.stringify(f.dataset.fields[1]);context.plan.targets=['A','Empty'];const result=await runComparisonReview(context,{signal:new AbortController().signal,reviewedBinding:comparisonContextBinding(context)}),groups=reviewedProportionIntervals(result,.05);
 expect(result.comparisons.map(c=>c.status)).toEqual(['no_variation','no_data']);expect(groups[0].interval!.lower).toBeLessThan(1);expect(groups[1].interval!.lower).toBeLessThan(1);expect(groups[2].interval).toBeNull();
});
