import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DeferredWorkspaceHistoryRecovery } from "../../DeferredWorkspaceHistoryRecovery";
import { createDurableHistoryRepository, historyCandidateDigest } from "../../durableHistoryRepository";
import { createPersistentWorkspaceHistory } from "../../persistentWorkspaceHistory";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace, workspaceStorageKey } from "../../workspacePersistence";
import { initialDashboard } from "../../documentSeeds";
import { syntheticStudy } from "./syntheticStudy";
import type { DashboardWorkspace } from "../../../../../shared/types/dashboard";
import "../../../../studio.css";
let root: Root;
function App() {
 const [status,setStatus]=useState("Ready: isolated synthetic journal only."),[ready,setReady]=useState<{workspace:DashboardWorkspace;history:ReturnType<typeof createPersistentWorkspaceHistory>;name:string;before:string|null}|null>(null),[current,setCurrent]=useState<DashboardWorkspace|null>(null),[unexpectedWrites,setUnexpectedWrites]=useState(0);
 async function setup(){
  setStatus("Preparing synthetic retained copies...");const before=localStorage.getItem(workspaceStorageKey),name='ecofocus-synthetic-retained-ui-'+Date.now(),repository=createDurableHistoryRepository(name);
  try{
   const {dataset}=await syntheticStudy(1000,60);const workspace=normalizeDashboardWorkspace({id:'synthetic-retained-ui-workspace',reports:[createReportRecord({...structuredClone(initialDashboard),importedDatasets:[dataset]})],importedDatasets:[dataset]}),saved=createPublishedSnapshot(workspace,workspace.reports[0].draft),record={version:1 as const,id:'retained-ui-copy',workspaceId:saved.workspace.id,snapshotId:saved.snapshot.id,capturedAt:'2026-11-06T00:00:00Z',payload:JSON.stringify(saved.workspace)};
   await repository.stage(record);await repository.reconcile(record);
   const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
   try{const legacy={...record,id:'legacy-ui-copy'},damaged={...record,id:'damaged-ui-copy'},legacyDigest=await historyCandidateDigest(legacy);await new Promise<void>((yes,no)=>{const tx=db.transaction('reconciledHistory','readwrite'),store=tx.objectStore('reconciledHistory');store.add({version:1,id:legacy.id,digest:legacyDigest});store.add({version:2,id:damaged.id,digest:'0'.repeat(64),candidate:damaged});tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});}finally{db.close();}
   workspace.reports[0].draft.title='Newer unsaved synthetic draft';const history=createPersistentWorkspaceHistory(()=>repository);setCurrent(workspace);setReady({workspace,history,name,before});setStatus('Ready: real retained receipt, one legacy digest-only receipt and one damaged receipt. Current draft has no saved snapshots.');
  }catch(error){await repository.close();setStatus('FAILED: '+String(error));}
 }
 async function cleanup(){if(!ready)return;const prior=ready;setReady(null);await prior.history.close();await new Promise<void>((yes,no)=>{const r=indexedDB.deleteDatabase(prior.name);r.onsuccess=()=>yes();r.onerror=()=>no(r.error);r.onblocked=()=>no(Error('Synthetic cleanup blocked'));});setStatus('Synthetic journal cleaned. Existing primary workspace unchanged: '+(localStorage.getItem(workspaceStorageKey)===prior.before)+'. Unexpected workspace writes: '+unexpectedWrites);}
 return <main style={{maxWidth:940,margin:'30px auto',padding:24}}><h1>Read-only retained recovery review</h1><p>Developer fixture: synthetic 1,000-row / 60-field study in an isolated journal. Product durable recovery stays disabled. Inspection and comparison do not write active workspace data.</p><p role="status">{status}</p>{!ready?<button type="button" onClick={()=>{void setup();}}>Set up isolated retained review</button>:<><p>Current draft: <strong>{current?.reports[0].draft.title}</strong>. Current snapshots: {current?.publishedSnapshots.length}. Unexpected workspace writes: {unexpectedWrites}. Existing primary workspace unchanged: {String(localStorage.getItem(workspaceStorageKey)===ready.before)}.</p><button type="button" onClick={()=>setCurrent(value=>value?{...value,reports:value.reports.map((report,index)=>index?report:{...report,draft:{...report.draft,title:'Changed current draft for stale comparison check'}})}:value)}>Change synthetic current draft</button><button type="button" onClick={()=>{void cleanup();}}>Clean up isolated review journal</button><DeferredWorkspaceHistoryRecovery history={ready.history} workspace={current} onWorkspaceChange={()=>setUnexpectedWrites(value=>value+1)}/></>}</main>;
}
root=createRoot(document.getElementById('root')!);root.render(<App/>);
