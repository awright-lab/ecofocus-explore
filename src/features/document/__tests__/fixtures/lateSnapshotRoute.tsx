import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "../../../../App";
import { workspaceSaveSession } from "../../workspaceSaveSession";
import { initialDashboard } from "../../documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace, workspaceStorageKey } from "../../workspacePersistence";
import { syntheticStudy } from "./syntheticStudy";
import type { DashboardWorkspace } from "../../../../../shared/types/dashboard";
import "../../../../styles.css";
import "../../../../studio.css";

const { dataset } = await syntheticStudy(1000, 60);
let memory = normalizeDashboardWorkspace({ reports: [createReportRecord({ ...structuredClone(initialDashboard), title: "Original synthetic draft", importedDatasets: [dataset] })], importedDatasets: [dataset] });
const originalText = localStorage.getItem(workspaceStorageKey);
let release: ((saved: boolean) => void) | null = null, delayedOnce = false, refresh = () => {};
function rememberMemory(value: DashboardWorkspace) { memory = structuredClone(value); workspaceSaveSession.remember(null); refresh(); }
workspaceSaveSession.load = () => workspaceSaveSession.getPending() ?? structuredClone(memory);
workspaceSaveSession.save = value => { rememberMemory(value); return true; };
workspaceSaveSession.saveAsync = async (value, recovery = value) => {
  if (!delayedOnce && value.publishedSnapshots.length > memory.publishedSnapshots.length) {
    delayedOnce = true; workspaceSaveSession.remember(recovery);
    const promise = new Promise<boolean>(resolve => { release = resolve; }); refresh(); return promise;
  }
  rememberMemory(value); return true;
};
window.history.replaceState(null, "", `#/reports/${memory.reports[0].id}`);
function Harness() {
  const [,render] = useState(0);
  useEffect(() => { refresh = () => render(value => value + 1); return () => { refresh = () => {}; }; }, []);
  return <><App /><aside style={{position:"fixed",right:16,top:70,zIndex:10001,width:330,padding:14,background:"white",border:"2px solid #39784d",borderRadius:12}} aria-label="Synthetic late-save controls">
    <strong>Developer fixture · synthetic data only</strong><p>Save acknowledgement is simulated; browser workspace storage is not written.</p>
    <p>Current draft: {memory.reports[0].draft.title}</p><p>Current study: {memory.importedDatasets[0].rows.length} rows x {memory.importedDatasets[0].fields.length} fields</p><p>Saved snapshots: {memory.publishedSnapshots.length}</p>
    <p>Latest snapshot draft: {memory.publishedSnapshots[0]?.dashboard.title ?? "none"}</p><p>Original browser save: {localStorage.getItem(workspaceStorageKey) === originalText ? "unchanged" : "CHANGED"}</p>
    <button onClick={() => { window.location.hash = "/"; }}>Navigate Home</button><button disabled={!release} onClick={() => { const current = release; release = null; current?.(true); refresh(); }}>Complete old save</button>
  </aside></>;
}
createRoot(document.querySelector("#root")!).render(<Harness />);
