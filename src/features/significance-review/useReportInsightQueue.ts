import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComparisonReviewContext, ComparisonReviewResult } from './comparisonReviewModel';
import { addReportInsightPlan, captureReportInsightPlan, type ReportInsightContext, type ReviewedInsightPlan } from './reportInsightModel';

export function useReportInsightQueue(context: ReportInsightContext) {
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const latest = useRef(context); latest.current = context;
  const [saved,setSaved] = useState<{reportId:string;entries:ReviewedInsightPlan[]}>({reportId:context.draft.id,entries:[]});
  const queue = useRef(saved);
  const entries = saved.reportId === context.draft.id ? saved.entries : [];
  const commit = useCallback((next:ReviewedInsightPlan[])=>{const value={reportId:latest.current.draft.id,entries:next};queue.current=value;setSaved(value);},[]);
  useEffect(()=>{if(queue.current.reportId!==context.draft.id)commit([]);},[context.draft.id,commit]);
  useEffect(()=>{if(!entries.length)return;const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[entries.length]);
  const addReviewed = useCallback(async(input:ComparisonReviewContext,result:ComparisonReviewResult,signal:AbortSignal)=>{
    // Capture validates own data descriptors before it clones the plan. Do not
    // run structuredClone on a caller's accessors before that validation.
    const reportId=input.draft.id,plan=input.plan;
    const entry=await captureReportInsightPlan({...input,plan},result,{signal,getCurrentContext:()=>({...latest.current,plan})});
    if(signal.aborted||!mounted.current)throw new DOMException('Adding reviewed plan canceled.','AbortError');
    if(latest.current.draft.id!==reportId)throw Error('The report changed. No reviewed plan was added.');
    commit(addReportInsightPlan(queue.current.reportId===reportId?queue.current.entries:[],entry,reportId));
  },[commit]);
  const remove = useCallback((id:string)=>commit(queue.current.reportId===latest.current.draft.id?queue.current.entries.filter(entry=>entry.id!==id):[]),[commit]);
  const clear = useCallback(()=>commit([]),[commit]);
  return {entries,addReviewed,remove,clear};
}
