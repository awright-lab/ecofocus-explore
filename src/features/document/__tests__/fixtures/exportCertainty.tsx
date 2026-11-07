import { useState } from "react"; import { createRoot } from "react-dom/client";
import { ExportPreflightDialog } from "../../../export/ExportPreflightDialog";
import { analysisContextRows } from "../../../export/exportIntegrity";
import { initialDashboard } from "../../documentSeeds";
import "../../../../styles.css"; import "../../../../studio.css";
function sample(ambiguous: boolean) {
 const draft = structuredClone(initialDashboard); draft.pages = [draft.pages[0]];
 draft.pages[0].elements = []; draft.pages[0].tiles = [draft.pages[0].tiles[0]];
 const tile = draft.pages[0].tiles[0]; tile.visualization = "table";
 tile.result.columns = [{id:"audience",label:"Synthetic audience"}];
 tile.result.table = [{optionId:"yes",label:"Yes",values:{audience:10},bases:{audience:50}}, {optionId:"no",label:"No",values:{audience:40},bases:{audience:50}}];
 tile.result.query.weight = "weightvar";
 tile.result.weighting = { applied: false, id: null, label: "Unweighted" }; tile.query = structuredClone(tile.result.query);
 if (ambiguous) tile.result.table.push(structuredClone(tile.result.table[0])); return draft;
}
function App() { const [ambiguous, setAmbiguous] = useState(true), [open, setOpen] = useState(false); const draft = sample(ambiguous);
 return <main style={{ padding: 30, height: "100vh", overflowY: "auto" }}><h1>Export integrity acceptance</h1>
 <p>Synthetic cached result only. No file downloads, storage writes or service calls.</p>
 <button onClick={() => setAmbiguous(!ambiguous)}>{ambiguous ? "Use distinct result IDs" : "Use duplicate result IDs"}</button>
 <p>Result IDs: {ambiguous ? "duplicate" : "distinct"}</p>
 <dl>{analysisContextRows(draft.pages[0].tiles[0]).filter(([key]) => key === "Weighting" || key === "Base scope").map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
 <button onClick={() => setOpen(true)}>Review synthetic export</button>{open && <ExportPreflightDialog dashboard={draft} onClose={() => setOpen(false)} />}</main>;
} createRoot(document.getElementById("root")!).render(<App />);
