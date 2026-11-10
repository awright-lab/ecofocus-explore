/** Recorded review definitions only. No respondent rows or calculated probabilities. */
export interface ComparisonReviewPlan {
 reportId:string;datasetId:string;importedAt:string;idFieldId:string;idBinding:string;groupFieldId:string;groupBinding:string;outcomeFieldId:string;outcomeBinding:string;
 audienceId:string;reference:string;targets:string[];eventCodes:string[];excludedCodes:string[];alpha:number;
 design:'unknown'|'unweighted_independent'|'weighted'|'paired_or_clustered';question:string;methodology:string;
}
export interface ReviewedInsightPlan { version:1;id:string;sourceDigest:string;plan:ComparisonReviewPlan }
