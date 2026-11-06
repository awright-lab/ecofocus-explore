import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AudienceControl } from "../../../audiences/AudienceControl";
import { useDocumentCommandState } from "../../../builder/hooks/useDocumentCommandState";
import { initialDashboard } from "../../documentSeeds";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import "../../../../styles.css";
import "../../../../studio.css";
const bytes = new TextEncoder().encode("Answer,Region,Spend\nYes,North,10\nNo,South,20\nYes,North,30\n");
const imported = await importDatasetBuffer(bytes.buffer, "synthetic-provenance.csv");
if (!imported.dataset) throw new Error(imported.error);
const dataset = imported.dataset, region = dataset.fields[1];
const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "count", chartType: "table" });
const initial = structuredClone(initialDashboard);
initial.importedDatasets = [];
initial.savedAudiences = [{ version: 1, id: "original_audience", label: "Original North audience", datasetId: dataset.id,
  importedAt: dataset.importedAt, expression: { kind: "category", fieldId: region.id, sourceColumn: region.sourceColumn, exclude: false, values: ["North"] } }];
initial.pages[0].tiles = [{ ...initial.pages[0].tiles[0], id: "target", query: result.query, result, visualization: "table" }];
function Fixture() {
  const [draft,commit] = useDocumentCommandState(initial), [study,setStudy] = useState(dataset);
  return <main style={{ padding: 32 }}><h1>Audience import provenance</h1>
    <p>Synthetic in-memory study only. No workspace writes, downloads or service calls.</p>
    <button onClick={()=>setStudy({ ...dataset, importedAt: "replacement-import", rows: dataset.rows.map(row=>({ ...row,Region: "North" })) })}>Replace synthetic study using same ID</button>
    <AudienceControl dashboard={draft} importedDatasets={[study]} selectedTileId="target" onChange={commit}/>
    <pre aria-label="Recorded synthetic provenance">{JSON.stringify({ currentImport: study.importedAt,
      savedImports: draft.savedAudiences?.map(item=>({ label: item.label, importedAt: item.importedAt })),
      sourceRows: study.rows.length, originalResultPreserved: JSON.stringify(draft.pages[0].tiles[0].result)===JSON.stringify(result) },null,2)}</pre>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
