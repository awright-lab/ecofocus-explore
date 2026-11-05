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
import type { DashboardPage, DashboardWorkspace } from "../../../../shared/types/dashboard";
import App from "../../../App";
import { deferredWorkspaceImports } from "../deferredWorkspaceImports";

const importFile = vi.hoisted(() => vi.fn());
vi.mock("../../data/importDatasetWorkspaceService", () => ({
  importDatasetForWorkspace: importFile,
  importedDatasetImportFeedback: () => "Imported study with 30 rows and 2 fields."
}));
// Keep real editor/header commands and persistence; canvas geometry is unrelated
// to storage failure and requires browser layout, which jsdom does not provide.
vi.mock("../../builder/components/CanvasWorkspace", () => ({ CanvasWorkspace: ({ activePage, onSelectTile }: { activePage: DashboardPage; onSelectTile: (id: string) => void }) => <div>
  Report canvas
  <output data-testid="canvas-state">{JSON.stringify(activePage)}</output>
  <button type="button" onClick={() => onSelectTile(activePage.tiles[0].id)}>Select first test tile</button>
</div> }));

describe("workspace save recovery UI", () => {
  let root: Root;
  let host: HTMLDivElement;
  let baseline: DashboardWorkspace;
  let lastSaved: string;
  let writeFailure: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.open = true; } });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("No live service in UI tests")));
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    workspaceSaveSession.remember(null);
    deferredWorkspaceImports.clear();
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
    deferredWorkspaceImports.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function button(text: string) {
    const found = Array.from(host.querySelectorAll("button")).find((node) => node.textContent?.replace(/\s+/g, "") === text.replace(/\s+/g, "") || node.getAttribute("aria-label") === text || node.querySelector("strong")?.textContent === text);
    expect(found, `button ${text}`).toBeTruthy();
    return found!;
  }

  async function editor() {
    window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<StrictMode><WorkspaceSaveRecovery /><BuilderApp /></StrictMode>));
  }


  function canvasState(): DashboardPage {
    return JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!);
  }

  async function analysisWithSelectedTile() {
    writeFailure.mockRestore();
    await editor();
    expect(canvasState().tiles.length).toBeGreaterThan(0);
    await act(async () => button("Select first test tile").click());
    const trigger = button("Create analysis");
    // Leave both undo and redo available, so suppression tests cannot pass merely
    // because the editor has no history to act on.
    const tileCount = canvasState().tiles.length;
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "d", ctrlKey: true, bubbles: true })));
    expect(canvasState().tiles).toHaveLength(tileCount + 1);
    const duplicatedX = canvasState().tiles.at(-1)!.layout.x;
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(canvasState().tiles.at(-1)!.layout.x).toBeGreaterThan(duplicatedX);
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })));
    expect(canvasState().tiles.at(-1)!.layout.x).toBe(duplicatedX);
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement).toBe(dialog);
    return { trigger, dialog };
  }

  it.each([
    { key: "Delete" }, { key: "Backspace" },
    { key: "ArrowUp" }, { key: "ArrowDown" }, { key: "ArrowLeft" }, { key: "ArrowRight", shiftKey: true },
    { key: "d", ctrlKey: true }, { key: "d", metaKey: true },
    { key: "z", ctrlKey: true }, { key: "z", metaKey: true },
    { key: "y", ctrlKey: true }, { key: "z", metaKey: true, shiftKey: true },
    { key: "k", ctrlKey: true }, { key: "k", metaKey: true }
  ])("suppresses editor shortcut $key ($ctrlKey/$metaKey/$shiftKey) while Analyze is open", async (shortcut) => {
    const { dialog } = await analysisWithSelectedTile();
    const before = canvasState();
    // Both the initially focused dialog and its controls must isolate editor actions.
    for (const target of [dialog, button("Chart")]) {
      await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { ...shortcut, bubbles: true, cancelable: true })));
      expect(canvasState()).toEqual(before);
      expect(host.querySelector(".studio-command-dialog")).toBeNull();
      expect(host.querySelector('[role="dialog"]')).toBe(dialog);
    }
  });

  it("keeps modal controls usable, traps Tab and restores focus and editor shortcuts after Escape", async () => {
    const { trigger, dialog } = await analysisWithSelectedTile();
    const before = canvasState();
    const input = dialog.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.focus();
    const editKey = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    await act(async () => input.dispatchEvent(editKey));
    expect(editKey.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(canvasState()).toEqual(before);
    const first = button("Close guided data query"), last = button("Create table");
    last.focus();
    await act(async () => last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(first);
    await act(async () => first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(last);
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(Boolean(host.querySelector<HTMLElement>(".builder-header")?.inert)).toBe(false);
    async function shortcut(key: string, modifiers: KeyboardEventInit = {}) {
      await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key, ...modifiers, bubbles: true, cancelable: true })));
    }
    await shortcut("d", { ctrlKey: true });
    expect(canvasState().tiles).toHaveLength(before.tiles.length + 1);
    const duplicated = canvasState().tiles.at(-1)!;
    await shortcut("ArrowRight");
    expect(canvasState().tiles.at(-1)!.layout.x).toBeGreaterThan(duplicated.layout.x);
    await shortcut("Delete");
    expect(canvasState().tiles).toHaveLength(before.tiles.length);
    await shortcut("z", { ctrlKey: true });
    expect(canvasState().tiles).toHaveLength(before.tiles.length + 1);
    await shortcut("y", { ctrlKey: true });
    expect(canvasState().tiles).toHaveLength(before.tiles.length);
    await shortcut("k", { ctrlKey: true });
    expect(host.querySelector(".studio-command-dialog")).not.toBeNull();
  });

  it.each(["Cancel", "Close guided data query"])("restores focus and editor actions after %s", async (label) => {
    const { trigger } = await analysisWithSelectedTile();
    const before = canvasState();
    await act(async () => button(label).click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true })));
    expect(canvasState().tiles).toHaveLength(before.tiles.length - 1);
  });

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

  it("pauses a stale editor's snapshot save and offers backup without overwriting newer storage", async () => {
    writeFailure.mockRestore();
    await editor();
    const newer = { ...loadDashboardWorkspace(), label: "Newer saved workspace from another tab" };
    const newerRaw = JSON.stringify(newer); localStorage.setItem(workspaceStorageKey, newerRaw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    await act(async () => button("Save snapshot").click());
    expect(host.textContent).toContain("Another tab changed this workspace");
    expect(host.textContent).toContain("Download a backup of these edits");
    expect(Array.from(host.querySelectorAll("button")).some(node => node.textContent === "Retry saving")).toBe(false);
    expect(button("Download workspace backup")).toBeTruthy();
    expect(window.location.hash).toBe(`#/reports/${baseline.reports[0].id}`);
    expect(host.querySelector(".published-shell")).toBeNull();
    expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
    expect(workspaceSaveSession.getPending()?.importedDatasets[0].rows).toHaveLength(30);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(localStorage.getItem(workspaceStorageKey)).toBe(newerRaw);
    expect(writes).not.toHaveBeenCalled();
  });

  it("keeps failed publication in the draft editor and publishes only after storage recovers", async () => {
    await editor();
    await act(async () => button("Save snapshot").click());
    expect(window.location.hash).toBe(`#/reports/${baseline.reports[0].id}`);
    expect(host.querySelector(".published-shell")).toBeNull();
    expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
    expect(workspaceSaveSession.getPending()?.reports[0].draft.publishMetadata.publishCount).toBe(0);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
    writeFailure.mockRestore();
    await act(async () => button("Retry saving").click());
    expect(window.location.hash).toContain("/reports/");
    await act(async () => button("Save snapshot").click());
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

  it("offers recovery without overwriting an unreadable saved workspace", async () => {
    writeFailure.mockRestore();
    localStorage.setItem(workspaceStorageKey, "{damaged saved data");
    await act(async () => root.render(<App />));
    await act(async () => vi.advanceTimersByTime(2000));
    expect(host.textContent).toContain("Your saved workspace needs attention");
    expect(button("Download saved workspace")).toBeTruthy();
    expect(host.querySelector(".builder-shell")).toBeNull();
    expect(localStorage.getItem(workspaceStorageKey)).toBe("{damaged saved data");
  });

  it("merges a delayed home import with intervening report and study changes", async () => {
    let complete!: (result: Awaited<ReturnType<typeof importFile>>) => void;
    const imported = { ...baseline.importedDatasets[0], id: "delayed-study" };
    importFile.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    const change = vi.fn();
    await act(async () => root.render(<WorkspaceHome workspace={baseline} onWorkspaceChange={change} />));
    const input = host.querySelector('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new File(["synthetic"], "study.csv")], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    const latest = structuredClone(baseline);
    latest.reports[0].title = "Changed during import";
    latest.reports[0].draft.title = "Changed during import";
    latest.importedDatasets.push({ ...imported, id: "another-study" });
    await act(async () => root.render(<WorkspaceHome workspace={latest} onWorkspaceChange={change} />));
    await act(async () => complete({ dataset: imported, storage: { provider: "local", stored: false } }));
    const result = change.mock.calls.at(-1)![0] as DashboardWorkspace;
    expect(result.reports[0].draft.title).toBe("Changed during import");
    expect(result.importedDatasets.map((dataset) => dataset.id)).toContain("another-study");
    expect(result.importedDatasets.map((dataset) => dataset.id)).toContain("delayed-study");
    expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Changed during import");
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });

  it.each(["home", "builder"])("recovers a delayed %s import after navigation without overwriting the new editor", async (origin) => {
    writeFailure.mockRestore();
    let complete!: (result: Awaited<ReturnType<typeof importFile>>) => void;
    const imported = { ...baseline.importedDatasets[0], id: "late-route-study" };
    importFile.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    if (origin === "builder") window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<App />));
    if (origin === "builder") {
      await act(async () => button("Create analysis").click());
      await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    }
    const input = host.querySelector(origin === "builder" ? '[role="dialog"] input[type="file"]' : 'input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [new File(["synthetic"], "study.csv")], configurable: true });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    if (origin === "builder") {
      await act(async () => button("Cancel").click());
      await act(async () => { window.history.pushState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
      await act(async () => button("New report").click());
      await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
    } else {
      await act(async () => { window.history.pushState(null, "", `#/reports/${baseline.reports[0].id}`); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    }
    // The new editor has work that the old import owner must never overwrite.
    const reportTitle = host.querySelector(".workspace-mode-strip button strong")?.textContent ?? baseline.reports[0].title;
    await act(async () => button(reportTitle).click());
    const titleInput = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(titleInput, "New route preserved");
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => vi.advanceTimersByTime(1000));
    const beforeCompletion = localStorage.getItem(workspaceStorageKey);
    expect(JSON.parse(beforeCompletion!).reports.some((report: { draft: { title: string } }) => report.draft.title === "New route preserved")).toBe(true);
    await act(async () => complete({ dataset: imported, storage: { provider: "local", stored: false } }));
    expect(localStorage.getItem(workspaceStorageKey)).toBe(beforeCompletion);
    expect(deferredWorkspaceImports.getPending()[0].rows).toHaveLength(30);
    expect(host.querySelector('[aria-label="Import ready to recover"]')).not.toBeNull();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(loadDashboardWorkspace().reports.some((report) => report.draft.title === "New route preserved")).toBe(true);
    await act(async () => { window.history.pushState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(loadDashboardWorkspace().reports.some((report) => report.draft.title === "New route preserved")).toBe(true);
    expect(host.textContent).toContain("New route preserved");
    if (origin === "builder") {
      writeFailure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    }
    await act(async () => button("Add recovered studies").click());
    if (origin === "builder") {
      expect(workspaceSaveSession.getPending()?.importedDatasets.find((dataset) => dataset.id === imported.id)?.rows).toHaveLength(30);
      expect(host.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
      writeFailure.mockRestore();
      await act(async () => button("Retry saving").click());
    }
    const saved = loadDashboardWorkspace();
    expect(saved.reports.some((report) => report.draft.title === "New route preserved")).toBe(true);
    expect(saved.importedDatasets.find((dataset) => dataset.id === imported.id)?.rows).toHaveLength(30);
    expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
  });

  it("opens a spacious study workspace with distinct navigation and a return to the page", async () => {
    writeFailure.mockRestore();
    await editor();
    expect(host.querySelector('[aria-label="Workspace modes"]')).toBeNull();
    await act(async () => button("Studies").click());
    expect(host.querySelector('[data-analysis-workspace="true"]')).not.toBeNull();
    expect(button("Back to page")).toBeTruthy();
    await act(async () => button("Back to page").click());
    expect(host.querySelector('[data-analysis-workspace="true"]')).toBeNull();
  });

  it("contains analysis-dialog focus, closes on Escape and restores focus to its trigger", async () => {
    writeFailure.mockRestore();
    await editor();
    const trigger = button("Create analysis");
    trigger.focus();
    await act(async () => trigger.click());
    // Resolve the lazy dialog module inside act before asserting its contents.
    await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(dialog);
    expect(host.querySelector<HTMLElement>(".builder-header")?.inert).toBe(true);
    expect(host.querySelector('[aria-label="Analysis result preview"]')).not.toBeNull();
    expect(button("Create table")).toBeTruthy();
    expect(Array.from(dialog.querySelectorAll("button")).some((node) => node.textContent === "Create chart")).toBe(false);
    await act(async () => button("Chart").click());
    expect(button("Create chart")).toBeTruthy();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(Boolean(host.querySelector<HTMLElement>(".builder-header")?.inert)).toBe(false);
  });

  it("launches the chosen study directly into analysis and consumes the launch URL on close", async () => {
    writeFailure.mockRestore();
    await act(async () => root.render(<App />));
    await act(async () => button("Study library 1").click());
    await act(async () => button("Analyze this study").click());
    await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
    expect(window.location.hash).toContain("?study=");
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain("study");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(window.location.hash).not.toContain("?study=");
    expect(loadDashboardWorkspace().reports).toHaveLength(2);
    expect(loadDashboardWorkspace().importedDatasets[0].rows).toHaveLength(30);
  });

  it("retains the setup and shows a recoverable error when analysis creation fails", async () => {
    writeFailure.mockRestore();
    await editor();
    await act(async () => button("Create analysis").click());
    await act(async () => button("Explore the sample study").click());
    await act(async () => button("Create table").click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector(".analysis-create-error")?.textContent).toContain("could not be created");
    expect(button("Create table").disabled).toBe(false);
  });
});
