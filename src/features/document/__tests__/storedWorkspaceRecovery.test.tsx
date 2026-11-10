// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { storageKey } from "../../builder/builderConstants";
import { initialDashboard } from "../documentSeeds";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, workspaceStorageKey, legacyWorkspaceStorageKey } from "../workspacePersistence";
import { createStoredRecoveryDownload, inspectStoredWorkspaceCopies } from "../storedWorkspaceRecovery";
import { WorkspaceLoadRecovery } from "../WorkspaceSaveRecovery";
import { importDatasetBuffer } from "../../data/datasetImportModel";

function workspace() { return normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))] }); }
function reader(values: Record<string, string>) { return { getItem: vi.fn((key: string) => values[key] ?? null) }; }
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("inspects all formats without falling back over a damaged current copy or writing", () => {
  const current = "{damaged", legacy = "  " + JSON.stringify(workspace()) + " ", report = JSON.stringify(initialDashboard);
  const storage = reader({ [workspaceStorageKey]: current, [legacyWorkspaceStorageKey]: legacy, [storageKey]: report });
  const copies = inspectStoredWorkspaceCopies(storage);
  expect(copies.map(copy => copy.status)).toEqual(["damaged", "readable", "readable"]);
  expect(copies.map(copy => copy.raw)).toEqual([current, legacy, report]);
  expect(storage.getItem.mock.calls.map(call => call[0])).toEqual([workspaceStorageKey, legacyWorkspaceStorageKey, storageKey]);
});
it("distinguishes missing, empty damaged and inaccessible sources independently", () => {
  const copies = inspectStoredWorkspaceCopies({ getItem: key => { if (key === workspaceStorageKey) throw new Error("Blocked"); return key === legacyWorkspaceStorageKey ? "" : null; } });
  expect(copies.map(copy => copy.status)).toEqual(["unavailable", "damaged", "missing"]);
  expect(copies[1].raw).toBe("");
  expect(() => createStoredRecoveryDownload(copies[0])).toThrow("unavailable");
});
it("retains original unknown content, whitespace and unpaired UTF-16 in recovery envelopes", () => {
  const raw = " \n" + JSON.stringify({ ...workspace(), extension: { untouched: "\ud800" } }) + "\t";
  const copy = inspectStoredWorkspaceCopies(reader({ [workspaceStorageKey]: raw }))[0];
  const artifact = JSON.parse(createStoredRecoveryDownload(copy));
  expect(artifact).toEqual({ kind: "ecofocus-saved-copy-recovery", version: 1, sourceKey: workspaceStorageKey, raw });
  const damaged = { ...copy, status: "damaged" as const, raw: "bad\ud800text" };
  expect(JSON.parse(createStoredRecoveryDownload(damaged)).raw).toBe(damaged.raw);
});
it("reports snapshot counts and incomplete remote study coverage without claiming remote access", async () => {
  const parsed = await importDatasetBuffer(new TextEncoder().encode("Region,Spend\nNorth,10\nSouth,20\n").buffer, "synthetic.csv");
  const value = workspace(), dataset = parsed.dataset!;
  dataset.rows = []; dataset.previewRows = []; dataset.remote = { provider: "netlify", projectUrl: "https://example.invalid", bucket: "synthetic", objectPath: "synthetic", uploadedAt: "2026-11-05T00:00:00Z" };
  value.importedDatasets = [dataset];
  const snapshot = createPublishedSnapshot(value, value.reports[0].draft).workspace;
  const copy = inspectStoredWorkspaceCopies(reader({ [workspaceStorageKey]: JSON.stringify(snapshot) }))[0];
  expect(copy.status).toBe("readable");
  expect(copy.summary).toMatchObject({ reports: 1, snapshots: 1, currentStudies: 1, needsSourceData: true, needsRemoteAccess: true });
});
it("preserves an inspected recovery point if storage changes before download", () => {
  const values = { [workspaceStorageKey]: "original damaged text" }, storage = reader(values);
  const copies = inspectStoredWorkspaceCopies(storage);
  values[workspaceStorageKey] = "newer damaged text";
  expect(JSON.parse(createStoredRecoveryDownload(copies[0])).raw).toBe("original damaged text");
  expect(inspectStoredWorkspaceCopies(storage)[0].raw).toBe("newer damaged text");
});
it("reports blocked browser storage as unavailable rather than absent", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
  expect(inspectStoredWorkspaceCopies().map(copy => copy.status)).toEqual(["unavailable", "unavailable", "unavailable"]);
});
it("does not expose respondent fragments when malformed JSON cannot be read", () => {
  const copy = inspectStoredWorkspaceCopies(reader({ [workspaceStorageKey]: '{"respondent":"private-fragment"' }))[0];
  expect(copy.status).toBe("damaged"); expect(copy.summary).toBeNull(); expect(copy).not.toHaveProperty("error");
});
it("waits for inspection, exposes separate recovery copies and leaves active storage untouched", async () => {
  const raw = "{damaged", legacy = JSON.stringify(workspace()); localStorage.setItem(workspaceStorageKey, raw); localStorage.setItem(legacyWorkspaceStorageKey, legacy);
  const write = vi.spyOn(Storage.prototype, "setItem"), remove = vi.spyOn(Storage.prototype, "removeItem"), read = vi.spyOn(Storage.prototype, "getItem");
  const host = document.createElement("div"), root = createRoot(host); document.body.append(host);
  try {
    await act(async () => root.render(<WorkspaceLoadRecovery />)); expect(read).not.toHaveBeenCalled();
    const inspect = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Inspect saved copies")!;
    await act(async () => inspect.click());
    const section = host.querySelector('section[aria-label="Saved browser copies"]')!;
    expect(section.textContent).toContain("Current workspace"); expect(section.textContent).toContain("Legacy workspace"); expect(section.textContent).toContain("Readable copy"); expect(section.textContent).toContain("No saved copy found");
    expect(section.querySelectorAll("button")).toHaveLength(2); expect(section.textContent).toContain("Restoring a copy is not yet available");
    expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); expect(localStorage.getItem(legacyWorkspaceStorageKey)).toBe(legacy);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("downloads the inspected source envelope and reports download failures without writes", async () => {
  const raw = "original damaged copy", values = { [workspaceStorageKey]: raw }, storage = reader(values);
  const parts: BlobPart[][] = [], names: string[] = [];
  vi.useFakeTimers();
  const NativeBlob = Blob;
  vi.stubGlobal("Blob", class extends NativeBlob { constructor(value: BlobPart[] = [], options?: BlobPropertyBag) { parts.push(value); super(value, options); } });
  const create = vi.fn(() => "blob:synthetic-recovery"), revoke = vi.fn();
  vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { names.push(this.download); });
  const write = vi.spyOn(Storage.prototype, "setItem");
  const host = document.createElement("div"), root = createRoot(host); document.body.append(host);
  try {
    await act(async () => root.render(<WorkspaceLoadRecovery inspectCopies={() => inspectStoredWorkspaceCopies(storage)} />));
    await act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Inspect saved copies")!.click());
    values[workspaceStorageKey] = "newer copy";
    const download = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Download current workspace recovery copy")!;
    await act(async () => download.click());
    expect(JSON.parse(String(parts[0][0]))).toMatchObject({ kind: "ecofocus-saved-copy-recovery", version: 1, sourceKey: workspaceStorageKey, raw });
    expect(names).toEqual(["insightcanvas-workspace-v2-recovery.json"]);
    create.mockImplementation(() => { throw new Error("Blocked synthetic download"); });
    await act(async () => download.click()); expect(host.textContent).toContain("recovery copy could not be downloaded"); expect(write).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers(); }
});
