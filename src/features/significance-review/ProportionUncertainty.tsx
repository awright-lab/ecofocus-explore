import type {ComparisonReviewResult} from './comparisonReviewModel';
import {reviewedProportionIntervals,intervalPercentLabel as percent} from './proportionIntervalModel';
import './proportion-uncertainty.css';

export function ProportionUncertainty({result,alpha}:{result:ComparisonReviewResult;alpha:number}){
  let groups:ReturnType<typeof reviewedProportionIntervals>;
  try{groups=reviewedProportionIntervals(result,alpha);}catch(error){return <section aria-label="Event-rate uncertainty"><h3>Uncertainty in each group rate</h3><p role="status">Intervals unavailable. {error instanceof Error?error.message:'Run the reviewed comparison again.'}</p></section>;}
  return <section className="proportion-uncertainty" aria-label="Event-rate uncertainty">
    <h3>Uncertainty in each group rate</h3>
    <p>Dots show observed event rates; lines show individual 95% Wilson score confidence intervals on the same 0–100% scale. Wider lines show less precise estimates under the declared independent, unweighted sampling model.</p>
    <p><strong>These are approximate intervals for separate group rates, not intervals for differences or simultaneous 95% coverage.</strong> They stay at 95% when the test alpha changes. Their overlap does not determine statistical significance; use the Fisher tests and Holm adjustment below. Small samples and rates near 0% or 100% still have uncertainty. Missing and excluded outcomes are outside each valid base; the intervals do not account for their potential bias, nonresponse, clustering or survey weights.</p>
    <p>Source: {result.sourceTitle}; outcome: {result.outcomeLabel}; audience: {result.audienceLabel}.</p>
    <ul>{groups.map(group=><li key={group.code} aria-label={`Rate interval for ${JSON.stringify(group.code)}`}>
      <div><h4>{group.label}{group.reference?' (reference)':''}</h4><small>Raw: {JSON.stringify(group.code)}</small>
        <p>{group.event.toLocaleString()} events / {group.base.toLocaleString()} valid respondents; {group.missingOutcome.toLocaleString()} missing, {group.excludedOutcome.toLocaleString()} explicitly excluded.</p>
        {group.interval?<p><strong>{percent(group.interval.rate)}</strong>; individual 95% Wilson interval <strong>{percent(group.interval.lower)} to {percent(group.interval.upper)}</strong>.</p>:<p><strong>Unavailable: no valid outcomes.</strong> No point or interval is drawn.</p>}
        {group.base>0&&group.base<30&&<p>Small valid base (fewer than 30): interpret cautiously. This warning is a heuristic, not a validity threshold.</p>}
      </div>
      {group.interval&&<svg viewBox="0 0 600 60" className="proportion-interval-plot" aria-hidden="true" focusable="false" data-lower={group.interval.lower} data-upper={group.interval.upper} data-rate={group.interval.rate}>
        <line x1="20" x2="580" y1="20" y2="20" stroke="#b8c9bf" strokeWidth="2"/>
        {[0,.5,1].map(tick=><g key={tick}><line x1={20+560*tick} x2={20+560*tick} y1="15" y2="25" stroke="#526c5d"/><text x={20+560*tick} y="48" textAnchor={tick===0?'start':tick===1?'end':'middle'} fill="#294537" fontSize="16">{tick*100}%</text></g>)}
        <line x1={20+560*group.interval.lower} x2={20+560*group.interval.upper} y1="20" y2="20" stroke="#23634e" strokeWidth="5"/>
        {[group.interval.lower,group.interval.upper].map((edge,index)=><line key={index} x1={20+560*edge} x2={20+560*edge} y1="12" y2="28" stroke="#23634e" strokeWidth="2"/>)}
        <circle cx={20+560*group.interval.rate} cy="20" r="6" fill="#173c32" stroke="#fff" strokeWidth="1.5"/>
      </svg>}
    </li>)}</ul>
    <details><summary>How to interpret these intervals</summary><p>Wilson score intervals invert an approximate binomial score test without continuity correction. Across repeated independent samples, a nominal 95% procedure aims for roughly 95% coverage of each group's underlying event probability; actual coverage varies with sample size and probability. This does not mean a 95% probability that a fixed population rate lies in this computed range. It does not establish a representative sample or a causal effect. No interval is calculated for zero valid respondents.</p><p>Counts are the original reviewed respondent counts, not rounded percentages or weighted totals. This temporary display does not change the analysis, its test family, saved report or source data. <a href="https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm" target="_blank" rel="noreferrer">NIST Wilson interval method</a>.</p></details>
  </section>;
}
