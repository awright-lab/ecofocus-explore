import { useState } from "react";
import type { ImportedDatasetRecord } from "../../../shared/types/dashboard";
import type { SavedImportedAudience } from "../../../shared/types/audience";
import { confirmLocalQuestionSuggestion, suggestLocalQuestion, type LocalQuestionSuggestion, type SuggestedPlanFields } from "./plainEnglishPlan";

export function QuestionPlanSuggestion({ question, dataset, audiences, onUse }: { question: string; dataset?: ImportedDatasetRecord; audiences: SavedImportedAudience[]; onUse: (plan: SuggestedPlanFields) => void }) {
  const [proposal, setProposal] = useState<LocalQuestionSuggestion | null>(null);
  const [notice, setNotice] = useState("");
  const current = proposal?.status === "ready" ? suggestLocalQuestion(question, dataset, audiences) : null;
  const stale = proposal?.status === "ready" && JSON.stringify(current) !== JSON.stringify(proposal);
  return <section className="question-plan-suggestion" aria-label="Plain-English analysis planner">
    <h4>Suggest an editable plan</h4>
    <p>A local rules-based planner matches explicitly named fields and saved audiences. It supports counts, percentages, averages and totals; it does not use an AI service or infer an answer.</p>
    <details><summary>Supported question examples</summary><ul><li>What percentage of [response field] by [comparison field]?</li><li>How many responses to [response field]?</li><li>What is the average [number] by [grouping field] for [saved audience]?</li><li>Total [number] by [grouping field] for all respondents?</li></ul><p>Use actual field wording, a raw column name or an exact declared concept. For ambiguous names, write “column [raw name]”. Omit brackets. Comparisons and saved audiences are optional for counts and percentages. Other conditions, weights, trends, significance and causal questions need an explicit manual plan; they are not inferred.</p></details>
    <button type="button" disabled={!dataset || !question.trim()} onClick={() => { setProposal(suggestLocalQuestion(question, dataset, audiences)); setNotice(""); }}>Suggest analysis plan</button>
    {!dataset && <p>Choose a study first. No query will run when a plan is suggested or adopted.</p>}
    {proposal?.status === "clarify" && <p role="status">{proposal.message} You can always choose the analysis manually in the next step.</p>}
    {proposal?.status === "ready" && <>
      {stale ? <p role="alert">This proposal is out of date. Suggest the current question again; no plan has been applied.</p> : <><h5>Proposed plan — nothing has run</h5><dl>{proposal.summary.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}<small>{item.reason}</small></dd></div>)}</dl><p>Review these choices. Using this plan fills the existing editable analysis controls. Preview remains a separate action.</p></>}
      <button type="button" disabled={stale} onClick={() => {
        try { onUse(confirmLocalQuestionSuggestion(proposal, question, dataset, audiences)); setNotice("Plan filled. Add a deliverable title if needed, then review and edit the analysis and audience before Preview."); }
        catch (error) { setNotice(error instanceof Error ? error.message : "Suggest a new plan before using it."); }
      }}>Use editable plan</button>
    </>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
