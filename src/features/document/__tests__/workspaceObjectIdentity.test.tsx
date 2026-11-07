// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../App";
import { initialDashboard } from "../documentSeeds";
import { createCanvasElement } from "../../builder/builderDocumentCommands";
import { storageKey } from "../../builder/builderConstants";
import { createReportRecord, createPublishedSnapshot, duplicateReportRecord, legacyWorkspaceStorageKey, workspaceStorageKey, normalizeDashboardWorkspace, loadDashboardWorkspace, readStoredWorkspaceCopy, saveDashboardWorkspace } from "../workspacePersistence";
import { workspaceSaveSession } from "../workspaceSaveSession";

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Synthetic only")));
});
afterEach(() => { workspaceSaveSession.remember(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function fixture() {
  const dashboard = structuredClone(initialDashboard);
  dashboard.pages = [dashboard.pages[0]];
  dashboard.pages[0].elements = [createCanvasElement("text", dashboard.pages[0])];
  expect(dashboard.pages[0].tiles.length).toBeGreaterThan(0);
  return normalizeDashboardWorkspace({ reports: [createReportRecord(dashboard)] });
}
const mutations = {
  "duplicate page": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { draft.pages.push(structuredClone(draft.pages[0])); },
  "duplicate tile": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { draft.pages[0].tiles.push(structuredClone(draft.pages[0].tiles[0])); },
  "duplicate element": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { draft.pages[0].elements.push(structuredClone(draft.pages[0].elements[0])); },
  "tile/element collision": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { draft.pages[0].elements[0].id = draft.pages[0].tiles[0].id; },
  "missing page": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { Object.assign(draft.pages[0], { id: undefined }); },
  "empty tile": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { draft.pages[0].tiles[0].id = ""; },
  "non-string element": (draft: ReturnType<typeof fixture>["reports"][number]["draft"]) => { Object.assign(draft.pages[0].elements[0], { id: 7 }); },
};
describe.each([workspaceStorageKey, legacyWorkspaceStorageKey, storageKey])("canvas identity recovery from %s", key => {
  it.each(Object.entries(mutations))("rejects %s identities without changing source bytes", (_label, mutate) => {
    const workspace = fixture(); mutate(workspace.reports[0].draft);
    const raw = "\r\n" + JSON.stringify(key === storageKey ? workspace.reports[0].draft : workspace, null, 2) + "\r\n";
    localStorage.setItem(key, raw); const write = vi.spyOn(Storage.prototype, "setItem");
    expect(() => loadDashboardWorkspace()).toThrow("IDs");
    expect(readStoredWorkspaceCopy()).toBe(raw); expect(write).not.toHaveBeenCalled();
  });
});
it("does not autosave over an ambiguous canvas while App shows recovery", async () => {
  const workspace = fixture(); mutations["duplicate tile"](workspace.reports[0].draft);
  const raw = JSON.stringify(workspace); localStorage.setItem(workspaceStorageKey, raw);
  const write = vi.spyOn(Storage.prototype, "setItem"); vi.useFakeTimers();
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<App />)); await act(async () => vi.advanceTimersByTime(10000));
    expect(host.textContent).toContain("Your saved workspace needs attention");
    expect(host.querySelector(".builder-shell")).toBeNull(); expect(readStoredWorkspaceCopy()).toBe(raw); expect(write).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
it("permits object reuse on separate pages and in copied reports or historical snapshots", () => {
  const workspace = fixture(); const page = structuredClone(workspace.reports[0].draft.pages[0]); page.id += "_second";
  workspace.reports[0].draft.pages.push(page);
  const duplicated = duplicateReportRecord(workspace, workspace.reports[0]).workspace;
  const first = createPublishedSnapshot(duplicated, duplicated.reports[0].draft);
  const second = createPublishedSnapshot(first.workspace, first.dashboard);
  expect(saveDashboardWorkspace(second.workspace)).toBe(true);
  const loaded = loadDashboardWorkspace(); expect(loaded.reports).toHaveLength(2); expect(loaded.publishedSnapshots).toHaveLength(2);
  expect(loaded.reports[0].draft.pages[0].tiles[0].id).toBe(loaded.reports[0].draft.pages[1].tiles[0].id);
});
it("validates immutable snapshot canvases in their own scope", () => {
  const workspace = fixture(); const saved = createPublishedSnapshot(workspace, workspace.reports[0].draft).workspace;
  mutations["duplicate page"](saved.publishedSnapshots[0].dashboard);
  const raw = JSON.stringify(saved); localStorage.setItem(workspaceStorageKey, raw);
  expect(() => loadDashboardWorkspace()).toThrow("IDs"); expect(readStoredWorkspaceCopy()).toBe(raw);
});
