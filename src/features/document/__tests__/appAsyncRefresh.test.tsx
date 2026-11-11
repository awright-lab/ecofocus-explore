// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import { createReportRecord, normalizeDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";

// Install the actual Fast Refresh hook before React DOM initializes. This is
// supplied by the existing Vite React plugin, and does not use a real browser.
const refresh = await vi.hoisted(async () => {
  const moduleName = "react-refresh/runtime";
  const { default: runtime } = await import(moduleName) as {
    default: {
      injectIntoGlobalHook(target: typeof globalThis): void;
      register(type: unknown, id: string): void;
      performReactRefresh(): unknown;
    };
  };
  runtime.injectIntoGlobalHook(globalThis);
  return runtime;
});
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../workspaceSaveSession", () => ({ workspaceSaveSession: { loadAsync: mocks.load } }));
vi.mock("../WorkspaceSaveRecovery", () => ({
  WorkspaceSaveRecovery: () => null,
  WorkspaceLoadRecovery: () => <div>Recovery required</div>,
}));
vi.mock("../RetainedFailedWorkspaceRecovery", () => ({ RetainedFailedWorkspaceRecovery: () => null }));
vi.mock("../DeferredWorkspaceImportRecovery", () => ({ DeferredWorkspaceImportRecovery: () => null }));
vi.mock("../DeferredWorkspaceHistoryRecovery", () => ({ DeferredWorkspaceHistoryRecovery: () => null }));
vi.mock("../../workspace/WorkspaceHome", () => ({ WorkspaceHome: () => <div>Home</div> }));
vi.mock("../../builder/BuilderApp", () => ({
  default: ({ initialWorkspace }: { initialWorkspace: DashboardWorkspace }) => {
    const [title, setTitle] = useState("Original editor title");
    return <button onClick={() => setTitle("Unsaved command-time edit")}>{initialWorkspace.label}: {title}</button>;
  },
}));
import App from "../../../App";

let root: Root, host: HTMLDivElement;
function workspace(label: string) {
  return { ...normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }), label };
}
function delayed() {
  let resolve!: (value: DashboardWorkspace) => void;
  const promise = new Promise<DashboardWorkspace>(yes => { resolve = yes; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.load.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("keeps dirty mounted editor state when actual Fast Refresh replays App effects", async () => {
  const value = workspace("Loaded workspace");
  window.history.replaceState(null, "", `#/reports/${value.reports[0].id}`);
  mocks.load.mockResolvedValue(value);
  // Calling App preserves its hooks on the registered family, so Refresh itself
  // replays App's effects while retaining state, just as a hot module update does.
  function BeforeRefresh() { return App(); }
  refresh.register(BeforeRefresh, "AsyncRefreshDirtyEditor");
  await act(async () => root.render(<BeforeRefresh />));
  const editor = host.querySelector("button")!;
  await act(async () => editor.click());
  expect(host.textContent).toContain("Unsaved command-time edit");

  function AfterRefresh() { return App(); }
  refresh.register(AfterRefresh, "AsyncRefreshDirtyEditor");
  await act(async () => { refresh.performReactRefresh(); });

  expect(mocks.load).toHaveBeenCalledOnce();
  expect(host.querySelector("button")).toBe(editor);
  expect(host.textContent).toContain("Unsaved command-time edit");
});

it("restarts an interrupted startup read during Fast Refresh and ignores its older reply", async () => {
  const value = workspace("Current startup"), old = delayed(), current = delayed();
  window.history.replaceState(null, "", `#/reports/${value.reports[0].id}`);
  mocks.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  function BeforeRefresh() { return App(); }
  refresh.register(BeforeRefresh, "AsyncRefreshPendingStartup");
  await act(async () => root.render(<BeforeRefresh />));
  expect(host.textContent).toContain("Opening workspace...");

  function AfterRefresh() { return App(); }
  refresh.register(AfterRefresh, "AsyncRefreshPendingStartup");
  await act(async () => { refresh.performReactRefresh(); });
  expect(mocks.load).toHaveBeenCalledTimes(2);
  await act(async () => current.resolve(value));
  await act(async () => old.resolve(workspace("Stale startup")));
  expect(host.textContent).toContain("Current startup");
  expect(host.textContent).not.toContain("Stale startup");
});
