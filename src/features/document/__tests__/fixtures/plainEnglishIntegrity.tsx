import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuestionPlanSuggestion } from "../../../journey/QuestionPlanSuggestion";
import { currentJourneyFieldBindings, prepareJourney, type JourneySetup } from "../../../journey/questionJourneyModel";
import type { SuggestedPlanFields } from "../../../journey/plainEnglishPlan";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { initialDashboard } from "../../documentSeeds";
import "../../../../styles.css";
import "../../../../studio.css";
import "../../../journey/questionJourney.css";

const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Region,Spend\nNorth,10\nNorth,30\nSouth,20\nSouth,40\n").buffer, "synthetic-column-binding.csv");
if (!dataset) throw Error("Synthetic binding import unavailable");
dataset.rows.forEach(row => { row.AlternateSpend = String(Number(row.Spend) * 10); });
const original = structuredClone(dataset), rowsBefore = JSON.stringify(original.rows), draft = { ...structuredClone(initialDashboard), importedDatasets: [original] };
const question = "Average Spend by Region";
function Harness() {
  const [study, setStudy] = useState(() => structuredClone(original));
  const [adopted, setAdopted] = useState<JourneySetup | null>(null);
  const [result, setResult] = useState("");
  function usePlan(plan: SuggestedPlanFields) { setAdopted({ reportId: draft.id, question, headline: "Binding review", ...plan }); setResult("Adopted controls only. No query has run."); }
  function preview() {
    try {
      if (!adopted) return;
      const calculated = prepareJourney(draft, [study], adopted);
      setResult(JSON.stringify({ values: calculated.result.table.map(row => ({ label: row.label, value: row.values.summary, base: row.bases.summary })), included: calculated.population.included }));
    } catch (error) { setResult(error instanceof Error ? error.message : "Preview refused."); }
  }
  return <main className="question-journey" style={{ margin: "20px auto", padding: 20, overflow: "auto", maxHeight: "95vh" }}>
    <h1>In-memory column binding acceptance</h1><p>Actual planner component and query model; this fixture never reads or writes a workspace and contains four fabricated rows.</p>
    <p>Question: {question}. Current raw Spend column: {study.fields[1].sourceColumn}. Import event: {study.importedAt}. Rows unchanged: {String(JSON.stringify(study.rows) === rowsBefore)}.</p>
    <button onClick={() => { const changed = structuredClone(study); changed.fields[1].sourceColumn = "AlternateSpend"; setStudy(changed); }}>Change raw Spend mapping</button>
    <button onClick={() => setStudy(structuredClone(original))}>Restore original mapping</button>
    <QuestionPlanSuggestion question={question} dataset={study} audiences={[]} onUse={usePlan} />
    <button disabled={!adopted} onClick={preview}>Preview adopted synthetic plan</button>
    <button disabled={!adopted} onClick={() => { if (adopted) setAdopted({ ...adopted, fieldBindings: currentJourneyFieldBindings(adopted, study) }); setResult("Explicitly reviewed current field bindings. Preview remains separate."); }}>Review current adopted bindings</button>
    <output aria-label="Synthetic binding result">{result}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
