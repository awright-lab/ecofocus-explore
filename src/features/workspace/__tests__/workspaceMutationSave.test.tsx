// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import { WorkspaceHome } from "../WorkspaceHome";
import { workspaceSaveFailureMessage, workspaceSaveSession } from "../../document/workspaceSaveSession";
import { createPublishedSnapshot, createReportRecord, normalizeDashboardWorkspace } from "../../document/workspacePersistence";
import { initialDashboard } from "../../document/documentSeeds";
import { syntheticStudy } from "../../document/__tests__/fixtures/syntheticStudy";
import { buildDatasetConnectionProfiles, buildLiveDatasetSourceDescriptorForConnection } from "../../data/datasetConnectionModel";
import { createLiveDatasetQueryDefinition } from "../../data/liveDatasetQueryDefinitionModel";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  window.history.replaceState(null, "", "/#/");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Synthetic offline test")));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null);
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function deferred() {
  let resolve!: (value: boolean) => void, reject!: (reason: Error) => void;
  const promise = new Promise<boolean>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function fixture() {
  const { dataset } = await syntheticStudy(12, 6), draft = structuredClone(initialDashboard);
  draft.importedDatasets = [{ ...structuredClone(dataset), title: "Historical study copy" }];
  const value = createPublishedSnapshot(normalizeDashboardWorkspace({
    reports: [createReportRecord(draft)], importedDatasets: [dataset],
  }), draft).workspace;
  const connection = buildDatasetConnectionProfiles()[0]; connection.status = "sync_ready";
  const source = buildLiveDatasetSourceDescriptorForConnection(connection);
  source.inspection = { status: "inspected", statusLabel: "Synthetic fields", inspectedAt: "2026-11-10T12:00:00Z",
    fields: [{ id: "answer", label: "Answer", rawName: "ANSWER", type: "text", modelingRole: "dimension" }], diagnostics: [], nextStep: "Review" };
  const definition = createLiveDatasetQueryDefinition(source)!; definition.id = "existing-definition";
  source.queryDefinitions = [definition]; value.datasetConnections = [connection]; value.liveDatasetSources = [source];
  return value;
}
function button(text: string, scope: ParentNode = host) {
  const node = Array.from(scope.querySelectorAll("button")).find(item => item.textContent?.trim() === text);
  expect(node, `Missing button: ${text}`).toBeTruthy(); return node!;
}
async function click(text: string, scope: ParentNode = host) { await act(async () => button(text, scope).click()); }
async function mount(value: DashboardWorkspace, onChange = vi.fn()) {
  let replace!: (next: DashboardWorkspace) => void;
  function Harness() {
    const [workspace, setWorkspace] = useState(value); replace = setWorkspace;
    return <WorkspaceHome workspace={workspace} onWorkspaceChange={next => { onChange(next); setWorkspace(next); }} />;
  }
  await act(async () => root.render(<Harness />));
  await act(async () => host.querySelector<HTMLButtonElement>('button[data-section="data"]')!.click());
  return { onChange, replace: (next: DashboardWorkspace) => replace(next) };
}
const mutations = ["plan", "remove plan", "register", "remove source", "mapping", "suggest roles", "field role", "definition", "remove definition"] as const;
type Mutation = typeof mutations[number];
async function begin(kind: Mutation) {
  if (kind === "plan") { await click("Connect database"); await click("Setup plan saved"); }
  if (kind === "remove plan") await click("Remove", host.querySelector(".workspace-connection-plan-row")!);
  if (kind === "register") await click("Register source", host.querySelector(".workspace-connection-plan-row")!);
  if (kind === "remove source") {
    const row = host.querySelector(".workspace-live-source-row")!;
    await act(async () => Array.from(row.querySelectorAll("button")).filter(node => node.textContent?.trim() === "Remove").at(-1)!.click());
  }
  if (kind === "mapping") { await click("Edit mapping"); await click("Save mapping"); }
  if (kind === "suggest roles") await click("Suggest roles");
  if (kind === "field role") await act(async () => {
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Model Answer"]')!;
    select.value = "unmodeled"; select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  if (kind === "definition") await click("Save definition");
  if (kind === "remove definition") await click("Remove", host.querySelector(".workspace-live-query-definition-row")!);
}
function unload() { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }
it.each(mutations)("awaits %s save acknowledgement and retains every study/history version", async kind => {
  const value = await fixture(), before = structuredClone(value), receipt = deferred();
  const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise), sync = vi.spyOn(workspaceSaveSession, "save");
  const { onChange } = await mount(value);
  await begin(kind);
  expect(save).toHaveBeenCalledOnce(); expect(sync).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Saving workspace changes"); expect(host.querySelector(".studio-import-toast")).toBeNull(); expect(unload()).toBe(true);
  const [next, recovery] = save.mock.calls[0];
  expect(recovery).toBe(kind.startsWith("remove") ? value : next);
  expect(next.importedDatasets).toEqual(before.importedDatasets); expect(next.reports).toEqual(before.reports); expect(next.publishedSnapshots).toEqual(before.publishedSnapshots);
  expect(value).toEqual(before);
  await act(async () => receipt.resolve(true));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(next); expect(host.textContent).not.toContain("Saving workspace changes");
  expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe("status"); expect(unload()).toBe(false);
});
it.each(mutations)("never announces failed %s as saved and preserves the right recovery copy", async kind => {
  const value = await fixture(), receipt = deferred();
  const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const { onChange } = await mount(value); await begin(kind);
  const [next, recovery] = save.mock.calls[0];
  await act(async () => receipt.resolve(false));
  if (kind.startsWith("remove")) expect(onChange).not.toHaveBeenCalled();
  else expect(onChange).toHaveBeenCalledExactlyOnceWith(next);
  expect(workspaceSaveSession.getPending()).toBe(recovery);
  expect(recovery).toBe(kind.startsWith("remove") ? value : next);
  expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe("alert");
  expect(host.querySelector(".studio-import-toast")?.textContent).toContain(workspaceSaveFailureMessage);
  if (kind.startsWith("remove")) {
    // Retrying the pre-removal recovery copy cannot announce that removal succeeded.
    await act(async () => workspaceSaveSession.remember(null));
    expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe("alert");
    expect(host.querySelector(".studio-import-toast")?.textContent).toContain("original workspace was kept");
  }
});
it("blocks repeated mutations while a removal is pending and never writes during unload", async () => {
  const value = await fixture(), receipt = deferred(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  await mount(value); await begin("remove source");
  await click("Register source", host.querySelector(".workspace-connection-plan-row")!);
  expect(unload()).toBe(true); expect(save).toHaveBeenCalledOnce();
  await act(async () => receipt.resolve(false));
});
it.each(["new workspace", "route", "unmount"] as const)("does not apply a completed removal after %s supersedes its owner", async context => {
  const value = await fixture(), receipt = deferred(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const harness = await mount(value); await begin("remove source");
  await act(async () => {
    if (context === "new workspace") harness.replace({ ...value, label: "Newer workspace" });
    if (context === "route") { window.history.replaceState(null, "", "/#/other"); window.dispatchEvent(new HashChangeEvent("hashchange")); }
    if (context === "unmount") root.render(<p>Another screen</p>);
  });
  await act(async () => receipt.resolve(true));
  expect(harness.onChange).not.toHaveBeenCalled(); expect(host.querySelector(".studio-import-toast")).toBeNull();
});
it("does not let a cancelled mapping save close a newer editor or overwrite its feedback", async () => {
  const value = await fixture(), receipt = deferred(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  await mount(value); await begin("mapping"); await click("Cancel"); await click("Edit mapping");
  await act(async () => receipt.resolve(true));
  expect(host.querySelector(".workspace-live-source-editor")).not.toBeNull(); expect(host.querySelector(".studio-import-toast")).toBeNull();
});
it("does not resurrect a rejected older write over a newer pending workspace", async () => {
  const value = await fixture(), receipt = deferred(); vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const harness = await mount(value); await begin("mapping");
  const newer = { ...value, label: "Newer pending workspace" };
  await act(async () => { workspaceSaveSession.remember(newer); harness.replace(newer); });
  await act(async () => receipt.reject(new Error("Late rejected acknowledgement")));
  expect(workspaceSaveSession.getPending()).toBe(newer); expect(harness.onChange).not.toHaveBeenCalled(); expect(host.querySelector(".studio-import-toast")).toBeNull();
});
it("refuses a new mutation while a different pending recovery copy owns the session", async () => {
  const value = await fixture(), newer = { ...value, label: "Unseen pending workspace" };
  const save = vi.spyOn(workspaceSaveSession, "saveAsync"), { onChange } = await mount(value);
  await act(async () => workspaceSaveSession.remember(newer)); await begin("mapping");
  expect(save).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled(); expect(workspaceSaveSession.getPending()).toBe(newer);
});

it("keeps a failed additive candidate visible through retry and the next mutation", async () => {
  const value = await fixture(); value.liveDatasetSources = [];
  const receipt = deferred(), save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValueOnce(receipt.promise);
  const { onChange } = await mount(value); await begin("register"); const failed = save.mock.calls[0][0];
  await act(async () => receipt.resolve(false));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(failed);
  expect(host.querySelector(".workspace-live-source-row")).not.toBeNull();
  await act(async () => { expect(await workspaceSaveSession.retryAsync()).toBe(true); });
  expect(workspaceSaveSession.hasPending()).toBe(false);
  await click("Edit mapping"); await click("Save mapping");
  expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[1][0].liveDatasetSources).toHaveLength(1);
  expect(save.mock.calls[1][0].liveDatasetSources![0].sourceRef.id).toBe(failed.liveDatasetSources![0].sourceRef.id);
  expect(save.mock.calls[1][0].reports).toEqual(value.reports);
  expect(save.mock.calls[1][0].importedDatasets).toEqual(value.importedDatasets);
});

it("does not upgrade an older failed mutation toast after an unrelated workspace replaces it", async () => {
  const value = await fixture(), receipt = deferred();
  vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const harness = await mount(value); await begin("mapping");
  await act(async () => receipt.resolve(false));
  expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe("alert");
  await act(async () => { workspaceSaveSession.remember(null); harness.replace({ ...value, label: "Independent workspace" }); });
  expect(host.querySelector(".studio-import-toast")).toBeNull();
});
it("retains a current rejected additive save and leaves its mapping editor open", async () => {
  const value = await fixture(), receipt = deferred();
  const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockReturnValue(receipt.promise);
  const harness = await mount(value); await begin("mapping");
  await act(async () => receipt.reject(new Error("Synthetic rejected writer")));
  expect(workspaceSaveSession.getPending()).toBe(save.mock.calls[0][0]);
  expect(harness.onChange).toHaveBeenCalledExactlyOnceWith(save.mock.calls[0][0]);
  expect(host.querySelector(".workspace-live-source-editor")).not.toBeNull();
  expect(host.querySelector(".studio-import-toast")?.getAttribute("role")).toBe("alert");
});
