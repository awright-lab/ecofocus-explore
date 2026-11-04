// @vitest-environment jsdom
import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BuilderApp from "../../builder/BuilderApp";
import { WorkspaceHome } from "../../workspace/WorkspaceHome";
import { WorkspaceSaveRecovery } from "../WorkspaceSaveRecovery";
import { workspaceSaveSession } from "../workspaceSaveSession";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
import { initialDashboard } from "../documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";
import App from "../../../App";

const importFile = vi.hoisted(() => vi.fn());
vi.mock("../../data/importDatasetWorkspaceService", () => ({
  importDatasetForWorkspace: importFile,
  importedDatasetImportFeedback: () => "Imported study with 30 rows and 2 fields."
}));
// Keep real editor/header commands and persistence; canvas geometry is unrelated
// to storage failure and requires browser layout, which jsdom does not provide.
vi.mock("../../builder/components/CanvasWorkspace", () => ({ CanvasWorkspace: () => <div>Report canvas</div> }));

describe("workspace save recovery UI", () => {
  let root: Root;
  let host: HTMLDivElement;
  let baseline: DashboardWorkspace;
  let lastSaved: string;
  let writeFailure: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("No live service in UI tests")));
    vi.useFakeTimers();
    localStorage.clear();
    workspaceSaveSession.remember(null);
    window.history.replaceState(null, "", "#/");
    const parsed = await importDatasetBuffer(new TextEncoder().encode("Segment,Spend\n" + Array.from({ length: 30 }, (_, index) => `${index < 20 ? "Core" : "Growth"},${index + 1}`).join("\n")).buffer, "study.csv");
    baseline = normalizeDashboardWorkspace({ reports: [createReportRecord(structuredClone(initialDashboard))], importedDatasets: [parsed.dataset!] });
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    lastSaved = localStorage.getItem(workspaceStorageKey)!;
    importFile.mockResolvedValue({ dataset: { ...parsed.dataset!, id: "new-study" }, storage: { provider: "local", stored: false } });
    writeFailure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    workspaceSaveSession.remember(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function button(text: string) {
    const found = Array.from(host.querySelectorAll("button")).find((node) => node.textContent?.replace(/\s+/g, "") === text.replace(/\s+/g, "") || node.getAttribute("aria-label") === text);
    expect(found, `button ${text}`).toBeTruthy();
    return found!;
  }

  async function editor() {
    window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<StrictMode><WorkspaceSaveRecovery /><BuilderApp /></StrictMode>));
  }

  it("reports failed autosave, protects unload, downloads complete recovery data, and retries", async () => {
    await editor();
    await act(async () => vi.advanceTimersByTime(1000));
    expect(host.querySelector(".workspace-save-state.error")?.textContent).toBe("Changes not saved");
    expect(host.querySelector('[aria-label="Workspace not saved"]')?.textContent).toContain("Keep this tab open");
    expect(host.querySelector(".workspace-save-state.saved")).toBeNull();
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
    const unload = new Event("beforeunload", { cancelable: true });
    await act(async () => window.dispatchEvent(unload));
    expect(unload.defaultPrevented).toBe(true);

    vi.useRealTimers();
    let downloaded: Blob | undefined;
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL(blob: Blob) { downloaded = blob; return "blob:recovery"; }
      static revokeObjectURL() {}
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await act(async () => button("Download workspace backup").click());
    expect(click).toHaveBeenCalledOnce();
    let text = "";
    await act(async () => {
      text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(downloaded!); });
    });
    expect(JSON.parse(text).importedDatasets[0].rows).toHaveLength(30);
    expect(workspaceSaveSession.hasPending()).toBe(true);

    writeFailure.mockRestore();
    await act(async () => button("Retry saving").click());
    expect(host.querySelector('[aria-label="Workspace not saved"]')).toBeNull();
    expect(host.querySelector(".workspace-save-state.saved")?.textContent).toBe("Saved locally");
    expect(loadDashboardWorkspace().importedDatasets[0].rows).toHaveLength(30);
  });

  it("keeps failed publication in the draft editor and publishes only after storage recovers", async () => {
    await editor();
    await act(async () => button("Share").click());
    expect(window.location.hash).toBe(`#/reports/${baseline.reports[0].id}`);
    expect(host.querySelector(".published-shell")).toBeNull();
    expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
    expect(workspaceSaveSession.getPending()?.reports[0].draft.publishMetadata.publishCount).toBe(0);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
    writeFailure.mockRestore();
    await act(async () => button("Retry saving").click());
    expect(window.location.hash).toContain("/reports/");
    await act(async () => button("Share").click());
    expect(window.location.hash).toContain("/published/");
    expect(host.querySelector(".published-shell")).not.toBeNull();
    expect(loadDashboardWorkspace().publishedSnapshots).toHaveLength(1);
  });

  it("reports import save failure and retains full imported data across route remounts", async () => {
    function Home() {
      const [workspace, setWorkspace] = useState(() => workspaceSaveSession.load());
      return <><WorkspaceSaveRecovery /><WorkspaceHome workspace={workspace} onWorkspaceChange={setWorkspace} /></>;
    }
    await act(async () => root.render(<Home />));
    const input = host.querySelector('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new File(["synthetic"], "study.csv")], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(host.querySelector(".studio-import-toast.error")?.textContent).toContain("could not be saved");
    expect(host.querySelector(".studio-import-toast.success")).toBeNull();
    expect(workspaceSaveSession.getPending()?.importedDatasets.find((dataset) => dataset.id === "new-study")?.rows).toHaveLength(30);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
    await act(async () => root.render(<Home key="new-route" />));
    await act(async () => button("Study library 2").click());
    expect(host.textContent).toContain("study.csv");
    writeFailure.mockRestore();
    await act(async () => button("Retry saving").click());
    expect(loadDashboardWorkspace().importedDatasets).toHaveLength(2);
    expect(loadDashboardWorkspace().importedDatasets.every((dataset) => dataset.rows.length === 30)).toBe(true);
  });

  it("flushes the latest editor change before hash navigation, even inside the autosave delay", async () => {
    window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<App />));
    await act(async () => button(baseline.reports[0].title).click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Unsaved revision");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    // Navigate before the 900 ms autosave timer runs.
    await act(async () => {
      window.history.pushState(null, "", "#/");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Unsaved revision");
    expect(host.textContent).toContain("Unsaved revision");
    expect(host.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });
});
