import { useState } from "react";
import { createRoot } from "react-dom/client";
import { initialDashboard } from "../../documentSeeds";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import LinearModelExplorer from "../../../models/LinearModelExplorer";
import reference from "../../../models/__tests__/linear-model-numpy-reference.json";
import "../../../../styles.css";
import "../../../../studio.css";

const cases = ["tiny outcome", "tiny predictor", "supported scaled outcome"] as const;
const studies = await Promise.all(cases.map(async kind => {
  const outcomeScale = kind === "tiny outcome" ? 1e-162 : kind === "supported scaled outcome" ? 1e-150 : 1;
  const predictorScale = kind === "tiny predictor" ? 1e-162 : 1;
  const csv = ["Outcome,PredictorA,PredictorB", ...reference.cases.map(row => [row.outcome * outcomeScale, row.predictors[0] * predictorScale, row.predictors[1]].join(","))].join("\n");
  const result = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, `${kind.replaceAll(" ", "_")}.csv`);
  if (!result.dataset) throw Error("Synthetic range import failed"); return result.dataset;
}));
const baseline = JSON.stringify(studies), draft = structuredClone(initialDashboard);
function Probe() {
  const [chosen, setChosen] = useState<number | null>(null), [inspection, setInspection] = useState("");
  return <><main><h1>Numeric model range runtime probe</h1><p>Component plus real module worker, fabricated observations only. No App writer, localStorage or backend calls.</p>{cases.map((kind, index) => <button key={kind} onClick={() => setChosen(index)}>Open {kind} model</button>)}<button onClick={() => setInspection(JSON.stringify({ sourceUnchanged: JSON.stringify(studies) === baseline, rows: studies.map(study => study.rows.length) }))}>Inspect range source preservation</button><output>{inspection}</output></main>{chosen !== null && <LinearModelExplorer key={chosen} draft={draft} studies={[studies[chosen]]} onClose={() => setChosen(null)} />}</>;
}
createRoot(document.getElementById("root")!).render(<Probe />);
