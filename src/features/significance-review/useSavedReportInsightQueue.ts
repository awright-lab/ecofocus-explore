import {useCallback,useEffect,useRef} from 'react';
import type {DashboardDraft} from '../../../shared/types/dashboard';
import type {ComparisonReviewContext,ComparisonReviewResult} from './comparisonReviewModel';
import {addReportInsightPlan,captureReportInsightPlan,type ReportInsightContext} from './reportInsightModel';
import {savedReportInsightPlans} from './savedReportInsightPlans';
type Change=(update:(draft:DashboardDraft)=>DashboardDraft)=>boolean;
/** Save definitions through the normal report history/recovery; never persist calculated feed results. */
export function useSavedReportInsightQueue(context:ReportInsightContext,onChange:Change){
 const admissionEpoch=useRef(0),mounted=useRef(true),latest=useRef(context);latest.current=context;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const state=savedReportInsightPlans(context.draft),reportId=context.draft.id;
 const addReviewed=useCallback(async(input:ComparisonReviewContext,result:ComparisonReviewResult,signal:AbortSignal)=>{
  const owner=input.draft.id,plan=input.plan,epoch=admissionEpoch.current;
  const starting=savedReportInsightPlans(latest.current.draft);if(starting.issue)throw Error(starting.issue);const collection=JSON.stringify(starting.entries);
  const entry=await captureReportInsightPlan({...input,plan},result,{signal,getCurrentContext:()=>({...latest.current,plan})});
  if(signal.aborted||!mounted.current)throw new DOMException('Adding reviewed plan canceled.','AbortError');
  if(admissionEpoch.current!==epoch)throw Error('The reviewed collection was changed or cleared while adding. Add the current family again.');
  if(latest.current.draft.id!==owner)throw Error('The report changed. No reviewed plan was saved.');
  const current=savedReportInsightPlans(latest.current.draft);if(current.issue)throw Error(current.issue);if(JSON.stringify(current.entries)!==collection)throw Error("The saved collection changed while adding this family. Review it and add again.");
  // Validate before dispatch, then derive from the real command-time report again.
  const next=addReportInsightPlan(current.entries,entry,owner);
  if(JSON.stringify(current.entries)===JSON.stringify(next))return;
  const changed=onChange(draft=>{if(draft.id!==owner)return draft;const current=savedReportInsightPlans(draft);if(current.issue||JSON.stringify(current.entries)!==collection)return draft;return{...draft,insightReviewPlans:addReportInsightPlan(current.entries,entry,owner)};});
  if(!changed)throw Error("The editing context changed before the definitions could be added. Review and add the family again.");
 },[onChange]);
 const remove=useCallback((id:string)=>{if(!mounted.current)return;admissionEpoch.current++;onChange(draft=>{if(draft.id!==reportId)return draft;const current=savedReportInsightPlans(draft);if(current.issue||!current.entries.some(entry=>entry.id===id))return draft;return{...draft,insightReviewPlans:current.entries.filter(entry=>entry.id!==id)};});},[onChange,reportId]);
 const clear=useCallback(()=>{if(!mounted.current)return;admissionEpoch.current++;onChange(draft=>{if(draft.id!==reportId)return draft;const current=savedReportInsightPlans(draft);if(!current.present||!current.issue&&!current.entries.length)return draft;const descriptor=Object.getOwnPropertyDescriptor(draft,'insightReviewPlans');if(descriptor&&!Object.hasOwn(descriptor,'value'))return draft;return{...draft,insightReviewPlans:[]};});},[onChange,reportId]);
 return{entries:state.entries,storedIssue:state.issue,addReviewed,remove,clear};
}
