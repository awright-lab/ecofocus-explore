// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardWorkspace, ImportedDatasetRecord } from "../../../../shared/types/dashboard";
import App from "../../../App";
import { storageKey } from "../../builder/builderConstants";
import { initialDashboard } from "../documentSeeds";
import { createPublishedSnapshot, createReportRecord, duplicateReportRecord, legacyWorkspaceStorageKey, loadDashboardWorkspace, normalizeDashboardWorkspace, readStoredWorkspaceCopy, saveDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { WorkspaceLoadRecovery } from "../WorkspaceSaveRecovery";
import { workspaceSaveSession } from "../workspaceSaveSession";
import { encodeImportedRows } from "../workspaceRowStorage";
import { syntheticStudy } from "./fixtures/syntheticStudy";

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Synthetic offline test")));
});
afterEach(() => { workspaceSaveSession.remember(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
function fixture(study: ImportedDatasetRecord): DashboardWorkspace {
  const value = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] });
  value.importedDatasets = [structuredClone(study)];
  value.reports[0].draft.importedDatasets = [structuredClone(study)];
  return value;
}
const changes: Array<[string, (study: ImportedDatasetRecord) => void]> = [
  ["respondent values", study => { study.rows[0].Spend = "999"; }],
  ["respondent order", study => { study.rows.reverse(); }],
  ["preview values", study => { study.previewRows[0].Spend = "999"; }],
  ["value labels", study => { study.fields[1].valueLabels = { North: "Conflicting label" }; }],
  ["field metadata", study => { study.fields[0].label = "Different field label"; }],
  ["study metadata", study => { study.title = "Different study title"; }],
  ["notes", study => { study.notes.push("Uncertain legacy copy"); }],
  ["remote identity", study => { study.remote = { provider: "netlify", projectUrl: "", bucket: "fixture", objectPath: "different", uploadedAt: study.importedAt }; }],
  ["unknown extension data", study => { Object.assign(study, { futureExtension: { keep: "do not discard" } }); }]
];

describe.each([workspaceStorageKey, legacyWorkspaceStorageKey])("study conflicts in %s", key => {
  it.each(changes)("rejects conflicting %s across workspace/report before any write", async (_name, change) => {
    const { dataset } = await syntheticStudy(100, 4); const value = fixture(dataset);
    change(value.reports[0].draft.importedDatasets[0]);
    const raw = JSON.stringify(value, null, 2) + "\r\n"; localStorage.setItem(key, raw);
    const write = vi.spyOn(Storage.prototype, "setItem"); const remove = vi.spyOn(Storage.prototype, "removeItem");
    expect(() => loadDashboardWorkspace()).toThrow("share an ID but contain conflicting data");
    expect(readStoredWorkspaceCopy()).toBe(raw); expect(localStorage.getItem(key)).toBe(raw);
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  });
  it("also rejects conflicts between reports without a workspace-level study", async () => {
    const { dataset } = await syntheticStudy(100, 4); const value = fixture(dataset);
    const copy = structuredClone(value.reports[0]); copy.id = copy.draft.id = "another-report";
    copy.draft.importedDatasets[0].rows[0].Spend = "999";
    value.importedDatasets = []; value.reports.push(copy);
    const raw = JSON.stringify(value); localStorage.setItem(key, raw);
    expect(() => loadDashboardWorkspace()).toThrow("conflicting data"); expect(readStoredWorkspaceCopy()).toBe(raw);
  });
  it("does not fall back to a valid older source after a conflict", async () => {
    const { dataset } = await syntheticStudy(100, 4); const value = fixture(dataset);
    value.reports[0].draft.importedDatasets[0].rows[0].Spend = "999";
    const olderKey = key === workspaceStorageKey ? legacyWorkspaceStorageKey : storageKey;
    const olderRaw = JSON.stringify(olderKey === storageKey ? initialDashboard : normalizeDashboardWorkspace({ reports: [createReportRecord(initialDashboard)] }));
    localStorage.setItem(olderKey, olderRaw); const raw = JSON.stringify(value); localStorage.setItem(key, raw);
    expect(() => loadDashboardWorkspace()).toThrow("conflicting data"); expect(readStoredWorkspaceCopy()).toBe(raw); expect(localStorage.getItem(olderKey)).toBe(olderRaw);
  });
  it("accepts identical repeated records produced by duplicateReportRecord and preserves rows on save/reopen", async () => {
    const { dataset } = await syntheticStudy(100, 4);
    const normalized = normalizeDashboardWorkspace(fixture(dataset));
    const duplicated = duplicateReportRecord(normalized, normalized.reports[0]).workspace;
    localStorage.setItem(key, JSON.stringify(duplicated));
    const loaded = loadDashboardWorkspace(); expect(loaded.reports).toHaveLength(2);
    expect(loaded.importedDatasets).toHaveLength(1); expect(loaded.importedDatasets[0].rows).toEqual(dataset.rows);
    expect(saveDashboardWorkspace(loaded)).toBe(true); expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows);
  });
  it("accepts equivalent encoded/plain rows and reordered object keys", async () => {
    const { dataset } = await syntheticStudy(100, 4); const value = fixture(dataset);
    value.importedDatasets = [encodeImportedRows(dataset)];
    const reorder = (input: unknown): unknown => Array.isArray(input) ? input.map(reorder) : input && typeof input === "object"
      ? Object.fromEntries(Object.entries(input).reverse().map(([name, item]) => [name, reorder(item)])) : input;
    value.reports[0].draft.importedDatasets = [reorder(dataset) as ImportedDatasetRecord];
    localStorage.setItem(key, JSON.stringify(value));
    const loaded = loadDashboardWorkspace(); expect(loaded.importedDatasets[0].rows).toEqual(dataset.rows);
  });
  it("keeps historical snapshot studies in their own scope when their values differ", async () => {
    const { dataset } = await syntheticStudy(100, 4);
    const normalized = normalizeDashboardWorkspace(fixture(dataset));
    const published: DashboardWorkspace = JSON.parse(JSON.stringify(createPublishedSnapshot(normalized, normalized.reports[0].draft).workspace));
    published.importedDatasets[0].rows[0].Spend = "777";
    published.reports[0].draft.importedDatasets[0].rows[0].Spend = "777";
    localStorage.setItem(key, JSON.stringify(published));
    const loaded = loadDashboardWorkspace();
    expect(loaded.importedDatasets[0].rows[0].Spend).toBe("777");
    expect(loaded.publishedSnapshots[0].dashboard.importedDatasets[0].rows[0].Spend).toBe("1");
  });
  it("holds App in recovery across autosave time/navigation and downloads original conflicting bytes", async () => {
    const { dataset } = await syntheticStudy(100, 4); const value = fixture(dataset);
    value.label = "Synthetic Ω 🌱"; value.reports[0].draft.importedDatasets[0].rows[0].Spend = "999";
    const raw = "\r\n" + JSON.stringify(value, null, 2) + "\r\n"; localStorage.setItem(key, raw);
    const write = vi.spyOn(Storage.prototype, "setItem"); vi.useFakeTimers();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    let blob: Blob | undefined;
    vi.stubGlobal("URL", class extends URL { static createObjectURL(value: Blob) { blob = value; return "blob:synthetic"; } static revokeObjectURL() {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      await act(async () => root.render(<App />));
      await act(async () => { vi.advanceTimersByTime(10000); window.dispatchEvent(new HashChangeEvent("hashchange")); });
      expect(host.textContent).toContain("Your saved workspace needs attention"); expect(host.querySelector(".builder-shell")).toBeNull();
      await act(async () => root.render(<WorkspaceLoadRecovery />));
      await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Download saved workspace")!.click());
      expect(click).toHaveBeenCalledOnce(); expect(blob).toBeDefined();
      vi.useRealTimers();
      const bytes = await new Promise<Uint8Array>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.onerror = reject; reader.readAsArrayBuffer(blob!); });
      expect([...bytes]).toEqual([...new TextEncoder().encode(raw)]);
      expect(readStoredWorkspaceCopy()).toBe(raw); expect(write).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); host.remove(); }
  });
});

it("still migrates identical sparse legacy copies without inventing comparison defaults", async () => {
  const { dataset } = await syntheticStudy(100, 4);
  const sparse = { id: dataset.id, rowCount: dataset.rowCount, fields: dataset.fields.map(field => ({ label: field.sourceColumn })), rows: dataset.rows };
  const raw = JSON.stringify({ importedDatasets: [sparse], reports: [{ draft: { ...initialDashboard, importedDatasets: [sparse] } }] });
  localStorage.setItem(legacyWorkspaceStorageKey, raw);
  expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows); expect(readStoredWorkspaceCopy()).toBe(raw);
});
