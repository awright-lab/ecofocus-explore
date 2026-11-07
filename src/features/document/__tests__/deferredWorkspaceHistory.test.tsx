import { createPersistentWorkspaceHistory } from "../persistentWorkspaceHistory";
import type { DurableHistoryCandidate, DurableHistoryResult } from "../durableHistoryRepository";
// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDeferredWorkspaceHistory, deferredWorkspaceHistory } from "../deferredWorkspaceHistory";
import { DeferredWorkspaceHistoryRecovery } from "../DeferredWorkspaceHistoryRecovery";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { workspaceSaveSession } from "../workspaceSaveSession";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
let host: HTMLDivElement, root: Root;
function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
function candidate() { const value = workspace(), saved = createPublishedSnapshot(value, value.reports[0].draft); return { workspaceId: saved.workspace.id, snapshotId: saved.snapshot.id, payload: JSON.stringify(saved.workspace) }; }
function button(prefix: string) { return Array.from(host.querySelectorAll("button")).find(node => node.textContent?.startsWith(prefix))!; }
function deferred() { let resolve!: (saved: boolean) => void; let reject!: (error: Error) => void; const promise = new Promise<boolean>((yes,no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); deferredWorkspaceHistory.clear(); workspaceSaveSession.remember(null); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); deferredWorkspaceHistory.clear(); workspaceSaveSession.remember(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("keeps immutable candidates across subscriptions and never collapses conflicting payloads", () => {
  const store = createDeferredWorkspaceHistory(), change = vi.fn(), stop = store.subscribe(change), source = candidate();
  store.remember(source); store.remember(source); expect(store.getPending()).toHaveLength(1); expect(change).toHaveBeenCalledOnce();
  source.payload = "different captured bytes"; store.remember(source); expect(store.getPending()).toHaveLength(2);
  expect(Object.isFrozen(store.getPending())).toBe(true); expect(Object.isFrozen(store.getPending()[0])).toBe(true);
  const second = store.getPending()[1].id; store.acknowledge(store.getPending()[0].id); expect(store.getPending()[0].id).toBe(second); stop(); store.clear(); expect(change).toHaveBeenCalledTimes(3);
});
it("keeps late history available on another route and protects closing the tab", async () => {
  deferredWorkspaceHistory.remember(candidate()); await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={null} onWorkspaceChange={vi.fn()} />));
  expect(host.querySelector('a')?.getAttribute("href")).toBe("#/"); expect(button("Keep saved")).toBeUndefined(); expect(button("Download saved history")).toBeTruthy();
  const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
});
it("does not write or consume history until explicitly requested and acknowledged", async () => {
  const pending = deferred(), change = vi.fn(); deferredWorkspaceHistory.remember(candidate()); const save = vi.spyOn(workspaceSaveSession,"saveAsync").mockReturnValue(pending.promise);
  function Harness() { const [value,setValue] = useState(workspace); return <DeferredWorkspaceHistoryRecovery workspace={value} onWorkspaceChange={next => { change(next); setValue(next); }} />; }
  await act(async () => root.render(<Harness />)); expect(save).not.toHaveBeenCalled();
  await act(async () => button("Keep saved").click()); expect(save).toHaveBeenCalledOnce(); expect(change).toHaveBeenCalledOnce(); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1); expect(button("Saving combined")?.disabled).toBe(true);
  await act(async () => pending.resolve(true)); expect(deferredWorkspaceHistory.getPending()).toHaveLength(0); expect(host.textContent).toBe("");
});
it("retains both newer pending edits and the history candidate when saving fails", async () => {
  const value = workspace(); value.reports[0].draft.title = "Newer pending edits"; workspaceSaveSession.remember(value); deferredWorkspaceHistory.remember(candidate());
  vi.spyOn(workspaceSaveSession,"saveAsync").mockImplementation(async next => { workspaceSaveSession.remember(next); return false; });
  function Harness() { const [current,setCurrent] = useState(workspace); return <DeferredWorkspaceHistoryRecovery workspace={current} onWorkspaceChange={setCurrent} />; }
  await act(async () => root.render(<Harness />)); await act(async () => button("Keep saved").click());
  expect(deferredWorkspaceHistory.getPending()).toHaveLength(1); expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Newer pending edits"); expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(1); expect(host.textContent).toContain("could not be saved");
});
it("does not consume an old recovery after newer workspace props take ownership", async () => {
  const pending = deferred(), value = workspace(), change = vi.fn(); deferredWorkspaceHistory.remember(candidate()); vi.spyOn(workspaceSaveSession,"saveAsync").mockReturnValue(pending.promise);
  await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={value} onWorkspaceChange={change} />)); await act(async () => button("Keep saved").click());
  await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={{...value,label:"Newer route work"}} onWorkspaceChange={change} />)); await act(async () => pending.resolve(true));
  expect(deferredWorkspaceHistory.getPending()).toHaveLength(1); expect(button("Keep saved")?.disabled).toBe(false);
});
it("does not consume candidates after the recovery owner unmounts", async () => {
  const pending = deferred(); deferredWorkspaceHistory.remember(candidate()); vi.spyOn(workspaceSaveSession,"saveAsync").mockReturnValue(pending.promise);
  await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={workspace()} onWorkspaceChange={vi.fn()} />)); await act(async () => button("Keep saved").click());
  await act(async () => root.render(<p>Another route owner</p>)); await act(async () => pending.resolve(true)); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1);
});
it("refuses incompatible workspace identities without changing current work", async () => {
  deferredWorkspaceHistory.remember(candidate()); const value = workspace(); value.id = "another-workspace"; const change=vi.fn(), save=vi.spyOn(workspaceSaveSession,"saveAsync");
  await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={value} onWorkspaceChange={change} />)); await act(async () => button("Keep saved").click());
  expect(save).not.toHaveBeenCalled(); expect(change).not.toHaveBeenCalled(); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1); expect(host.textContent).toContain("separate review");
});
it("preserves unreadable candidates for download instead of inventing a workspace", async () => {
  deferredWorkspaceHistory.remember({ workspaceId: "local_workspace", snapshotId: "missing", payload: "{broken" }); const change=vi.fn();
  await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={workspace()} onWorkspaceChange={change} />)); await act(async () => button("Keep saved").click());
  expect(change).not.toHaveBeenCalled(); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1); expect(host.textContent).toContain("could not be reconciled safely"); expect(button("Download saved history")).toBeTruthy();
});
it("keeps recovery data when an unexpected save rejection occurs", async () => {
  deferredWorkspaceHistory.remember(candidate()); vi.spyOn(workspaceSaveSession,"saveAsync").mockRejectedValue(new Error("Synthetic lost acknowledgement"));
  function Harness() { const [value,setValue] = useState(workspace); return <DeferredWorkspaceHistoryRecovery workspace={value} onWorkspaceChange={setValue} />; }
  await act(async () => root.render(<Harness />)); await act(async () => button("Keep saved").click());
  expect(deferredWorkspaceHistory.getPending()).toHaveLength(1); expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(1); expect(host.textContent).toContain("could not be confirmed");
});

it("keeps the candidate if a newer App commit occurs before new props render", async () => {
  let revision = 0; const pending = deferred(); deferredWorkspaceHistory.remember(candidate()); vi.spyOn(workspaceSaveSession,"saveAsync").mockReturnValue(pending.promise);
  await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={workspace()} onWorkspaceChange={() => ++revision} getWorkspaceRevision={() => revision} />));
  await act(async () => button("Keep saved").click()); revision += 1;
  await act(async () => pending.resolve(true)); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1);
});
it("exports the exact captured history payload and retains it when downloads fail", async () => {
  vi.useFakeTimers(); const source = { workspaceId: "local_workspace", snapshotId: "saved-snapshot", payload: "captured\ud800history" }; deferredWorkspaceHistory.remember(source);
  const parts: BlobPart[][] = [], NativeBlob = Blob; vi.stubGlobal("Blob", class extends NativeBlob { constructor(value: BlobPart[] = [], options?: BlobPropertyBag) { parts.push(value); super(value,options); } });
  const create = vi.fn(() => "blob:history-recovery"); vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL() {} }); vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(() => {});
  try {
    await act(async () => root.render(<DeferredWorkspaceHistoryRecovery workspace={null} onWorkspaceChange={vi.fn()} />)); await act(async () => button("Download saved history").click());
    expect(JSON.parse(String(parts[0][0]))).toEqual({ kind: "ecofocus-acknowledged-history-recovery", version: 1, ...source }); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1);
    create.mockImplementation(() => { throw new Error("Download blocked"); }); await act(async () => button("Download saved history").click()); expect(host.textContent).toContain("could not be downloaded"); expect(deferredWorkspaceHistory.getPending()).toHaveLength(1);
  } finally { vi.clearAllTimers(); vi.useRealTimers(); }
});

function persistentCandidate(): DurableHistoryCandidate { const value=candidate(); return { version:1,id:"persisted-history",...value,capturedAt:"2026-11-06T00:00:00Z" }; }
function persistentRepository(values: DurableHistoryCandidate[] = []) { return {
  inspect:vi.fn(async()=>({candidates:values,unreadableRecords:0})),
  stage:vi.fn(async():Promise<DurableHistoryResult>=>({kind:"staged"})),
  reconcile:vi.fn(async():Promise<DurableHistoryResult>=>({kind:"reconciled",payloadRetained:true})),
  close:vi.fn(async()=>{}),
}; }
it("displays confirmed browser recovery and allows closing after the write acknowledgement", async () => {
  const store=createPersistentWorkspaceHistory(persistentRepository([persistentCandidate()]));
  await act(async()=>{root.render(<DeferredWorkspaceHistoryRecovery history={store} workspace={null} onWorkspaceChange={vi.fn()}/>);await store.initialize();});
  expect(host.textContent).toContain("Stored in browser recovery");const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);await act(async()=>store.close());
});
it("exposes failed recovery storage and retries without claiming an unconfirmed copy is saved", async () => {
  const repo=persistentRepository();repo.inspect.mockRejectedValue(Error("Blocked storage"));const store=createPersistentWorkspaceHistory(repo,()=>"new-id");store.remember(candidate());
  await act(async()=>{root.render(<DeferredWorkspaceHistoryRecovery history={store} workspace={null} onWorkspaceChange={vi.fn()}/>);await store.initialize().catch(()=>{});});
  await act(async()=>{await Promise.resolve();});expect(host.textContent).toContain("Recovery storage could not be confirmed");expect(host.textContent).not.toContain("Stored in browser recovery");
  repo.inspect.mockResolvedValue({candidates:[],unreadableRecords:1});await act(async()=>button("Retry recovery storage").click());await act(async()=>store.retryStorage());
  expect(host.textContent).toContain("Stored in browser recovery");expect(host.textContent).toContain("record could not be read safely");await act(async()=>store.close());
});
it("retains a durable copy and reports cleanup failure after the workspace itself was saved", async () => {
  const repo=persistentRepository([persistentCandidate()]);repo.reconcile.mockRejectedValue(Error("Journal transaction aborted"));const store=createPersistentWorkspaceHistory(repo);
  vi.spyOn(workspaceSaveSession,"saveAsync").mockResolvedValue(true);
  function Harness(){const [value,setValue]=useState(workspace);return <DeferredWorkspaceHistoryRecovery history={store} workspace={value} onWorkspaceChange={setValue}/>;}
  await act(async()=>{root.render(<Harness/>);await store.initialize();});await act(async()=>button("Keep saved").click());
  expect(host.textContent).toContain("workspace was saved, but the recovery copy could not be cleared");expect(store.getPending()).toHaveLength(1);expect(workspaceSaveSession.getPending()).toBeNull();await act(async()=>store.close());
});

it("downloads the raw journal archive without acknowledging or replacing recovery copies",async()=>{
 vi.useFakeTimers();const repo={...persistentRepository([persistentCandidate()]),exportRecoveryArchive:vi.fn(async()=>'{"kind":"synthetic-raw-journal","payload":"\\ud800"}')};
 repo.inspect.mockResolvedValue({candidates:[persistentCandidate()],unreadableRecords:1});const store=createPersistentWorkspaceHistory(repo),change=vi.fn(),parts:BlobPart[][]=[],NativeBlob=Blob;
 vi.stubGlobal("Blob",class extends NativeBlob{constructor(value:BlobPart[]=[],options?:BlobPropertyBag){parts.push(value);super(value,options);}});
 const create=vi.fn(()=>"blob:synthetic-archive");vi.stubGlobal("URL",class extends URL{static createObjectURL=create;static revokeObjectURL(){}});vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
 try{
  await act(async()=>{root.render(<DeferredWorkspaceHistoryRecovery history={store} workspace={workspace()} onWorkspaceChange={change}/>);await store.initialize();});
  await act(async()=>button("Download recovery storage archive").click());expect(String(parts[0][0])).toBe(await repo.exportRecoveryArchive());
  expect(store.getPending()).toHaveLength(1);expect(repo.reconcile).not.toHaveBeenCalled();expect(repo.stage).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
  create.mockImplementation(()=>{throw Error("Synthetic download denial");});await act(async()=>button("Download recovery storage archive").click());expect(host.textContent).toContain("could not be downloaded completely");expect(store.getPending()).toHaveLength(1);
 }finally{vi.clearAllTimers();vi.useRealTimers();await store.close();}
});
it("retains damaged records and displays archive failures without downloading partial content",async()=>{
 const repo={...persistentRepository(),exportRecoveryArchive:vi.fn(async()=>{throw Error("Unsupported raw record");})};repo.inspect.mockResolvedValue({candidates:[],unreadableRecords:2});const store=createPersistentWorkspaceHistory(repo);
 const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
 await act(async()=>{root.render(<DeferredWorkspaceHistoryRecovery history={store} workspace={null} onWorkspaceChange={vi.fn()}/>);await store.initialize();});
 await act(async()=>button("Download recovery storage archive").click());expect(host.textContent).toContain("original records have not been changed");expect(click).not.toHaveBeenCalled();expect(repo.reconcile).not.toHaveBeenCalled();expect(store.getStorageState().unreadableRecords).toBe(2);await store.close();
});
it("does not start a download after the archive owner unmounts",async()=>{
 let resolve!:(value:string)=>void;const archive=new Promise<string>(yes=>{resolve=yes;});const repo={...persistentRepository(),exportRecoveryArchive:vi.fn(()=>archive)};repo.inspect.mockResolvedValue({candidates:[],unreadableRecords:1});const store=createPersistentWorkspaceHistory(repo),click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
 await act(async()=>{root.render(<DeferredWorkspaceHistoryRecovery history={store} workspace={null} onWorkspaceChange={vi.fn()}/>);await store.initialize();});await act(async()=>button("Download recovery storage archive").click());await act(async()=>root.render(<p>Other route</p>));await act(async()=>resolve("synthetic archive"));expect(click).not.toHaveBeenCalled();await store.close();
});

it("shows constructor failure while keeping memory download and close protection available",async()=>{
 const repo=persistentRepository(),make=vi.fn<()=>typeof repo>().mockImplementation(()=>{throw new DOMException("Synthetic storage denied","SecurityError");}),store=createPersistentWorkspaceHistory(make,()=>"retry-id");store.remember(candidate());
 await act(async()=>{root.render(<DeferredWorkspaceHistoryRecovery history={store} workspace={null} onWorkspaceChange={vi.fn()}/>);await store.initialize().catch(()=>{});});await act(async()=>{await Promise.resolve();});
 expect(host.textContent).toContain("Recovery storage could not be confirmed");expect(button("Download saved history")).toBeTruthy();expect(host.textContent).not.toContain("Stored in browser recovery");const event=new Event("beforeunload",{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
 make.mockReturnValue(repo);await act(async()=>button("Retry recovery storage").click());await act(async()=>store.retryStorage());expect(host.textContent).toContain("Stored in browser recovery");const settled=new Event("beforeunload",{cancelable:true});window.dispatchEvent(settled);expect(settled.defaultPrevented).toBe(false);await act(async()=>store.close());
});

it("does not acknowledge an obsolete history store after its save finishes across a store switch",async()=>{
 const first=createDeferredWorkspaceHistory(),second=createDeferredWorkspaceHistory(),source=candidate(),pending=deferred();first.remember(source);second.remember(source);vi.spyOn(workspaceSaveSession,"saveAsync").mockReturnValue(pending.promise);const current=workspace(),firstAck=vi.spyOn(first,"acknowledge"),secondAck=vi.spyOn(second,"acknowledge");
 await act(async()=>root.render(<DeferredWorkspaceHistoryRecovery history={first} workspace={current} onWorkspaceChange={vi.fn()}/>));await act(async()=>button("Keep saved").click());await act(async()=>root.render(<DeferredWorkspaceHistoryRecovery history={second} workspace={current} onWorkspaceChange={vi.fn()}/>));expect(button("Keep saved").disabled).toBe(false);await act(async()=>pending.resolve(true));expect(firstAck).not.toHaveBeenCalled();expect(secondAck).not.toHaveBeenCalled();expect(first.getPending()).toHaveLength(1);expect(second.getPending()).toHaveLength(1);
});
