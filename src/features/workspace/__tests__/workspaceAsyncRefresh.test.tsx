// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import { createReportRecord, normalizeDashboardWorkspace } from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
import { buildDatasetConnectionProfiles } from "../../data/datasetConnectionModel";

// Actual React Fast Refresh effect replay, with DOM identity and hook state
// retained. This uses the existing Vite dependency, not a native browser.
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
import { WorkspaceHome } from "../WorkspaceHome";
import { workspaceSaveFailureMessage, workspaceSaveSession } from "../../document/workspaceSaveSession";

let root: Root, host: HTMLDivElement, familyNumber = 0;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  window.history.replaceState(null, "", "/#/");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null);
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function workspace() {
  const value = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] });
  const connection = buildDatasetConnectionProfiles()[0]; connection.status = "sync_ready";
  value.datasetConnections = [connection]; value.liveDatasetSources = [];
  return value;
}
function delayed() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>(yes => { resolve = yes; });
  return { promise, resolve };
}
function button(label: string) {
  const result = Array.from(host.querySelectorAll("button")).find(node => node.textContent?.trim() === label);
  expect(result, `Missing ${label}`).toBeTruthy(); return result!;
}
async function click(label: string) { await act(async () => button(label).click()); }
function unload() { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }
async function mount(initial: DashboardWorkspace) {
  const change = vi.fn(), family = `HomeAsyncSaveRefresh${++familyNumber}`;
  function useHome() {
    const [value, setValue] = useState(initial);
    return WorkspaceHome({ workspace: value, onWorkspaceChange: next => { change(next); setValue(next); } });
  }
  function BeforeRefresh() { return useHome(); }
  refresh.register(BeforeRefresh, family);
  await act(async () => root.render(<BeforeRefresh />));
  return { change, replay: async () => {
    function AfterRefresh() { return useHome(); }
    refresh.register(AfterRefresh, family);
    await act(async () => { refresh.performReactRefresh(); });
  } };
}
it.each([true, false])("settles a delayed additive mutation after real Fast Refresh; saved=%s", async saved => {
  const receipt = delayed(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const harness = await mount(workspace());
  await act(async () => host.querySelector<HTMLButtonElement>('button[data-section="data"]')!.click());
  const register = button("Register source"); await act(async () => register.click());
  expect(save).toHaveBeenCalledOnce(); expect(harness.change).not.toHaveBeenCalled(); expect(register.disabled).toBe(true);
  await harness.replay();
  expect(button("Register source")).toBe(register); expect(register.disabled).toBe(true); expect(unload()).toBe(true);
  expect(host.querySelector(".studio-import-toast")).toBeNull(); expect(save).toHaveBeenCalledOnce();
  const next = save.mock.calls[0][0]; await act(async () => receipt.resolve(saved));
  expect(harness.change).toHaveBeenCalledExactlyOnceWith(next);
  expect(host.querySelector(".workspace-live-source-row")).not.toBeNull();
  expect(host.textContent).not.toContain("Saving workspace changes"); expect(register.disabled).toBe(false);
  expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe(saved ? "status" : "alert");
  expect(workspaceSaveSession.getPending()).toBe(saved ? null : next);
  if (!saved) expect(host.textContent).toContain(workspaceSaveFailureMessage);
});
it.each([true, false])("settles only its acknowledged navigation after real Fast Refresh; saved=%s", async saved => {
  const receipt = delayed(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation(next => {
    workspaceSaveSession.remember(next); return receipt.promise;
  });
  const harness = await mount(workspace()); await click("New report");
  const control = button("New report"), next = save.mock.calls[0][0];
  expect(harness.change).toHaveBeenCalledExactlyOnceWith(next); expect(control.disabled).toBe(true);
  await harness.replay();
  expect(button("New report")).toBe(control); expect(control.disabled).toBe(true); expect(unload()).toBe(true); expect(window.location.hash).toBe("#/");
  await act(async () => { if (saved) workspaceSaveSession.remember(null); receipt.resolve(saved); });
  expect(window.location.hash).toBe(saved ? `#/reports/${next.activeReportId}` : "#/");
  expect(host.textContent).not.toContain("Saving workspace before opening"); expect(control.disabled).toBe(false);
  expect(save).toHaveBeenCalledOnce(); expect(harness.change).toHaveBeenCalledOnce();
  if (!saved) { expect(workspaceSaveSession.getPending()).toBe(next); expect(host.textContent).toContain(workspaceSaveFailureMessage); }
});
it.each([true, false])("settles a delayed managed response save after real Fast Refresh; saved=%s", async saved => {
  const value = workspace(), receipt = delayed(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ provider: "snowflake", connectionId: value.datasetConnections![0].id,
    status: "ready_to_verify", statusLabel: "Synthetic server ready", checkedAt: "2026-11-11T10:00:00Z", diagnostics: [], nextStep: "Review source" }) }));
  const harness = await mount(value);
  await act(async () => host.querySelector<HTMLButtonElement>('button[data-section="data"]')!.click());
  await click("Connect database"); await click("Check server readiness");
  const control = button("Checking..."); expect(save).toHaveBeenCalledOnce();
  expect(host.querySelector(".workspace-connection-verification")).toBeNull();
  await harness.replay();
  expect(button("Checking...")).toBe(control); expect(control.disabled).toBe(true); expect(unload()).toBe(true);
  expect(host.querySelector(".workspace-connection-verification")).toBeNull(); expect(save).toHaveBeenCalledOnce();
  await act(async () => receipt.resolve(saved));
  expect(button("Check server readiness")).toBe(control); expect(control.disabled).toBe(false);
  expect(host.querySelector(".workspace-connection-verification")?.textContent).toContain("Synthetic server ready");
  expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe(saved ? "status" : "alert");
  expect(workspaceSaveSession.getPending()).toBe(saved ? null : save.mock.calls[0][0]);
});
it.each(["route", "unmount"] as const)("still rejects a delayed mutation after Refresh followed by real %s change", async context => {
  const receipt = delayed(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const harness = await mount(workspace());
  await act(async () => host.querySelector<HTMLButtonElement>('button[data-section="data"]')!.click());
  await click("Register source"); await harness.replay();
  await act(async () => {
    if (context === "unmount") root.render(<p>Another screen</p>);
    else { window.history.replaceState(null, "", "/#/other"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
  });
  await act(async () => receipt.resolve(true));
  expect(harness.change).not.toHaveBeenCalled(); expect(host.querySelector(".workspace-live-source-row")).toBeNull();
  expect(host.querySelector(".studio-import-toast")).toBeNull(); expect(host.textContent).not.toContain("Saving workspace changes");
});
