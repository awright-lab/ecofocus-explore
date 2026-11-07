import { useEffect, useState } from 'react';
import type { ComparisonReviewResult } from './comparisonReviewModel';
import { buildRankedFindings, type FindingFeed } from './rankedFindingsModel';
import { probabilityLabel } from './exactComparisonMath';

export function RankedFindings({result,alpha,onInspect,onStale}:{result:ComparisonReviewResult;alpha:number;onInspect:(code:string)=>void;onStale?:()=>void}) {
  const [minimumDifference,setMinimumDifference]=useState('5'),[minimumBase,setMinimumBase]=useState('30');
  const [priorities,setPriorities]=useState<string[]>([]),[actionIssue,setActionIssue]=useState('');
  let feed:FindingFeed|null=null,issue='',stale=false;
  try {
    if(!result.sourceStillCurrent()){stale=true;throw Error('The source or comparison context changed. Run the reviewed comparisons again.');}
    if(!minimumDifference.trim()||!minimumBase.trim())throw Error('Enter both display limits to rank findings.');
    feed=buildRankedFindings(result,{minimumDifference:Number(minimumDifference),minimumBase:Number(minimumBase),priorityCodes:priorities,alpha});
  }catch(error){issue=error instanceof Error?error.message:'Ranked findings are unavailable. Run the review again.';}
  useEffect(()=>{if(stale)onStale?.();},[stale,onStale]);
  function inspect(code:string){
    let current=false;try{current=result.sourceStillCurrent();}catch{/* source inspection fails closed */}
    if(!current){setActionIssue('The source changed. Run reviewed comparisons again before inspecting a ranked finding.');onStale?.();return;}
    setActionIssue('');onInspect(code);
  }
  const gap=(value:number)=>{const rounded=Number(value.toFixed(1));return`${rounded>0?'+':''}${rounded.toFixed(1)} pp`;};
  return <section className="ranked-findings" aria-label="Ranked reviewed findings">
    <h3>Explore ranked findings</h3>
    <p>Rankings and display choices stay in this temporary review.</p>
    <p>Ordering is an exploratory display heuristic: adjusted evidence category, your research priority, absolute unrounded difference, larger minimum valid base, lower missing/excluded share, then original family order.</p>
    <p>The original {result.familySize}-comparison Holm adjustment stays intact. Display filters and priorities do not change the tests. A base cutoff does not establish precision, power or representativeness.</p>
    <div className="comparison-review-columns"><label>Minimum absolute difference (percentage points)<input type="number" min="0" max="100" step="1" value={minimumDifference} onChange={event=>setMinimumDifference(event.target.value)}/></label>
      <label>Minimum valid base in both groups<input type="number" min="1" max="50000" step="1" value={minimumBase} onChange={event=>setMinimumBase(event.target.value)}/></label></div>
    <details><summary>Set research priorities</summary><fieldset><legend>Groups most relevant to your question</legend>{result.comparisons.map(comparison=><label key={comparison.code} className="comparison-review-check"><input type="checkbox" checked={priorities.includes(comparison.code)} onChange={event=>{const checked=event.target.checked;setPriorities(previous=>checked?(previous.includes(comparison.code)?previous:[...previous,comparison.code]):previous.filter(code=>code!==comparison.code));}}/>{comparison.label} [{JSON.stringify(comparison.code)}]</label>)}</fieldset></details>
    {(issue||actionIssue)&&<p role="alert">{issue||actionIssue}</p>}
    {feed&&!actionIssue&&<><p role="status">{feed.ranked.length} ranked findings; {feed.omitted.length} outside these display rules or uninterpreted. Full reviewed family: {feed.familySize}.</p>
      <ol className="ranked-findings-list">{feed.ranked.map(finding=><li key={finding.code} className="ranked-finding-card" aria-label={`Finding for ${JSON.stringify(finding.code)}`}>
        <h4>{finding.label} [{JSON.stringify(finding.code)}] {finding.priority&&<small>Research priority</small>}</h4>
        <p><strong>{gap(finding.difference)}</strong> versus {finding.referenceLabel} [{JSON.stringify(finding.referenceCode)}]</p>
        <p>{finding.event} / {finding.base} valid respondents; reference {finding.referenceEvent} / {finding.referenceBase}. {finding.missing} missing and {finding.excluded} explicitly excluded outcomes in this group.</p>
        <p>Reference exclusions: {finding.referenceMissing} missing and {finding.referenceExcluded} explicitly excluded outcomes.</p>
        <p>Holm-adjusted p {probabilityLabel(finding.adjustedLogP)} at alpha {alpha}: {finding.decision==='below'?'below the chosen threshold':finding.decision==='boundary'?'numerically at the threshold':'above the chosen threshold'}.</p>
        {finding.cautions.length>0&&<ul>{finding.cautions.map(caution=><li key={caution}>{caution}</li>)}</ul>}
        <button type="button" onClick={()=>inspect(finding.code)}>Review counts for {finding.label} [{JSON.stringify(finding.code)}]</button>
      </li>)}</ol>
      {!feed.ranked.length&&<p>No interpreted comparisons meet these display rules. Review the complete comparison table or change the display limits; no new test is run.</p>}
      {feed.omitted.length>0&&<details><summary>Why other comparisons are not ranked</summary><ul>{feed.omitted.map(item=><li key={item.code}>{item.label} [{JSON.stringify(item.code)}]: {item.reason}</li>)}</ul></details>}
    </>}
  </section>;
}
