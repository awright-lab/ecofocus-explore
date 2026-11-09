import type {DashboardDraft} from '../../../shared/types/dashboard';
import {reportInsightQueueIssue,type ReviewedInsightPlan} from './reportInsightModel';
export function savedReportInsightPlans(draft:DashboardDraft):{entries:ReviewedInsightPlan[];issue:string|null;present:boolean}{
 const descriptor=Object.getOwnPropertyDescriptor(draft,'insightReviewPlans');
 if(!descriptor||Object.hasOwn(descriptor,'value')&&descriptor.value===undefined)return{entries:[],issue:null,present:false};
 if(!Object.hasOwn(descriptor,'value'))return{entries:[],issue:'Saved insight plans contain unsupported accessors. Their data was kept; use a compatible backup before editing them.',present:true};
 const value=descriptor.value,issue=reportInsightQueueIssue(value,draft.id);
 return{entries:issue?[]:value,issue:issue?`Saved insight plans need review: ${issue} Their original metadata is retained. Clear these definitions explicitly or restore a compatible copy; never treat them as calculated findings.`:null,present:true};
}
export function assertReadableInsightPlans(draft:DashboardDraft){const issue=savedReportInsightPlans(draft).issue;if(issue)throw Error(issue);}

/** Retain readable source identities even when the plan itself is quarantined. */
export function savedInsightSourceIds(draft:DashboardDraft):string[]{
 const root=Object.getOwnPropertyDescriptor(draft,'insightReviewPlans');if(!root||!Object.hasOwn(root,'value')||!Array.isArray(root.value))return[];
 const ids=new Set<string>();
 for(const key of Object.keys(root.value)){if(!/^(0|[1-9][0-9]*)$/.test(key))continue;const entry=Object.getOwnPropertyDescriptor(root.value,key);if(!entry||!Object.hasOwn(entry,'value')||!entry.value||typeof entry.value!=='object')continue;const plan=Object.getOwnPropertyDescriptor(entry.value,'plan');if(!plan||!Object.hasOwn(plan,'value')||!plan.value||typeof plan.value!=='object')continue;const id=Object.getOwnPropertyDescriptor(plan.value,'datasetId');if(id&&Object.hasOwn(id,'value')&&typeof id.value==='string'&&id.value.length>0&&id.value.length<=512)ids.add(id.value);}
 return[...ids];
}
