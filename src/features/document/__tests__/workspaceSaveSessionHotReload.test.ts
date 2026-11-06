// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBrowserWorkspaceSaveSession, type WorkspaceSessionHotContext } from "../workspaceSaveSession";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, readStoredWorkspaceCopy, saveDashboardWorkspace } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { formulaFixture } from "../../metrics/__tests__/formulaFixture";
import { commitCellFormula, previewCellFormula } from "../../metrics/cellFormulaCommands";

function hotContext(data: Record<string, unknown> = {}) {
  let callback: ((data: Record<string, unknown>) => void) | undefined;
  const hot: WorkspaceSessionHotContext = { data, dispose: next => { callback = next; } };
  return { hot, dispose() { expect(callback).toBeTypeOf("function"); callback!(data); return data; } };
}
function seed() {
  const value = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] });
  value.label = "Synthetic older mounted revision";
  expect(saveDashboardWorkspace(value)).toBe(true);
  return value;
}
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

it("supports a production runtime with hot reload explicitly disabled", () => {
  const value = seed(), cold = createBrowserWorkspaceSaveSession(false);
  expect(cold.load().label).toBe(value.label); expect(cold.save({ ...value, label: "Production edit" })).toBe(true);
});

it("keeps the loaded version guard across module disposal instead of adopting a foreign baseline", () => {
  seed(); const first = hotContext(), before = createBrowserWorkspaceSaveSession(first.hot), mounted = before.load();
  expect(saveDashboardWorkspace({ ...mounted, label: "Synthetic newer saved revision" })).toBe(true);
  const newerBytes = readStoredWorkspaceCopy(), replacement = createBrowserWorkspaceSaveSession(hotContext(first.dispose()).hot);
  expect(replacement.load().label).toBe("Synthetic newer saved revision");
  expect(replacement.save(mounted)).toBe(false); expect(replacement.getFailure()).toBe("conflict");
  expect(readStoredWorkspaceCopy()).toBe(newerBytes); expect(replacement.getPending()).toBe(mounted);
  expect(before.getPending()).toBe(mounted); expect(before.retry()).toBe(false);
  expect(readStoredWorkspaceCopy()).toBe(newerBytes);
});

it("retains the guard when a dependency is reevaluated without its disposer being called", () => {
  seed(); const first = hotContext(), before = createBrowserWorkspaceSaveSession(first.hot), mounted = before.load();
  expect(saveDashboardWorkspace({ ...mounted, label: "Foreign saved revision" })).toBe(true);
  const stored = readStoredWorkspaceCopy();
  // Vite disposes the accepted React boundary, not necessarily this dependency.
  const replacement = createBrowserWorkspaceSaveSession(hotContext(first.hot.data).hot);
  expect(replacement.save(mounted)).toBe(false); expect(replacement.getFailure()).toBe("conflict");
  expect(readStoredWorkspaceCopy()).toBe(stored); expect(before.getPending()).toBe(mounted);
});

it("retains pending edits, conflict status and existing subscriptions across repeated replacements", () => {
  seed(); const first = hotContext(), original = createBrowserWorkspaceSaveSession(first.hot), edits = original.load();
  edits.label = "Unsaved synthetic edits";
  expect(saveDashboardWorkspace({ ...edits, label: "Foreign saved body" })).toBe(true);
  const listener = vi.fn(), unsubscribe = original.subscribe(listener);
  expect(original.save(edits)).toBe(false); const stored = readStoredWorkspaceCopy();
  const second = hotContext(first.dispose()), updated = createBrowserWorkspaceSaveSession(second.hot);
  expect(updated.load()).toBe(edits); expect(updated.getFailure()).toBe("conflict");
  expect(updated.retry()).toBe(false); expect(listener).toHaveBeenCalledTimes(2);
  const third = createBrowserWorkspaceSaveSession(hotContext(second.dispose()).hot);
  expect(third.retry()).toBe(false); expect(readStoredWorkspaceCopy()).toBe(stored);
  unsubscribe(); expect(third.retry()).toBe(false); expect(listener).toHaveBeenCalledTimes(3);
});

it("retains failed own edits and permits an explicit retry after a transient quota failure", () => {
  seed(); const first = hotContext(), original = createBrowserWorkspaceSaveSession(first.hot), edits = original.load();
  const stored = readStoredWorkspaceCopy(); edits.label = "Pending quota edits";
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Synthetic quota", "QuotaExceededError"); });
  expect(original.save(edits)).toBe(false); const updated = createBrowserWorkspaceSaveSession(hotContext(first.dispose()).hot);
  expect(updated.load()).toBe(edits); expect(updated.getFailure()).toBe("storage"); expect(readStoredWorkspaceCopy()).toBe(stored);
  failure.mockRestore(); expect(updated.retry()).toBe(true); expect(updated.hasPending()).toBe(false);
  expect(loadDashboardWorkspace().label).toBe("Pending quota edits");
});

it("preserves acknowledged own versions and starts a fresh session only on a cold load", () => {
  seed(); const first = hotContext(), original = createBrowserWorkspaceSaveSession(first.hot), value = original.load();
  expect(original.save({ ...value, label: "First own edit" })).toBe(true);
  const updated = createBrowserWorkspaceSaveSession(hotContext(first.dispose()).hot);
  expect(updated.save({ ...value, label: "Second own edit" })).toBe(true);
  expect(updated.getFailure()).toBeNull();
  expect(saveDashboardWorkspace({ ...value, label: "Foreign current revision" })).toBe(true);
  expect(updated.save(value)).toBe(false);
  const cold = createBrowserWorkspaceSaveSession(hotContext().hot);
  expect(cold.load().label).toBe("Foreign current revision"); expect(cold.hasPending()).toBe(false);
  expect(cold.save({ ...cold.load(), label: "Cold session reviewed edit" })).toBe(true);
});

it.each([null, { version: 2, listeners: new Set() }, { version: 1, listeners: [] }])("refuses incompatible retained memory without restarting saving (%j)", retained => {
  seed(); const stored = readStoredWorkspaceCopy(), write = vi.spyOn(Storage.prototype, "setItem");
  expect(() => createBrowserWorkspaceSaveSession(hotContext({ workspaceSessionMemory: retained }).hot)).toThrow("Preserve open edits");
  expect(readStoredWorkspaceCopy()).toBe(stored); expect(write).not.toHaveBeenCalled();
});

it("preserves the entire newer study, formula and pages through stale refresh and cold reopen", async () => {
  const { draft, plan } = await formulaFixture();
  const older = normalizeDashboardWorkspace({ reports: [createReportRecord(draft)], importedDatasets: draft.importedDatasets });
  expect(saveDashboardWorkspace(older)).toBe(true);
  const first = hotContext(), oldTab = createBrowserWorkspaceSaveSession(first.hot), mounted = oldTab.load();
  const created = commitCellFormula(draft, plan, previewCellFormula(draft, plan).token, "create").draft;
  const newer = normalizeDashboardWorkspace({ reports: [createReportRecord(created)], importedDatasets: created.importedDatasets });
  expect(saveDashboardWorkspace(newer)).toBe(true); const saved = readStoredWorkspaceCopy(), expected = loadDashboardWorkspace();
  const refreshedTab = createBrowserWorkspaceSaveSession(hotContext(first.dispose()).hot);
  expect(refreshedTab.save(mounted)).toBe(false); expect(readStoredWorkspaceCopy()).toBe(saved);
  expect(refreshedTab.getPending()).toEqual(mounted);
  const coldTab = createBrowserWorkspaceSaveSession(hotContext().hot);
  expect(coldTab.load()).toEqual(expected); expect(coldTab.load().reports[0].draft.pages).toHaveLength(2);
  expect(coldTab.load().importedDatasets).toEqual(expected.importedDatasets);
  expect(readStoredWorkspaceCopy()).toBe(saved);
});
