// @vitest-environment jsdom
import { act, StrictMode, type EffectCallback, type DependencyList } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";

const mocks = vi.hoisted(() => ({ load: vi.fn(), syncLoad: vi.fn(), change: null as null | ((next: DashboardWorkspace) => void), effectRevision: 0, recoveryWorkspace: null as DashboardWorkspace | null, recoveryRevision: undefined as undefined | (() => number) }));
// Controlled dependency replay models Fast Refresh re-running effects while
// preserving component state. This does not claim native HMR/browser coverage.
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useEffect: (effect: EffectCallback, deps?: DependencyList) => actual.useEffect(effect, deps ? [...deps, mocks.effectRevision] : deps) };
});
vi.mock("../workspaceSaveSession", () => ({ workspaceSaveSession: { loadAsync: mocks.load, load: mocks.syncLoad } }));
vi.mock("../WorkspaceSaveRecovery", () => ({ WorkspaceSaveRecovery: () => null, WorkspaceLoadRecovery: () => <div>Recovery required</div> }));
vi.mock("../RetainedFailedWorkspaceRecovery", () => ({ RetainedFailedWorkspaceRecovery: () => null }));
vi.mock("../DeferredWorkspaceImportRecovery", () => ({ DeferredWorkspaceImportRecovery: ({workspace, getWorkspaceRevision}: {workspace: DashboardWorkspace | null; getWorkspaceRevision: () => number}) => { mocks.recoveryWorkspace=workspace; mocks.recoveryRevision=getWorkspaceRevision; return workspace ? <button>Apply recovered studies</button> : null; } }));
vi.mock("../DeferredWorkspaceHistoryRecovery", () => ({ DeferredWorkspaceHistoryRecovery: () => null }));
vi.mock("../../workspace/WorkspaceHome", () => ({ WorkspaceHome: ({workspace, onWorkspaceChange}: {workspace: DashboardWorkspace; onWorkspaceChange: (next: DashboardWorkspace) => void}) => { mocks.change = onWorkspaceChange; return <div>Home: {workspace.label}<input aria-label="Unsaved child edit" defaultValue={workspace.label} /></div>; } }));
vi.mock("../../builder/BuilderApp", () => ({ default: ({initialWorkspace}: {initialWorkspace: DashboardWorkspace}) => <div>Builder: {initialWorkspace.label}</div> }));
import App from "../../../App";

let root: Root, host: HTMLDivElement;
function workspace(label: string) { return { ...normalizeDashboardWorkspace({reports: [createReportRecord(structuredClone(initialDashboard))]}), label }; }
function delayed() { let resolve!: (value: DashboardWorkspace) => void, reject!: (error: Error) => void; const promise = new Promise<DashboardWorkspace>((yes,no) => { resolve=yes; reject=no; }); return {promise,resolve,reject}; }
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); mocks.load.mockReset(); mocks.syncLoad.mockReset(); mocks.change=null; mocks.effectRevision=0; mocks.recoveryWorkspace=null; mocks.recoveryRevision=undefined; window.history.replaceState(null,"","#/"); host=document.createElement("div"); document.body.append(host); root=createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("does not mount workspace consumers before async startup resolves", async () => {
  const read=delayed(); mocks.load.mockReturnValue(read.promise);
  await act(async () => root.render(<App />));
  expect(host.textContent).toContain("Opening workspace..."); expect(mocks.syncLoad).not.toHaveBeenCalled();
  await act(async () => read.resolve(workspace("Opened after acknowledgement")));
  expect(host.textContent).toContain("Home: Opened after acknowledgement"); expect(host.textContent).not.toContain("Recovery required");
});

it("fails closed when the active startup reader rejects", async () => {
  mocks.load.mockRejectedValue(Error("Storage blocked"));
  await act(async () => root.render(<App />));
  expect(host.textContent).toContain("Recovery required"); expect(mocks.syncLoad).not.toHaveBeenCalled();
});

it("passes the acknowledged workspace to Builder rather than reading a second store", async () => {
  const next=workspace("Durable candidate"), read=delayed(); window.history.replaceState(null,"",`#/reports/${next.reports[0].id}`); mocks.load.mockReturnValue(read.promise);
  await act(async () => root.render(<App />)); expect(host.textContent).not.toContain("Builder:");
  await act(async () => read.resolve(next)); expect(host.textContent).toContain("Builder: Durable candidate"); expect(mocks.syncLoad).not.toHaveBeenCalled();
});

it("ignores an old startup reply after newer route data is acknowledged", async () => {
  const old=delayed(), current=delayed(), next=workspace("New route"); mocks.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  await act(async () => root.render(<App />));
  await act(async () => { window.history.replaceState(null,"",`#/reports/${next.reports[0].id}`); window.dispatchEvent(new PopStateEvent("popstate")); });
  await act(async () => current.resolve(next)); expect(host.textContent).toContain("Builder: New route");
  await act(async () => old.resolve(workspace("Stale reply"))); expect(host.textContent).toContain("Builder: New route"); expect(host.textContent).not.toContain("Stale reply");
});

it("does not replace a newer explicit workspace commit with an in-flight route read", async () => {
  const read=delayed(); mocks.load.mockResolvedValueOnce(workspace("Initial")).mockReturnValueOnce(read.promise);
  await act(async () => root.render(<App />)); const change=mocks.change!;
  await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
  await act(async () => change(workspace("New local work")));
  await act(async () => read.resolve(workspace("Stale route read")));
  expect(host.textContent).toContain("Home: New local work"); expect(host.textContent).not.toContain("Stale route read");
});

it("ignores a pending load after unmount", async () => {
  const read=delayed(); mocks.load.mockReturnValue(read.promise); await act(async () => root.render(<App />));
  await act(async () => root.render(null)); await act(async () => read.resolve(workspace("Late load")));
  expect(host.textContent).toBe("");
});

it("keeps only the current startup request during Strict Mode effect replay", async () => {
  const first=delayed(), second=delayed(); mocks.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await act(async () => root.render(<StrictMode><App /></StrictMode>)); expect(mocks.load).toHaveBeenCalledTimes(2);
  await act(async () => first.resolve(workspace("Replayed stale load"))); expect(host.textContent).toContain("Opening workspace...");
  await act(async () => second.resolve(workspace("Current effect load"))); expect(host.textContent).toContain("Home: Current effect load");
});

it("re-registers effects without reopening or unmounting an initialized dirty route", async () => {
  mocks.load.mockResolvedValue(workspace("Original"));
  await act(async () => root.render(<App />));
  const input=host.querySelector<HTMLInputElement>('[aria-label="Unsaved child edit"]')!;
  input.value="Dirty edit still inside debounce";
  mocks.effectRevision++;
  await act(async () => root.render(<App />));
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[aria-label="Unsaved child edit"]')).toBe(input);
  expect(input.value).toBe("Dirty edit still inside debounce");
});

it("restarts an interrupted pending read during effect replay", async () => {
  const first=delayed(), second=delayed(); mocks.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  await act(async () => root.render(<App />)); mocks.effectRevision++;
  await act(async () => root.render(<App />)); expect(mocks.load).toHaveBeenCalledTimes(2);
  await act(async () => first.resolve(workspace("Stale"))); expect(host.textContent).toContain("Opening workspace...");
  await act(async () => second.resolve(workspace("Restarted"))); expect(host.textContent).toContain("Home: Restarted");
});

it("revokes Home recovery ownership and hides mutation controls during a route read", async () => {
  const next=workspace("Destination"), read=delayed(); mocks.load.mockResolvedValueOnce(workspace("Home source")).mockReturnValueOnce(read.promise);
  await act(async () => root.render(<App />)); const before=mocks.recoveryRevision!();
  expect(host.textContent).toContain("Apply recovered studies");
  await act(async () => { window.history.replaceState(null,"",`#/reports/${next.reports[0].id}`); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(mocks.recoveryWorkspace).toBeNull(); expect(mocks.recoveryRevision!()).toBeGreaterThan(before);
  expect(host.textContent).not.toContain("Apply recovered studies");
  await act(async () => read.resolve(next)); expect(host.textContent).toContain("Builder: Destination"); expect(mocks.recoveryWorkspace).toBeNull();
});

it("does not bypass a child-held route when re-registering effects", async () => {
  mocks.load.mockResolvedValue(workspace("Held editor")); await act(async () => root.render(<App />));
  const input=host.querySelector<HTMLInputElement>('[aria-label="Unsaved child edit"]')!; input.value="Retained draft";
  // A child route guard may hold a changed URL and stop the route event.
  window.history.replaceState(null,"","#/reports/held-until-confirmation"); mocks.effectRevision++;
  await act(async () => root.render(<App />));
  expect(mocks.load).toHaveBeenCalledTimes(1); expect(host.querySelector('[aria-label="Unsaved child edit"]')).toBe(input); expect(input.value).toBe("Retained draft");
});
