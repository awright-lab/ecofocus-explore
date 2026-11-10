import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceHome } from "../../WorkspaceHome";
import { workspaceSaveSession } from "../../../document/workspaceSaveSession";
import { initialDashboard } from "../../../document/documentSeeds";
import { createReportRecord, normalizeDashboardWorkspace, workspaceStorageKey } from "../../../document/workspacePersistence";
import { syntheticStudy } from "../../../document/__tests__/fixtures/syntheticStudy";
import type { DashboardWorkspace } from "../../../../../shared/types/dashboard";
import "../../../../styles.css";
import "../../../../studio.css";

const { dataset } = await syntheticStudy(1000, 60);
const initial = normalizeDashboardWorkspace({ reports: [createReportRecord({ ...structuredClone(initialDashboard), title: "Synthetic navigation acceptance" })], importedDatasets: [dataset] });
const originalText = localStorage.getItem(workspaceStorageKey);
let release: ((saved: boolean) => void) | null = null;
function Harness() {
 const [workspace, setWorkspace] = useState(initial), [ready, setReady] = useState(false), [waiting, setWaiting] = useState(false), [captured, setCaptured] = useState<DashboardWorkspace | null>(null), [hash, setHash] = useState(window.location.hash), [outcome, setOutcome] = useState("No simulated acknowledgement yet");
 useEffect(() => {
  const original = workspaceSaveSession.saveAsync;
  workspaceSaveSession.saveAsync = async value => {
   setCaptured(structuredClone(value)); workspaceSaveSession.remember(value); setWaiting(true);
   const saved = await new Promise<boolean>(resolve => { release = resolve; });
   if (saved) workspaceSaveSession.remember(null);
   return saved;
  };
  const route = () => setHash(window.location.hash); window.addEventListener("hashchange", route); setReady(true);
  return () => { workspaceSaveSession.saveAsync = original; release = null; window.removeEventListener("hashchange", route); };
 }, []);
 function finish(saved: boolean) { const current = release; release = null; setWaiting(false); setOutcome(saved ? "Simulated successful acknowledgement" : "Simulated save failure"); current?.(saved); }
 return <>
  {ready ? hash.startsWith("#/reports/") ? <main style={{padding:40}}><h1>Synthetic report opened after acknowledgement</h1><p>Target: {workspace.activeReportId}</p><p>Captured study: {captured?.importedDatasets[0]?.rows.length} rows × {captured?.importedDatasets[0]?.fields.length} fields</p></main> : <WorkspaceHome workspace={workspace} onWorkspaceChange={setWorkspace} /> : <p>Preparing synthetic fixture...</p>}
  <aside style={{position:"fixed",right:16,bottom:16,zIndex:3000,padding:18,maxWidth:460,background:"white",border:"2px solid #39784d",borderRadius:12,boxShadow:"0 8px 24px #0002"}} aria-label="Synthetic save controls">
   <strong>Developer fixture · synthetic data only</strong><p>This simulates a delayed save acknowledgement. It does not write the current browser workspace.</p><p role="status">{waiting ? "Waiting for simulated acknowledgement" : outcome}</p><p>Captured reports: {captured?.reports.length ?? 0} · study rows: {captured?.importedDatasets[0]?.rows.length ?? 0}</p><p>Fixture route: {hash || "home"}</p><p>Original browser save: {localStorage.getItem(workspaceStorageKey) === originalText ? "unchanged" : "CHANGED"}</p>
   <button disabled={!waiting} onClick={() => { window.location.hash = "/elsewhere"; }}>Navigate elsewhere</button><button disabled={!waiting} onClick={() => finish(true)}>Confirm simulated save</button><button disabled={!waiting} onClick={() => finish(false)}>Fail simulated save</button>
  </aside>
 </>;
}
createRoot(document.querySelector("#root")!).render(<Harness />);
