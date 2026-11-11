// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AnalysisAuthoringPanelProps } from "../components/AnalysisAuthoringPanel";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import { workspaceSaveSession } from "../../document/workspaceSaveSession";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace } from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";

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
const callbacks = vi.hoisted(() => ({ panel: null as AnalysisAuthoringPanelProps | null }));
vi.mock("../components/AnalysisAuthoringPanel", () => ({
  AnalysisAuthoringPanel: (props: AnalysisAuthoringPanelProps) => { callbacks.panel = props; return null; },
}));
vi.mock("../components/CanvasWorkspace", () => ({ CanvasWorkspace: () => <div>Canvas</div> }));
import BuilderApp from "../BuilderApp";

let root: Root, host: HTMLDivElement, baseline: DashboardWorkspace;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("No service calls in synthetic tests")));
  vi.useFakeTimers();
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  const parsed = await importDatasetBuffer(new TextEncoder().encode("Group,Value\nA,1\nB,2\n").buffer, "synthetic.csv");
  baseline = normalizeDashboardWorkspace({
    reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [parsed.dataset!],
  });
  expect(saveDashboardWorkspace(baseline)).toBe(true);
  window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); workspaceSaveSession.remember(null);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});
function delayedSave() {
  let resolve!: (saved: boolean) => void;
  const promise = new Promise<boolean>(yes => { resolve = yes; });
  const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation((next, recovery = next) => {
    workspaceSaveSession.remember(recovery);
    return promise;
  });
  return { save, resolve };
}
async function rename(title: string) {
  const trigger = Array.from(host.querySelectorAll("button")).find(button => button.querySelector("strong")?.textContent === baseline.reports[0].title)!;
  await act(async () => trigger.click());
  const input = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, title);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
}

it.each([true, false])("awaits its owned field save across actual Fast Refresh and resumes autosave (saved=%s)", async saved => {
  const { save, resolve } = delayedSave();
  function BeforeRefresh() { return BuilderApp({ initialWorkspace: baseline }); }
  refresh.register(BeforeRefresh, `BuilderAsyncSave-${saved}`);
  await act(async () => root.render(<BeforeRefresh />));
  const study = baseline.importedDatasets[0];
  let result!: Promise<boolean | void>;
  await act(async () => {
    result = Promise.resolve(callbacks.panel!.updateImportedDatasetField(study.id, study.fields[0].id, { researchTopic: "Pending field save" }));
  });
  expect(save).toHaveBeenCalledOnce();

  function AfterRefresh() { return BuilderApp({ initialWorkspace: baseline }); }
  refresh.register(AfterRefresh, `BuilderAsyncSave-${saved}`);
  await act(async () => { refresh.performReactRefresh(); });
  await act(async () => {
    if (saved) expect(workspaceSaveSession.save(save.mock.calls[0][0])).toBe(true);
    resolve(saved);
    await result;
  });
  expect(await result).toBe(saved);
  await rename("Later edit must autosave");
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0].reports[0].draft.title).toBe("Later edit must autosave");
});

it("does not restore field-save ownership after actual unmount", async () => {
  const { save, resolve } = delayedSave();
  await act(async () => root.render(<BuilderApp initialWorkspace={baseline} />));
  const study = baseline.importedDatasets[0];
  let result!: Promise<boolean | void>;
  await act(async () => {
    result = Promise.resolve(callbacks.panel!.updateImportedDatasetField(study.id, study.fields[0].id, { researchTopic: "Unmounted save" }));
  });
  await act(async () => root.render(<p>Another screen</p>));
  await act(async () => {
    expect(workspaceSaveSession.save(save.mock.calls[0][0])).toBe(true);
    resolve(true);
    await result;
  });
  expect(await result).toBe(false);
  expect(host.textContent).toBe("Another screen");
});
