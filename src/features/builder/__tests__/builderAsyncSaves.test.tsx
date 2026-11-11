// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BuilderApp from "../BuilderApp";
import type { AnalysisAuthoringPanelProps } from "../components/AnalysisAuthoringPanel";
import { workspaceSaveSession } from "../../document/workspaceSaveSession";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace } from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";

const callbacks = vi.hoisted(() => ({ panel: null as AnalysisAuthoringPanelProps | null, importFile: vi.fn() }));
vi.mock("../components/AnalysisAuthoringPanel", () => ({ AnalysisAuthoringPanel: (props: AnalysisAuthoringPanelProps) => { callbacks.panel = props; return null; } }));
vi.mock("../components/CanvasWorkspace", () => ({ CanvasWorkspace: () => <div>Canvas</div> }));
vi.mock("../../data/importDatasetWorkspaceService", () => ({ importDatasetForWorkspace: callbacks.importFile }));
let root: Root, host: HTMLDivElement, baseline: DashboardWorkspace;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("No service call in synthetic tests")));
  vi.useFakeTimers(); localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  const parsed = await importDatasetBuffer(new TextEncoder().encode("Group,Value\nA,1\nB,2\n").buffer, "synthetic.csv");
  baseline = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [parsed.dataset!] });
  expect(saveDashboardWorkspace(baseline)).toBe(true);
  window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  callbacks.importFile.mockResolvedValue({ dataset: { ...parsed.dataset!, id: "new-study", sourceFingerprint: undefined, fileName: "distinct.csv", rows: [{ Group: "C", Value: "3" }] }, storage: { provider: "local", stored: false } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function editor() { await act(async () => root.render(<BuilderApp initialWorkspace={baseline}/>)); }
async function rename(title: string) {
  const trigger = Array.from(host.querySelectorAll("button")).find(button => button.querySelector("strong")?.textContent === baseline.reports[0].title)!;
  await act(async () => trigger.click());
  const input = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, title); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
}
function delaySaves() {
  const acknowledgements: Array<(saved: boolean) => void> = [];
  const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation((next, recovery = next) => {
    workspaceSaveSession.remember(recovery);
    return new Promise<boolean>(resolve => acknowledgements.push(resolve));
  });
  return { save, acknowledgements };
}
it("uses an async-loaded initial workspace without calling the standalone sync loader", async () => {
  const load = vi.spyOn(workspaceSaveSession, "load"); await editor(); expect(load).not.toHaveBeenCalled();
});
it("captures command-time edits synchronously on unload without starting a save", async () => {
  const save = vi.spyOn(workspaceSaveSession, "saveAsync"); await editor();
  const clean = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
  await rename("Captured before unload");
  const event = new Event("beforeunload", { cancelable: true });
  await act(async () => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true); expect(save).not.toHaveBeenCalled();
  expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Captured before unload");
});
it("retains the route capture before the async write resolves", async () => {
  const { save, acknowledgements } = delaySaves(); await editor(); await rename("Route capture");
  await act(async () => { window.history.replaceState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
  expect(save).toHaveBeenCalledOnce(); expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Route capture");
  await act(async () => acknowledgements[0](false)); expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Route capture");
});
it.each([true, false])("awaits field settings acknowledgement (saved=%s)", async saved => {
  const { save, acknowledgements } = delaySaves(); await editor(); let result: boolean | void = undefined;
  const study = baseline.importedDatasets[0]; let pending!: Promise<boolean | void>;
  await act(async () => { pending = Promise.resolve(callbacks.panel!.updateImportedDatasetField(study.id, study.fields[0].id, { researchTopic: "Trust" })).then(value => { result = value; return value; }); });
  expect(result).toBeUndefined(); expect(save).toHaveBeenCalledOnce();
  expect(workspaceSaveSession.getPending()?.importedDatasets[0].fields[0].researchTopic).toBe("Trust");
  await act(async () => { acknowledgements[0](saved); await pending; }); expect(result).toBe(saved);
});
it("does not acknowledge an old field change over newer report edits", async () => {
  const { acknowledgements } = delaySaves(); await editor(); const study = baseline.importedDatasets[0]; let pending!: Promise<boolean | void>;
  await act(async () => { pending = Promise.resolve(callbacks.panel!.updateImportedDatasetField(study.id, study.fields[0].id, { researchTopic: "Old labels" })); });
  await rename("New report edit"); await act(async () => acknowledgements[0](true)); expect(await pending).toBe(false);
  expect(host.textContent).toContain("New report edit"); expect(host.textContent).not.toContain("Saved just now");
});
it.each([true, false])("retains pre-removal rows until its own acknowledgement (saved=%s)", async saved => {
  const { save, acknowledgements } = delaySaves(); await editor(); const study = baseline.importedDatasets[0]; let pending!: Promise<string | null>;
  await act(async () => { pending = Promise.resolve(callbacks.panel!.removeImportedDataset(study.id)); });
  expect(callbacks.panel!.importedDatasets).toHaveLength(1); expect(save.mock.calls[0][0].importedDatasets).toHaveLength(0);
  expect(save.mock.calls[0][1]?.importedDatasets[0].rows).toEqual(study.rows);
  expect(workspaceSaveSession.getPending()?.importedDatasets[0].rows).toEqual(study.rows);
  await act(async () => { acknowledgements[0](saved); await pending; });
  expect((await pending) === null).toBe(saved); expect(callbacks.panel!.importedDatasets).toHaveLength(saved ? 0 : 1);
});
it("does not apply delayed removal after a newer edit", async () => {
  const { acknowledgements } = delaySaves(); await editor(); const study = baseline.importedDatasets[0]; let pending!: Promise<string | null>;
  await act(async () => { pending = Promise.resolve(callbacks.panel!.removeImportedDataset(study.id)); });
  await rename("Kept newer editor"); await act(async () => acknowledgements[0](true));
  expect(await pending).not.toBeNull(); expect(callbacks.panel!.importedDatasets[0].rows).toEqual(study.rows); expect(host.textContent).toContain("Kept newer editor");
});
it.each([true, false])("waits for import storage before reporting it usable (saved=%s)", async saved => {
  const { save, acknowledgements } = delaySaves(); await editor(); let pending!: ReturnType<AnalysisAuthoringPanelProps["importDataset"]>; let completed = false;
  await act(async () => { pending = callbacks.panel!.importDataset(new File(["synthetic"], "distinct.csv")).then(value => { completed = true; return value; }); });
  expect(save).toHaveBeenCalledOnce(); expect(completed).toBe(false);
  await act(async () => { acknowledgements[0](saved); await pending; });
  expect(Boolean(await pending)).toBe(saved); expect(callbacks.panel!.importedDatasets).toHaveLength(2);
});
it("ignores a late import acknowledgement after newer editor changes", async () => {
  const { acknowledgements } = delaySaves(); await editor(); let pending!: ReturnType<AnalysisAuthoringPanelProps["importDataset"]>;
  await act(async () => { pending = callbacks.panel!.importDataset(new File(["synthetic"], "distinct.csv")); });
  await rename("Newer import-time edit"); await act(async () => acknowledgements[0](true));
  expect(await pending).toBeNull(); expect(host.textContent).toContain("Newer import-time edit");
  expect(callbacks.panel!.importedDatasets).toHaveLength(2); expect(host.textContent).not.toContain("Saved just now");
});
it("keeps the pre-operation copy when asynchronous removal rejects", async () => {
  const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockRejectedValue(Error("Synthetic transaction failure"));
  await editor(); const study = baseline.importedDatasets[0]; let result: string | null = null;
  await act(async () => { result = await callbacks.panel!.removeImportedDataset(study.id); });
  expect(save).toHaveBeenCalledOnce(); expect(result).toContain("could not be saved");
  expect(workspaceSaveSession.getPending()?.importedDatasets[0].rows).toEqual(study.rows); expect(callbacks.panel!.importedDatasets).toHaveLength(1);
});
it("does not publish late mutation feedback after route ownership changes", async () => {
  const { acknowledgements } = delaySaves(); await editor(); const study = baseline.importedDatasets[0]; let pending!: Promise<boolean | void>;
  await act(async () => { pending = Promise.resolve(callbacks.panel!.updateImportedDatasetField(study.id, study.fields[0].id, { researchTopic: "Old labels" })); });
  await act(async () => { window.history.replaceState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
  await act(async () => acknowledgements[0](true)); expect(await pending).toBe(false); expect(host.textContent).not.toContain("Saved just now");
});
