import {runMockAnalyticsQuery} from "../../../../shared/mock/analytics";
import { localFileReuseFixture } from "../../data/__tests__/fixtures/localFileReuseFixture";
import { deferredWorkspaceHistory } from "../deferredWorkspaceHistory";
import * as importedRuntimeQuery from "../../data/importedDatasetRuntimeQuery";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
// @vitest-environment jsdom
import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BuilderApp from "../../builder/BuilderApp";
import { WorkspaceHome } from "../../workspace/WorkspaceHome";
import { WorkspaceSaveRecovery, WorkspaceLoadRecovery } from "../WorkspaceSaveRecovery";
import { workspaceSaveSession } from "../workspaceSaveSession";
import { createReportRecord, createPublishedSnapshot, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace, workspaceStorageKey } from "../workspacePersistence";
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
vi.mock("../../builder/components/CanvasWorkspace", () => ({ CanvasWorkspace: ({ activePage, onSelectTile, onSelectElement, sortedPages, onSetActivePage }: { activePage: DashboardPage; onSelectTile: (id: string) => void; onSelectElement: (id: string) => void; sortedPages: DashboardPage[]; onSetActivePage: (id: string) => void }) => <div>
  Report canvas
  {sortedPages.length > 1 && <button onClick={() => onSetActivePage(sortedPages[1].id)}>Next page</button>}
  <output data-testid="canvas-state">{JSON.stringify(activePage)}</output>
  <button type="button" onClick={() => onSelectTile(activePage.tiles[0].id)}>Select first test tile</button>
  {activePage.tiles[1] && <button type="button" onClick={() => onSelectTile(activePage.tiles[1].id)}>Select second test tile</button>}
  {activePage.elements[0] && <button type="button" onClick={() => onSelectElement(activePage.elements[0].id)}>Select first test element</button>}
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
    deferredWorkspaceHistory.clear();
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
    deferredWorkspaceHistory.clear();
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

  async function openStudies() {
    await act(async () => { await import("../../builder/components/DataExplorerPanel"); });
    await act(async () => button("Studies").click());
  }

  it.each([false,true])("creates one undoable analysis page from a later page and preserves recovery data (quota=%s)", async quotaFailure => {
    if (!quotaFailure) writeFailure.mockRestore();
    const draft = baseline.reports[0].draft, first = structuredClone(draft.pages[0]);
    const origin = { ...structuredClone(first), id: "analysis_origin_page", title: "Analysis origin", order: 2, tiles: [], elements: [] };
    draft.pages = [first, origin];
    if (quotaFailure) {
      writeFailure.mockRestore(); expect(saveDashboardWorkspace(baseline)).toBe(true);
      writeFailure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Synthetic quota", "QuotaExceededError"); });
    } else expect(saveDashboardWorkspace(baseline)).toBe(true);
    workspaceSaveSession.remember(null);
    await editor();
    await act(async () => button("Next page").click());
    expect(JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!).id).toBe(origin.id);
    await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    await act(async () => button("Create analysis").click());
    const destination = Array.from(host.querySelectorAll("label")).find(label => label.textContent?.startsWith("Place analysis"))!.querySelector("select")!;
    await act(async () => { destination.value = "new_page"; destination.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => button("Create table on new page").click());
    const created = JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!);
    expect(created.id).not.toBe(origin.id); expect(created.tiles).toHaveLength(1);
    await act(async () => { vi.advanceTimersByTime(5000); });
    const saved = quotaFailure ? workspaceSaveSession.getPending()! : loadDashboardWorkspace();
    expect(saved.reports[0].draft.pages).toHaveLength(3); expect(saved.importedDatasets[0].rows).toHaveLength(30);
    expect(saved.reports[0].draft.pages.slice(0, 2)).toEqual([first, origin]);
    await act(async () => button("Create analysis").click());
    await act(async () => button("Create table on new page").click());
    const secondCreated = JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!);
    expect(secondCreated.id).not.toBe(created.id);
    await act(async () => button("Undo").click());
    expect(JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!)).toEqual(created);
    await act(async () => button("Undo").click());
    expect(JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!).id).toBe(origin.id);
    await act(async () => button("Redo").click());
    expect(JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!)).toEqual(created);
    await act(async () => button("Redo").click());
    expect(JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!)).toEqual(secondCreated);
  });

  it.each([false,true])("preserves a dirty report immediately when saving field settings (quota failure=%s)",async quotaFailure=>{
    writeFailure.mockRestore();
    const field=baseline.importedDatasets[0].fields[1];
    await editor();
    await act(async()=>button(baseline.reports[0].title).click());
    const titleInput=host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(titleInput,"Latest unsaved field report");
      titleInput.dispatchEvent(new Event("input",{bubbles:true}));
    });
    await act(async()=>titleInput.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
    expect(loadDashboardWorkspace().reports[0].draft.title).toBe(baseline.reports[0].draft.title);
    await openStudies();await act(async()=>button("Browse fields, filters, segments, and banners").click());
    const chooseField=Array.from(host.querySelectorAll<HTMLButtonElement>(".variable-tree-row__select")).find(node=>node.querySelector("strong")?.textContent===field.label);
    expect(chooseField).toBeTruthy();await act(async()=>chooseField!.click());
    const type=host.querySelector<HTMLSelectElement>(`select[aria-label="Value type for ${field.label}"]`)!;
    if(quotaFailure)writeFailure=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
    await act(async()=>{type.value="categorical";type.dispatchEvent(new Event("change",{bubbles:true}));});
    const latest=quotaFailure?workspaceSaveSession.getPending()!:loadDashboardWorkspace();
    expect(latest.importedDatasets[0].fields[1].type).toBe("categorical");
    expect(latest.reports[0].draft.title).toBe("Latest unsaved field report");
    expect(latest.reports[0].title).toBe("Latest unsaved field report");
    if(quotaFailure)expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });

  it.each([false,true])("persists actual field settings while preserving raw values and historical snapshots (quota failure=%s)",async quotaFailure=>{
    writeFailure.mockRestore();
    const study=baseline.importedDatasets[0],field=study.fields[1];
    study.rows[0].Spend="$10";study.rows[1].Spend="invalid";
    Object.assign(field,{type:"categorical",modelingRole:"candidate_dimension",eligibleForFilter:true,eligibleForSegment:true,eligibleForBanner:true});
    baseline.reports[0].draft.importedDatasets=[study];
    baseline=createPublishedSnapshot(baseline,baseline.reports[0].draft).workspace;
    const beforeRows=structuredClone(study.rows),beforePages=structuredClone(baseline.reports[0].draft.pages),beforeSnapshot=structuredClone(baseline.publishedSnapshots[0]);
    expect(saveDashboardWorkspace(baseline)).toBe(true);lastSaved=localStorage.getItem(workspaceStorageKey)!;
    await editor();await openStudies();await act(async()=>button("Browse fields, filters, segments, and banners").click());
    const chooseField=Array.from(host.querySelectorAll<HTMLButtonElement>(".variable-tree-row__select")).find(node=>node.querySelector("strong")?.textContent===field.label);expect(chooseField).toBeTruthy();
    await act(async()=>chooseField!.click());
    const type=host.querySelector<HTMLSelectElement>(`select[aria-label="Value type for ${field.label}"]`);expect(type).toBeTruthy();expect(type!.value).toBe("categorical");
    if(quotaFailure)writeFailure=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("Full","QuotaExceededError");});
    await act(async()=>{type!.value="numeric";type!.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(type!.value).toBe("numeric");
    if(quotaFailure){
      expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);expect(host.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
      expect(workspaceSaveSession.getPending()?.importedDatasets[0].fields[1].type).toBe("numeric");
      expect(workspaceSaveSession.getPending()?.importedDatasets[0].rows).toEqual(beforeRows);
      writeFailure.mockRestore();await act(async()=>{expect(workspaceSaveSession.retry()).toBe(true);});
    }
    const reopened=loadDashboardWorkspace();
    expect(reopened.importedDatasets[0].fields[1]).toMatchObject({type:"numeric",modelingRole:"candidate_measure",eligibleForFilter:false,eligibleForSegment:false,eligibleForBanner:false});
    expect(reopened.importedDatasets[0].rows).toEqual(beforeRows);expect(reopened.reports[0].draft.pages).toEqual(beforePages);expect(reopened.publishedSnapshots[0]).toEqual(beforeSnapshot);
  });

  it("keeps the study and selection when removal cannot be saved, and retries the pre-removal state", async () => {
    vi.spyOn(window,"confirm").mockReturnValue(true);
    await editor(); await openStudies();
    const dataset=baseline.importedDatasets[0];
    await act(async()=>button(`Remove ${dataset.title}`).click());
    expect(host.querySelector('.study-removal-error')?.textContent).toContain("could not be saved");
    expect(button(`Remove ${dataset.title}`)).toBeTruthy();
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
    expect(workspaceSaveSession.getPending()?.importedDatasets[0].rows).toEqual(dataset.rows);
    writeFailure.mockRestore();
    await act(async()=>{ expect(workspaceSaveSession.retry()).toBe(true); });
    expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows);
  });

  it("blocks removal from the actual editor when another analysis uses the study", async () => {
    writeFailure.mockRestore(); vi.spyOn(window,"confirm").mockReturnValue(true);
    const dataset=baseline.importedDatasets[0],tile=baseline.reports[0].draft.pages[0].tiles[0];
    const result=runImportedDatasetQuery({dataset,field:dataset.fields[0],metric:"count",chartType:"table"});tile.query=result.query;tile.result=result;
    expect(saveDashboardWorkspace(baseline)).toBe(true);lastSaved=localStorage.getItem(workspaceStorageKey)!;
    await editor();await openStudies();await act(async()=>button(`Remove ${dataset.title}`).click());
    expect(host.querySelector('.study-removal-error')?.textContent).toContain("still used");
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);expect(loadDashboardWorkspace().importedDatasets[0].rows).toEqual(dataset.rows);
  });

  it("removes an unused study without clearing unrelated Undo/Redo or restoring it on Undo", async () => {
    vi.spyOn(window,"confirm").mockReturnValue(true);await selectedEditorWithHistory();await openStudies();
    const dataset=baseline.importedDatasets[0];expect(button("Undo").disabled).toBe(false);expect(button("Redo").disabled).toBe(false);
    await act(async()=>button(`Remove ${dataset.title}`).click());
    expect(host.querySelector('.study-removal-error')).toBeNull();expect(loadDashboardWorkspace().importedDatasets).toHaveLength(0);
    expect(button("Undo").disabled).toBe(false);expect(button("Redo").disabled).toBe(false);
    await act(async()=>button("Undo").click());
    expect(Array.from(host.querySelectorAll("button")).some(node=>node.getAttribute("aria-label")===`Remove ${dataset.title}`)).toBe(false);
    expect(loadDashboardWorkspace().importedDatasets).toHaveLength(0);
  });


  function canvasState(): DashboardPage {
    return JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!);
  }

  // Canvas editing setup must leave the protected Studio rail first.
  async function canvasKey(shortcut: KeyboardEventInit) {
    await act(async () => {
      const previous = document.body.getAttribute("tabindex"); document.body.tabIndex = -1; document.body.focus();
      expect(document.activeElement).toBe(document.body);
      document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...shortcut }));
      if (previous === null) document.body.removeAttribute("tabindex"); else document.body.setAttribute("tabindex", previous);
    });
  }

  async function selectedEditorWithHistory() {
    writeFailure.mockRestore();
    await editor();
    expect(canvasState().tiles.length).toBeGreaterThan(0);
    await act(async () => button("Select first test tile").click());
    const trigger = button("Create analysis");
    // Leave both undo and redo available, so suppression tests cannot pass merely
    // because the editor has no history to act on.
    const tileCount = canvasState().tiles.length;
    await canvasKey({ key: "d", ctrlKey: true });
    expect(canvasState().tiles).toHaveLength(tileCount + 1);
    const duplicatedX = canvasState().tiles.at(-1)!.layout.x;
    await canvasKey({ key: "ArrowRight" });
    expect(canvasState().tiles.at(-1)!.layout.x).toBeGreaterThan(duplicatedX);
    await canvasKey({ key: "z", ctrlKey: true });
    expect(canvasState().tiles.at(-1)!.layout.x).toBe(duplicatedX);
    trigger.focus();
    return trigger;
  }

  it("reverses one editor duplication with one Undo and restores it with one Redo under StrictMode",async()=>{
    writeFailure.mockRestore();await editor();await act(async()=>button("Select first test tile").click());const before=canvasState().tiles.length;
    await canvasKey({key:"d",ctrlKey:true});
    expect(canvasState().tiles).toHaveLength(before+1);expect(button("Undo").disabled).toBe(false);
    await act(async()=>button("Undo").click());expect(canvasState().tiles).toHaveLength(before);expect(button("Undo").disabled).toBe(true);expect(button("Redo").disabled).toBe(false);
    await act(async()=>button("Redo").click());expect(canvasState().tiles).toHaveLength(before+1);expect(button("Redo").disabled).toBe(true);
  });

  async function analysisWithSelectedTile() {
    const trigger = await selectedEditorWithHistory();
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

  it.each(["command menu", "help"] as const)("protects the selected result while %s controls have focus", async (surface) => {
    await selectedEditorWithHistory();
    await act(async () => button(surface === "command menu" ? "Find a tool" : "Help").click());
    const control = button(surface === "command menu" ? "All tools" : "Close help");
    control.focus(); const before = canvasState();
    for (const shortcut of [{key:"Delete"},{key:"Backspace"},{key:"ArrowRight"},{key:"d",ctrlKey:true},{key:"z",ctrlKey:true},{key:"y",ctrlKey:true}]) {
      await act(async () => control.dispatchEvent(new KeyboardEvent("keydown", {...shortcut,bubbles:true,cancelable:true})));
      expect(canvasState()).toEqual(before);
    }
    if (surface === "help") {
      await act(async () => control.dispatchEvent(new KeyboardEvent("keydown", {key:"k",ctrlKey:true,bubbles:true,cancelable:true})));
      expect(host.querySelector('.studio-command-dialog')).toBeNull();
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
    const first = button("Close guided data query"), last = button("Create table on new page");
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
      await canvasKey({ key, ...modifiers });
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
    await canvasKey({ key: "Backspace" });
    expect(canvasState().tiles).toHaveLength(before.tiles.length - 1);
  });

  it("downloads a proactive versioned backup with deferred imports without saving or replacing the workspace", async () => {
    writeFailure.mockRestore(); vi.useRealTimers();
    const pending = {...structuredClone(baseline.importedDatasets[0]),id:"deferred-synthetic"}; deferredWorkspaceImports.remember(pending);
    let downloaded: Blob | undefined;
    vi.stubGlobal("URL",class extends URL {static createObjectURL(blob:Blob){downloaded=blob;return "blob:synthetic-backup";}static revokeObjectURL(){}});
    vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    const writes=vi.spyOn(Storage.prototype,"setItem");
    await act(async()=>root.render(<WorkspaceHome workspace={baseline} onWorkspaceChange={()=>{}}/>));
    writes.mockClear(); // Ignore ordinary view-preference initialization before the download.
    await act(async()=>button("Download workspace backup").click());
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Backup restoration is not available");
    const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(downloaded!);});
    const envelope=JSON.parse(text);expect(envelope).toMatchObject({kind:"ecofocus-workspace-backup",version:1,format:"workspace-v2"});
    expect(JSON.parse(envelope.payload).importedDatasets[0].rows).toHaveLength(30);
    expect(JSON.parse(envelope.pendingImportsPayload)[0].id).toBe(pending.id);expect(envelope.inventory.pendingImports).toBe(1);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);expect(writes).not.toHaveBeenCalled();expect(deferredWorkspaceImports.getPending()).toHaveLength(1);
  });

  it("shows a retryable backup download error while preserving the unsaved workspace", async () => {
    await editor();await act(async()=>vi.advanceTimersByTime(1000));
    const pending=workspaceSaveSession.getPending();
    vi.stubGlobal("URL",class extends URL {static createObjectURL():string{throw Error("Synthetic backup blocked");}});
    await act(async()=>button("Download workspace backup").click());
    expect(host.textContent).toContain("Synthetic backup blocked");expect(button("Download workspace backup").disabled).toBe(false);
    expect(workspaceSaveSession.getPending()).toBe(pending);expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });

  it("keeps a damaged saved recovery download byte-for-byte original instead of wrapping it", async () => {
    writeFailure.mockRestore();vi.useRealTimers();const raw="\r\n{broken synthetic JSON: ☘}\r\n";localStorage.setItem(workspaceStorageKey,raw);
    let downloaded:Blob|undefined;vi.stubGlobal("URL",class extends URL {static createObjectURL(blob:Blob){downloaded=blob;return "blob:raw-recovery";}static revokeObjectURL(){}});
    vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    await act(async()=>root.render(<WorkspaceLoadRecovery/>));await act(async()=>button("Download saved workspace").click());
    const text=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.readAsText(downloaded!);});
    expect(text).toBe(raw);expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
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
    expect(JSON.parse(text)).toMatchObject({kind:"ecofocus-workspace-backup",version:1,format:"workspace-v2"});
    expect(JSON.parse(JSON.parse(text).payload).importedDatasets[0].rows).toHaveLength(30);
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

  it("keeps snapshots read-only even when a draft selection and editing history still exist",async()=>{
    await selectedEditorWithHistory();await act(async()=>button("Save snapshot").click());expect(host.querySelector('.published-shell')).not.toBeNull();
    const count=host.querySelector('.published-page-meta')?.textContent,stored=localStorage.getItem(workspaceStorageKey),back=button("Back to draft");
    for(const shortcut of [{key:"Delete"},{key:"Backspace"},{key:"ArrowRight"},{key:"d",ctrlKey:true},{key:"z",ctrlKey:true},{key:"y",ctrlKey:true},{key:"k",ctrlKey:true}]){
      await act(async()=>back.dispatchEvent(new KeyboardEvent("keydown",{...shortcut,bubbles:true,cancelable:true})));
      expect(host.querySelector('.published-page-meta')?.textContent).toBe(count);expect(localStorage.getItem(workspaceStorageKey)).toBe(stored);
    }
    await act(async()=>back.click());expect(host.querySelector('.studio-command-dialog')).toBeNull();expect(host.querySelector('.published-shell')).toBeNull();
  });

  it("does not let a delayed autosave mark a newer editor revision saved", async () => {
    const acknowledgements: Array<(saved: boolean) => void> = [];
    const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation(value => {
      workspaceSaveSession.remember(value);
      return new Promise<boolean>(resolve => acknowledgements.push(resolve));
    });
    await editor();
    await act(async () => vi.advanceTimersByTime(900));
    expect(save).toHaveBeenCalledOnce();
    expect(host.querySelector(".workspace-save-state")?.textContent).toBe("Changes not saved");
    await act(async () => button(baseline.reports[0].title).click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Newer autosave revision");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => acknowledgements[0](true));
    expect(host.querySelector(".workspace-save-state")?.textContent).toBe("Changes not saved");
    expect(host.textContent).not.toContain("Saved just now");
    await act(async () => vi.advanceTimersByTime(900));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].reports[0].draft.title).toBe("Newer autosave revision");
    await act(async () => acknowledgements[1](false));
    expect(host.querySelector(".workspace-save-state")?.textContent).toBe("Changes not saved");
    expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Newer autosave revision");
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });

  it.each([false, true])("awaits one owned new-report transition and preserves the draft (saved=%s)", async saved => {
    let acknowledge!: (value: boolean) => void;
    const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation(value => {
      workspaceSaveSession.remember(value);
      return new Promise<boolean>(resolve => { acknowledge = resolve; });
    });
    await editor();
    const originalPath = window.location.hash;
    await act(async () => button("New report").click());
    expect(save).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe(originalPath);
    await act(async () => button("New report").click());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(save).toHaveBeenCalledOnce();
    const created = save.mock.calls[0][0].reports.find(report => report.id !== baseline.reports[0].id)!;
    expect(created).toBeTruthy();
    await act(async () => acknowledge(saved));
    expect(window.location.hash).toBe(saved ? `#/reports/${created.id}` : originalPath);
    if (!saved) expect(workspaceSaveSession.getPending()?.reports.find(report => report.id === baseline.reports[0].id)?.draft.title).toBe(baseline.reports[0].title);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });

  it("cancels a waiting report transition when the analyst edits the current report", async () => {
    let acknowledge!: (value: boolean) => void;
    const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation(value => {
      workspaceSaveSession.remember(value);
      return new Promise<boolean>(resolve => { acknowledge = resolve; });
    });
    await editor(); const originalPath = window.location.hash;
    await act(async () => button("New report").click());
    const firstAck = acknowledge;
    await act(async () => button(baseline.reports[0].title).click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Edit while switching");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => firstAck(true));
    expect(window.location.hash).toBe(originalPath);
    expect(host.textContent).toContain("Edit while switching");
    await act(async () => vi.advanceTimersByTime(900));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].reports.find(report => report.id === baseline.reports[0].id)?.draft.title).toBe("Edit while switching");
  });

  it.each([false, true])("opens a local snapshot only after acknowledged saving (saved=%s)", async saved => {
    let acknowledge!: (value: boolean) => void;
    const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation((value, recovery = value) => {
      workspaceSaveSession.remember(recovery);
      return new Promise<boolean>(resolve => { acknowledge = resolve; });
    });
    await editor(); const originalPath = window.location.hash;
    await act(async () => button("Save snapshot").click());
    expect(save).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe(originalPath);
    expect(host.querySelector(".published-shell")).toBeNull();
    await act(async () => button("Save snapshot").click());
    await act(async () => vi.advanceTimersByTime(5000));
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].publishedSnapshots).toHaveLength(1);
    expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
    await act(async () => acknowledge(saved));
    expect(window.location.hash).toBe(saved ? save.mock.calls[0][0].publishedSnapshots[0].viewerPath : originalPath);
    expect(Boolean(host.querySelector(".published-shell"))).toBe(saved);
    if (!saved) expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
  });

  it("a late snapshot acknowledgement cannot replace edits made while saving", async () => {
    let acknowledge!: (value: boolean) => void;
    vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation((value, recovery = value) => {
      workspaceSaveSession.remember(recovery);
      return new Promise<boolean>(resolve => { acknowledge = resolve; });
    });
    await editor(); const originalPath = window.location.hash;
    await act(async () => button("Save snapshot").click()); const snapshotAck = acknowledge;
    await act(async () => button(baseline.reports[0].title).click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Newer than snapshot");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => snapshotAck(true));
    expect(window.location.hash).toBe(originalPath);
    expect(host.querySelector(".published-shell")).toBeNull();
    expect(host.textContent).toContain("Newer than snapshot");
    expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe("Newer than snapshot");
    expect(deferredWorkspaceHistory.getPending()).toHaveLength(1);
    const captured = JSON.parse(deferredWorkspaceHistory.getPending()[0].payload) as DashboardWorkspace;
    expect(captured.publishedSnapshots[0].dashboard.title).toBe(baseline.reports[0].title);
    expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
  });

  it("preserves the draft and reports failure if snapshot numbering cannot safely advance", async () => {
    writeFailure.mockRestore(); baseline.reports[0].draft.publishMetadata.publishCount = Number.MAX_SAFE_INTEGER;
    expect(saveDashboardWorkspace(baseline)).toBe(true); lastSaved = localStorage.getItem(workspaceStorageKey)!; workspaceSaveSession.remember(null);
    const save = vi.spyOn(workspaceSaveSession, "saveAsync");
    await editor(); const originalPath = window.location.hash;
    await act(async () => button("Save snapshot").click());
    expect(save).not.toHaveBeenCalled(); expect(window.location.hash).toBe(originalPath); expect(host.querySelector(".published-shell")).toBeNull();
    expect(workspaceSaveSession.getPending()?.publishedSnapshots).toHaveLength(0);
    expect(workspaceSaveSession.getPending()?.reports[0].draft.title).toBe(baseline.reports[0].title);
    expect(localStorage.getItem(workspaceStorageKey)).toBe(lastSaved);
    expect(host.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
  });

  it("retains a snapshot acknowledgement after its editor unmounts and reconciles it on Home", async () => {
    let acknowledge!: (saved: boolean) => void;
    const save = vi.spyOn(workspaceSaveSession, "saveAsync").mockImplementation((value, recovery = value) => {
      workspaceSaveSession.remember(recovery);
      return new Promise<boolean>(resolve => { acknowledge = resolve; });
    });
    window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<App />));
    await act(async () => button("Save snapshot").click());
    await act(async () => { window.history.pushState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    expect(host.querySelector(".builder-shell")).toBeNull();
    await act(async () => acknowledge(true));
    expect(deferredWorkspaceHistory.getPending()).toHaveLength(1);
    expect(host.querySelector('[aria-label="Saved history awaiting review"]')).not.toBeNull();
    save.mockRestore(); writeFailure.mockRestore();
    const keep = Array.from(host.querySelectorAll("button")).find(node => node.textContent?.startsWith("Keep saved history copy"))!;
    await act(async () => keep.click());
    expect(deferredWorkspaceHistory.getPending()).toHaveLength(0);
    expect(loadDashboardWorkspace().publishedSnapshots).toHaveLength(1);
    expect(loadDashboardWorkspace().importedDatasets[0].rows).toHaveLength(30);
    expect(window.location.hash).toBe("#/");
  });

  it("keeps the Data task while switching analysis tiles and respects an explicit Style choice", async () => {
    await import("../../builder/components/ResultEvidencePanel");
    await editor(); const before=JSON.stringify(workspaceSaveSession.getPending()??baseline);
    await act(async()=>button("Select first test tile").click()); await act(async()=>button("Data").click()); expect(host.querySelector(".result-evidence-panel")).not.toBeNull();
    await act(async()=>button("Select second test tile").click()); expect(host.querySelector(".result-evidence-panel")).not.toBeNull();
    expect(host.querySelector(".assistant-object-header strong")?.textContent).toBe(baseline.reports[0].draft.pages[0].tiles[1].title);
    await act(async()=>button("Style").click()); expect(host.querySelector(".result-evidence-panel")).toBeNull();
    await act(async()=>button("Select first test tile").click()); expect(host.querySelector(".result-evidence-panel")).toBeNull();
    expect(JSON.stringify(workspaceSaveSession.getPending()??baseline)).toBe(before);
  });

  it("separates analysis and element inspector tasks without keeping stale analysis controls", async () => {
    await editor(); await act(async()=>button("Select first test tile").click()); await act(async()=>button("Data").click());
    await act(async()=>button("Select first test element").click()); expect(host.querySelector(".result-evidence-panel")).toBeNull();
    await act(async()=>button("Select second test tile").click()); expect(host.querySelector(".result-evidence-panel")).not.toBeNull();
    expect(host.querySelector(".assistant-object-header strong")?.textContent).toBe(baseline.reports[0].draft.pages[0].tiles[1].title);
  });

  it("reports import save failure and retains full imported data across route remounts", async () => {
    function Home() {
      const [workspace, setWorkspace] = useState(() => workspaceSaveSession.load());
      return <><WorkspaceSaveRecovery /><WorkspaceHome workspace={workspace} onWorkspaceChange={setWorkspace} /></>;
    }
    await act(async () => root.render(<Home />));
    const input = host.querySelector('input[aria-label="Import study file"]')!;
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
    const input = host.querySelector('input[aria-label="Import study file"]')!;
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
    // A new import cannot retain the old dataset's source-reference identity.
    const imported = { ...baseline.importedDatasets[0], id: "late-route-study", sourceRef: undefined };
    importFile.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    if (origin === "builder") window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<App />));
    if (origin === "builder") {
      await act(async () => button("Create analysis").click());
      await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    }
    const input = host.querySelector(origin === "builder" ? '[role="dialog"] input[type="file"]' : 'input[aria-label="Import study file"]')!;
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
      // A generic workspace retry does not acknowledge the separate import
      // recovery queue. Rechecking the identical saved copy is idempotent.
      expect(deferredWorkspaceImports.getPending()).toHaveLength(1);
      await act(async () => button("Add recovered studies").click());
    }
    const saved = loadDashboardWorkspace();
    expect(saved.reports.some((report) => report.draft.title === "New route preserved")).toBe(true);
    expect(saved.importedDatasets.find((dataset) => dataset.id === imported.id)?.rows).toHaveLength(30);
    expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
  });

  it.each(["home-xlsx", "home-sav", "builder-xlsx", "builder-sav"] as const)("reviews a delayed duplicate %s through actual App without overwriting newer work", async scenario => {
    writeFailure.mockRestore();
    const origin = scenario.startsWith("home") ? "home" : "builder";
    const format = scenario.endsWith("xlsx") ? "xlsx" : "sav";
    const { file, dataset } = await localFileReuseFixture(format);
    baseline.importedDatasets = [dataset];
    baseline.reports[0].draft.importedDatasets = [dataset];
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    const preserved = structuredClone(loadDashboardWorkspace());
    const imported = { ...structuredClone(dataset), id: "late-copy", sourceRef: undefined, importStatus: undefined };
    let complete!: (result: Awaited<ReturnType<typeof importFile>>) => void;
    importFile.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    if (origin === "builder") window.history.replaceState(null, "", `#/reports/${baseline.reports[0].id}`);
    await act(async () => root.render(<App />));
    if (origin === "builder") {
      await act(async () => button("Create analysis").click());
      await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    }
    const input = host.querySelector(origin === "builder" ? '[role="dialog"] input[type="file"]' : '[aria-label="Import study file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    if (origin === "builder") {
      await act(async () => button("Cancel").click());
      await act(async () => { window.history.pushState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
      await act(async () => button("New report").click());
      await act(async () => window.dispatchEvent(new HashChangeEvent("hashchange")));
    } else {
      await act(async () => { window.history.pushState(null, "", `#/reports/${baseline.reports[0].id}`); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    }
    const title = host.querySelector(".workspace-mode-strip button strong")!.textContent!;
    await act(async () => button(title).click());
    const titleInput = host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(titleInput, "Latest editor preserved");
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await act(async () => vi.advanceTimersByTime(1000));
    const savedBeforeCompletion = localStorage.getItem(workspaceStorageKey);
    expect(loadDashboardWorkspace().reports.some(r => r.draft.title === "Latest editor preserved")).toBe(true);
    await act(async () => complete({ dataset: imported, storage: { provider: "local", stored: false } }));
    expect(localStorage.getItem(workspaceStorageKey)).toBe(savedBeforeCompletion);
    expect(deferredWorkspaceImports.getPending()[0]).toEqual(imported);
    await act(async () => { window.history.pushState(null, "", "#/"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    const beforeReview = structuredClone(loadDashboardWorkspace());
    await act(async () => button("Add recovered studies").click());
    expect(host.querySelector('[aria-label="Recovered study copy choices"]')).not.toBeNull();
    expect(loadDashboardWorkspace()).toEqual(beforeReview);
    expect(deferredWorkspaceImports.getPending()).toHaveLength(1);
    await act(async () => button("Reuse matching studies and add the rest").click());
    expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
    const saved = loadDashboardWorkspace();
    expect(saved.importedDatasets).toEqual(preserved.importedDatasets);
    expect(saved.reports).toEqual(beforeReview.reports);
    expect(saved.publishedSnapshots).toEqual(preserved.publishedSnapshots);
    expect(saved.reports.some(r => r.draft.title === "Latest editor preserved")).toBe(true);
    await act(async () => root.unmount());
    workspaceSaveSession.remember(null);
    root = createRoot(host);
    await act(async () => root.render(<App />));
    expect(loadDashboardWorkspace()).toEqual(saved);
  });

  it.each(["xlsx", "sav"] as const)("queues a mounted Builder duplicate %s and refuses concurrent file parsing", async format => {
    writeFailure.mockRestore();
    const { file, dataset } = await localFileReuseFixture(format);
    baseline.importedDatasets=[dataset];baseline.reports[0].draft.importedDatasets=[dataset];
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    const preserved=structuredClone(loadDashboardWorkspace());
    const imported={...structuredClone(dataset),id:"mounted-copy",sourceRef:undefined,importStatus:undefined};
    let complete!:(result:Awaited<ReturnType<typeof importFile>>)=>void;
    importFile.mockReturnValue(new Promise(resolve=>{complete=resolve;}));
    window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    await act(async()=>button("Create analysis").click());
    await act(async()=>{await import("../../builder/components/GuidedDataQueryModal");});
    const input=host.querySelector('[role="dialog"] input[type="file"]')!;
    Object.defineProperty(input,"files",{configurable:true,value:[file]});
    const previousReads=importFile.mock.calls.length;
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    expect(importFile.mock.calls.length-previousReads).toBe(1);
    await act(async()=>complete({dataset:imported,storage:{provider:"local",stored:false}}));
    expect(deferredWorkspaceImports.getPending()[0]).toEqual(imported);
    expect(loadDashboardWorkspace().importedDatasets).toEqual(preserved.importedDatasets);
    await act(async()=>button("Cancel").click());
    await act(async()=>{window.history.pushState(null,"","#/");window.dispatchEvent(new HashChangeEvent("hashchange"));});
    const before=structuredClone(loadDashboardWorkspace());
    await act(async()=>button("Add recovered studies").click());
    expect(loadDashboardWorkspace()).toEqual(before);
    await act(async()=>button("Reuse matching studies and add the rest").click());
    expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
    expect(loadDashboardWorkspace()).toEqual(before);
    expect(loadDashboardWorkspace().publishedSnapshots).toEqual(preserved.publishedSnapshots);
  });

  it("adds a unique Builder study without replacing edits made during the read", async () => {
    writeFailure.mockRestore();
    const {file,dataset}=await localFileReuseFixture("sav");
    const imported={...dataset,id:"unique-builder-study",title:"Distinct synthetic wave",sourceRef:undefined,importStatus:undefined};
    let complete!:(result:Awaited<ReturnType<typeof importFile>>)=>void;
    importFile.mockReturnValue(new Promise(resolve=>{complete=resolve;}));
    window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    await act(async()=>button("Create analysis").click());
    await act(async()=>{await import("../../builder/components/GuidedDataQueryModal");});
    const input=host.querySelector('[role="dialog"] input[type="file"]')!;
    Object.defineProperty(input,"files",{configurable:true,value:[file]});
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    await act(async()=>button("Cancel").click());
    const title=host.querySelector(".workspace-mode-strip button strong")!.textContent!;
    await act(async()=>button(title).click());
    const editor=host.querySelector<HTMLInputElement>('[aria-label="Document title"]')!;
    await act(async()=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(editor,"Edited during unique import");
      editor.dispatchEvent(new Event("input",{bubbles:true}));
    });
    await act(async()=>editor.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})));
    // Complete before the 900ms autosave: import must read the command-time draft.
    await act(async()=>complete({dataset:imported,storage:{provider:"local",stored:false}}));
    const saved=loadDashboardWorkspace();
    expect(saved.reports[0].draft.title).toBe("Edited during unique import");
    expect(saved.importedDatasets.find(d=>d.id===imported.id)?.rows).toEqual(imported.rows);
    expect(saved.importedDatasets.find(d=>d.id===baseline.importedDatasets[0].id)?.rows).toEqual(baseline.importedDatasets[0].rows);
    expect(saved.publishedSnapshots).toEqual(baseline.publishedSnapshots);
    expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
  });

  it.each([
    ["home","local"],["home","netlify"],["home","supabase"],
    ["builder","local"],["builder","netlify"],["builder","supabase"]
  ] as const)("retains a conflicting %s import from %s without replacing any stored study", async (origin,provider) => {
    writeFailure.mockRestore();
    const incoming=structuredClone(baseline.importedDatasets[0]);
    incoming.rows[0].Segment="Changed incoming respondent";
    incoming.previewRows[0].Segment="Changed incoming respondent";
    incoming.title="Distinct conflicting service result";
    importFile.mockResolvedValue({dataset:incoming,storage:{provider,stored:provider!=="local"}});
    if(origin==="builder")window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    if(origin==="builder"){
      await act(async()=>button("Create analysis").click());
      await act(async()=>{await import("../../builder/components/GuidedDataQueryModal");});
    }
    const before=structuredClone(loadDashboardWorkspace()),raw=localStorage.getItem(workspaceStorageKey),input=host.querySelector(origin==="builder"?'[role="dialog"] input[type="file"]':'[aria-label="Import study file"]')!;
    Object.defineProperty(input,"files",{configurable:true,value:[new File(["synthetic service result"],"study.csv")]});
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    expect(loadDashboardWorkspace()).toEqual(before);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
    expect(workspaceSaveSession.hasPending()).toBe(false);
    expect(host.textContent).toContain("already retained");
    if(origin==="builder")await act(async()=>button("Cancel").click());
    await act(async()=>{window.history.pushState(null,"","#/");window.dispatchEvent(new HashChangeEvent("hashchange"));});
    const beforeRecovery=localStorage.getItem(workspaceStorageKey);
    await act(async()=>button("Add recovered studies").click());
    expect(localStorage.getItem(workspaceStorageKey)).toBe(beforeRecovery);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
    expect(host.textContent).toContain("shares an identity with different data");
    await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);
    await act(async()=>root.render(<App/>));
    expect(loadDashboardWorkspace().importedDatasets).toEqual(before.importedDatasets);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
  });

  it.each(["home","builder"] as const)("defers an unchanged reused identity in %s for explicit idempotent recovery", async origin => {
    writeFailure.mockRestore();
    const incoming=structuredClone(baseline.importedDatasets[0]);
    importFile.mockResolvedValue({dataset:incoming,storage:{provider:"local",stored:false}});
    if(origin==="builder")window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    if(origin==="builder"){
      await act(async()=>button("Create analysis").click());
      await act(async()=>{await import("../../builder/components/GuidedDataQueryModal");});
    }
    const raw=localStorage.getItem(workspaceStorageKey),source=structuredClone(loadDashboardWorkspace().importedDatasets),input=host.querySelector(origin==="builder"?'[role="dialog"] input[type="file"]':'[aria-label="Import study file"]')!;
    Object.defineProperty(input,"files",{configurable:true,value:[new File(["synthetic"],"study.csv")]});
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
    if(origin==="builder")await act(async()=>button("Cancel").click());
    await act(async()=>{window.history.pushState(null,"","#/");window.dispatchEvent(new HashChangeEvent("hashchange"));});
    await act(async()=>button("Add recovered studies").click());
    expect(deferredWorkspaceImports.getPending()).toHaveLength(0);
    expect(loadDashboardWorkspace().importedDatasets).toEqual(source);
  });

  it.each(["home","builder"] as const)("does not rebind a missing saved audience source through a %s file result", async origin => {
    writeFailure.mockRestore();
    const incoming={...structuredClone(baseline.importedDatasets[0]),id:"reserved-audience-source",sourceRef:undefined,importStatus:undefined};
    const field=incoming.fields[0];
    baseline.reports[0].draft.savedAudiences=[{version:1,id:"saved-original-audience",label:"Retained audience",datasetId:incoming.id,importedAt:incoming.importedAt,expression:{kind:"category",fieldId:field.id,sourceColumn:field.sourceColumn,exclude:false,values:["Core"]}}];
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    importFile.mockResolvedValue({dataset:incoming,storage:{provider:"local",stored:false}});
    if(origin==="builder")window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    if(origin==="builder"){
      await act(async()=>button("Create analysis").click());
      await act(async()=>{await import("../../builder/components/GuidedDataQueryModal");});
    }
    const before=structuredClone(loadDashboardWorkspace()),raw=localStorage.getItem(workspaceStorageKey),input=host.querySelector(origin==="builder"?'[role="dialog"] input[type="file"]':'[aria-label="Import study file"]')!;
    Object.defineProperty(input,"files",{configurable:true,value:[new File(["synthetic"],"study.csv")]});
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    expect(loadDashboardWorkspace()).toEqual(before);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
    expect(host.textContent).toContain("already references this study identity");
    if(origin==="builder")await act(async()=>button("Cancel").click());
    await act(async()=>{window.history.pushState(null,"","#/");window.dispatchEvent(new HashChangeEvent("hashchange"));});
    const recoveryRaw=localStorage.getItem(workspaceStorageKey);
    await act(async()=>button("Add recovered studies").click());
    expect(localStorage.getItem(workspaceStorageKey)).toBe(recoveryRaw);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
    expect(loadDashboardWorkspace().importedDatasets.some(study=>study.id===incoming.id)).toBe(false);
    expect(loadDashboardWorkspace().reports[0].draft.savedAudiences).toEqual(before.reports[0].draft.savedAudiences);
  });

  it("keeps a Home import separate from another pending recovery workspace", async () => {
    writeFailure.mockRestore();
    await act(async()=>root.render(<App/>));
    const pending=structuredClone(baseline);pending.reports[0].draft.title="Unrelated unsaved draft";await act(async()=>workspaceSaveSession.remember(pending));
    const incoming={...structuredClone(baseline.importedDatasets[0]),id:"fresh-but-pending"};
    importFile.mockResolvedValue({dataset:incoming,storage:{provider:"local",stored:false}});
    const input=host.querySelector('[aria-label="Import study file"]')!,raw=localStorage.getItem(workspaceStorageKey);
    Object.defineProperty(input,"files",{configurable:true,value:[new File(["synthetic"],"study.csv")]});
    await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    expect(workspaceSaveSession.getPending()).toBe(pending);
    expect(deferredWorkspaceImports.getPending()).toEqual([incoming]);
    expect(host.querySelector('[aria-label="Workspace not saved"]')).not.toBeNull();
  });

  it("previews a pending seeded weight through real App without saving, then refreshes independently and reopens", async () => {
    writeFailure.mockRestore();
    baseline=createPublishedSnapshot(baseline,baseline.reports[0].draft).workspace;
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    const sources=structuredClone(loadDashboardWorkspace().importedDatasets),history=structuredClone(loadDashboardWorkspace().publishedSnapshots),requests:unknown[]=[];
    vi.mocked(fetch).mockImplementation(async(url,options)=>{
      if(url!=="/.netlify/functions/analytics-query")throw Error("No live service in this synthetic workflow");
      const query=JSON.parse(String(options?.body));requests.push(query);
      return new Response(JSON.stringify(runMockAnalyticsQuery(query)),{status:200});
    });
    window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    await act(async()=>button("Select first test tile").click());
    await act(async()=>button("Data").click());
    await act(async()=>{await import("../../builder/components/InspectorTileAnalysisSections");});
    const weight=Array.from(host.querySelectorAll("label")).find(label=>label.firstChild?.textContent?.trim()==="Weight")!.querySelector("select")!;
    await act(async()=>{weight.value="none";weight.dispatchEvent(new Event("change",{bubbles:true}));});
    await act(async()=>vi.advanceTimersByTime(1000));
    const pending=structuredClone(loadDashboardWorkspace()),raw=localStorage.getItem(workspaceStorageKey),tile=pending.reports[0].draft.pages[0].tiles[0];
    expect(tile.query.weight).toBeNull();expect(tile.result.query.weight).not.toBeNull();
    await act(async()=>button("Preview pending query").click());
    expect(host.querySelector('[aria-label="Proposed analysis change preview"]')).not.toBeNull();
    expect(host.textContent).toContain("Proposed weight: Unweighted");
    expect(requests).toHaveLength(1);expect((requests[0]as{weight:unknown}).weight).toBeNull();
    expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    expect(loadDashboardWorkspace()).toEqual(pending);
    await act(async()=>button("Dismiss preview").click());
    await act(async()=>button("Refresh analysis").click());
    expect(requests).toHaveLength(2);
    await act(async()=>vi.advanceTimersByTime(1000));
    const saved=structuredClone(loadDashboardWorkspace()),updated=saved.reports[0].draft.pages[0].tiles[0];
    expect(updated.result.query.weight).toBeNull();expect(updated.result.weighting.applied).toBe(false);
    expect(saved.importedDatasets).toEqual(sources);expect(saved.publishedSnapshots).toEqual(history);
    await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);
    await act(async()=>root.render(<App/>));
    expect(loadDashboardWorkspace()).toEqual(saved);
    expect(requests).toHaveLength(2);
  });

  it.each(["imported_file","workspace_database"]as const)("keeps a question tile with %s provenance out of seeded preview and refresh",async kind=>{
    writeFailure.mockRestore();
    const tile=baseline.reports[0].draft.pages[0].tiles[0],study=baseline.importedDatasets[0];
    tile.source={kind:"question",id:tile.query.question,label:"Retained legacy source",sourceRef:{id:"explicit-import",kind,provider:kind==="imported_file"?"local_file":"netlify",label:"Original study reference",datasetId:study.id}};
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    const stored=structuredClone(loadDashboardWorkspace());
    window.history.replaceState(null,"",`#/reports/${baseline.reports[0].id}`);
    await act(async()=>root.render(<App/>));
    await act(async()=>button("Select first test tile").click());await act(async()=>button("Data").click());
    await act(async()=>{await import("../../builder/components/InspectorTileAnalysisSections");});
    const raw=localStorage.getItem(workspaceStorageKey);
    expect(host.textContent).toContain("missing its imported study context");
    expect(button("Preview pending query").getAttribute("aria-disabled")).toBe("true");
    await act(async()=>button("Preview pending query").click());
    await act(async()=>button("Refresh again").click());
    expect(fetch).not.toHaveBeenCalled();expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
    expect(loadDashboardWorkspace()).toEqual(stored);
    expect(host.querySelector('[aria-label="Proposed analysis change preview"]')).toBeNull();
    await act(async()=>root.unmount());workspaceSaveSession.remember(null);root=createRoot(host);
    await act(async()=>root.render(<App/>));expect(loadDashboardWorkspace()).toEqual(stored);
  });

  it("loads the correct imported query when separate pages reuse a tile ID", async () => {
    writeFailure.mockRestore();
    const firstStudy = baseline.importedDatasets[0];
    const secondStudy = { ...structuredClone(firstStudy), id: "second-study", title: "Second synthetic study" };
    baseline.importedDatasets.push(secondStudy);
    const firstPage = baseline.reports[0].draft.pages[0];
    firstPage.tiles = [firstPage.tiles[0]];
    const firstResult = runImportedDatasetQuery({ dataset: firstStudy, field: firstStudy.fields[0], chartType: "table", metric: "count" });
    Object.assign(firstPage.tiles[0], { visualization: "table", query: firstResult.query, result: firstResult });
    const secondPage = structuredClone(firstPage); secondPage.id = "second-page"; secondPage.title = "Second page";
    const secondResult = runImportedDatasetQuery({ dataset: secondStudy, field: secondStudy.fields[0], chartType: "table", metric: "percent_selected" });
    Object.assign(secondPage.tiles[0], { query: secondResult.query, result: secondResult });
    baseline.reports[0].draft.pages = [firstPage, secondPage];
    expect(saveDashboardWorkspace(baseline)).toBe(true); await editor();
    await act(async () => button("Select first test tile").click());
    await act(async () => button("Data").click());
    await act(async () => { await import("../../builder/components/InspectorTileAnalysisSections"); });
    function querySelect(label: string) {
      const node = Array.from(host.querySelectorAll<HTMLLabelElement>(".imported-query-editor label"))
        .find(item => item.firstChild?.textContent?.trim() === label)?.querySelector("select");
      expect(node, label).toBeTruthy(); return node!;
    }
    expect(querySelect("Dataset").value).toBe(firstStudy.id);
    expect(querySelect("Result values").value).toBe("count");
    await act(async () => button("Next page").click());
    expect(canvasState().id).toBe(secondPage.id);
    await act(async () => button("Data").click());
    expect(querySelect("Dataset").value).toBe(secondStudy.id);
    expect(querySelect("Result values").value).toBe("percent_selected");
    const runtime = vi.spyOn(importedRuntimeQuery, "runImportedDatasetQueryForRuntime").mockImplementation(async config => runImportedDatasetQuery(config));
    await act(async () => button("Update imported result").click());
    expect(runtime).toHaveBeenCalledOnce(); expect(runtime.mock.calls[0][0].dataset.id).toBe(secondStudy.id);
    expect(runtime.mock.calls[0][0].metric).toBe("percent_selected");
    await act(async () => vi.advanceTimersByTime(1000));
    const saved = loadDashboardWorkspace().reports[0].draft;
    expect(saved.pages[0].tiles[0].result.metadataRefs.source).toMatchObject({datasetId: firstStudy.id});
    expect(saved.pages[1].tiles[0].result.metadataRefs.source).toMatchObject({datasetId: secondStudy.id});
  });

  it.each([false,true])("offers usable numeric chart styles without dropping series (breakout=%s)", async breakout => {
    writeFailure.mockRestore();
    const parsed = await importDatasetBuffer(new TextEncoder().encode("Segment,Region,Spend\nCore,North,10\nCore,South,20\nGrowth,North,30\nGrowth,South,40\n").buffer,"visualization.csv");
    const dataset = parsed.dataset!; baseline.importedDatasets = [dataset];
    const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], measureField: dataset.fields[2], bannerField: breakout ? dataset.fields[1] : null, metric: "average", chartType: "table" });
    const page = baseline.reports[0].draft.pages[0]; page.tiles = [{...page.tiles[0],visualization:"table",query:result.query,result}];
    expect(saveDashboardWorkspace(baseline)).toBe(true); await editor();
    await act(async () => button("Select first test tile").click());
    const picker = Array.from(host.querySelectorAll("label")).find(label=>label.firstChild?.textContent?.trim()==="Chart type")!.querySelector("select")!;
    expect(Array.from(picker.options).map(option=>option.value)).toEqual(breakout ? ["table","grouped_bar","stacked_bar","line_chart","heatmap","dot_plot"] : ["table","vertical_bar","horizontal_bar","heatmap","dot_plot"]);
    await act(async()=>{ picker.value = breakout ? "grouped_bar" : "horizontal_bar"; picker.dispatchEvent(new Event("change",{bubbles:true})); });
    expect(canvasState().tiles[0].visualization).toBe(breakout ? "grouped_bar" : "horizontal_bar");
    expect(canvasState().tiles[0].result.table).toEqual(result.table); expect(canvasState().tiles[0].result.series).toEqual(result.series);
    expect(canvasState().tiles[0].query.metric).toBe("average");
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

  it("reveals the new result on the page after creating from Studies, but leaves cancellation in Studies", async () => {
    writeFailure.mockRestore(); await editor(); await act(async () => button("Studies").click());
    await act(async () => { await import("../../builder/components/DataExplorerPanel"); });
    expect(host.querySelector('[data-analysis-workspace="true"]')).not.toBeNull();
    await act(async () => button("Create analysis").click());
    await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    await act(async () => button("Cancel").click());
    expect(host.querySelector('[data-analysis-workspace="true"]')).not.toBeNull();
    await act(async () => button("Create analysis").click());
    await act(async () => button("Create table on new page").click());
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('[data-analysis-workspace="true"]')).toBeNull();
    expect(host.querySelector('.editor-location strong')?.textContent).toBe("Page canvas");
    expect(canvasState().tiles).toHaveLength(1);
    expect(canvasState().id).not.toBe(baseline.reports[0].draft.pages[0].id);
    expect(canvasState().tiles.at(-1)?.result.metadataRefs.source?.kind).toBe("imported");
    await act(async () => { vi.advanceTimersByTime(32); });
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Create analysis");
  });

  it.each(["success", "failure"] as const)("ignores a dismissed imported creation's late %s without changing the next dialog or report", async (outcome) => {
    writeFailure.mockRestore();
    let resolve!: (value: ReturnType<typeof runImportedDatasetQuery>) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<ReturnType<typeof runImportedDatasetQuery>>((done, fail) => { resolve = done; reject = fail; });
    const query = vi.spyOn(importedRuntimeQuery, "runImportedDatasetQueryForRuntime").mockReturnValueOnce(pending);
    await editor(); const before = canvasState(); await act(async () => button("Studies").click());
    await act(async () => button("Create analysis").click());
    await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    await act(async () => button("Create table on new page").click()); expect(query).toHaveBeenCalledOnce();
    await act(async () => button("Cancel").click());
    await act(async () => button("Create analysis").click());
    const nextDialog = host.querySelector('[role="dialog"]'); expect(nextDialog).not.toBeNull();
    expect(button("Waiting for data request").disabled).toBe(true);
    await act(async () => { if (outcome === "success") resolve(runImportedDatasetQuery(query.mock.calls[0][0])); else reject(new Error("Old dismissed analysis failed")); });
    expect(host.querySelector('[role="dialog"]')).toBe(nextDialog);
    expect(host.querySelector('[data-analysis-workspace="true"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Old dismissed analysis failed");
    await act(async () => button("Cancel").click()); await act(async () => button("Back to page").click());
    expect(canvasState()).toEqual(before);
  });

  it("preserves the Styles workspace when analysis creation is canceled", async () => {
    writeFailure.mockRestore(); await editor(); await act(async () => button("Styles").click());
    expect(host.querySelector('.brand-panel')).not.toBeNull();
    await act(async () => button("Create analysis").click());
    await act(async () => { await import("../../builder/components/GuidedDataQueryModal"); });
    await act(async () => button("Cancel").click());
    expect(host.querySelector('.brand-panel')).not.toBeNull();
    expect(host.querySelector('.editor-location strong')?.textContent).toBe("Styles & brand");
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
    expect(button("Create table on new page")).toBeTruthy();
    expect(Array.from(dialog.querySelectorAll("button")).some((node) => node.textContent === "Create chart")).toBe(false);
    await act(async () => button("Chart").click());
    expect(button("Create chart on new page")).toBeTruthy();
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
    await act(async () => button("Create table on new page").click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.querySelector(".analysis-create-error")?.textContent).toContain("could not be created");
    expect(button("Create table on new page").disabled).toBe(false);
  });
  async function importedEditorPreview() {
    writeFailure.mockRestore();
    const dataset = baseline.importedDatasets[0], field = dataset.fields[0];
    const result = runImportedDatasetQuery({ dataset, field, metric: "count", chartType: "table" });
    const page = baseline.reports[0].draft.pages[0];
    page.tiles = [{ ...page.tiles[0], visualization: "table", query: result.query, result }];
    expect(saveDashboardWorkspace(baseline)).toBe(true);
    await editor(); await act(async () => button("Select first test tile").click());
    await act(async () => { await import("../../builder/components/InspectorTileAnalysisSections"); });
    await act(async () => host.querySelector<HTMLButtonElement>('.assistant-side-rail button[data-tool="data"]')!.click());
    await act(async () => button("Preview proposed edit").click());
    expect(host.querySelector('[aria-label="Proposed analysis change preview"]')).not.toBeNull();
  }
  it("does not delete selected report content when Delete is pressed on inline preview controls", async () => {
    await importedEditorPreview(); const before = canvasState();
    const dismiss = button("Dismiss preview"); dismiss.focus();
    await act(async () => dismiss.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true })));
    expect(canvasState()).toEqual(before);
  });

  it.each(["trigger", "dismiss", "evidence"] as const)("keeps canvas command keys out of focused %s analysis controls", async targetKind => {
    await importedEditorPreview();
    // Leave preview controls for intentional canvas editing.
    await canvasKey({ key: "d", ctrlKey: true });
    await canvasKey({ key: "ArrowRight" });
    await act(async () => button("Preview proposed edit").click());
    const before = canvasState();
    const target = targetKind === "trigger" ? button("Preview proposed edit") : targetKind === "dismiss" ? button("Dismiss preview") : host.querySelector<HTMLElement>(".result-evidence-panel summary")!;
    for (const shortcut of [{ key: "Delete" }, { key: "Backspace" }, { key: "ArrowLeft" }, { key: "ArrowRight", shiftKey: true }, { key: "ArrowUp" }, { key: "ArrowDown" }, { key: "d", ctrlKey: true }, { key: "d", metaKey: true }, { key: "z", ctrlKey: true }, { key: "z", metaKey: true }, { key: "y", ctrlKey: true }, { key: "z", metaKey: true, shiftKey: true }]) {
      const event = new KeyboardEvent("keydown", { ...shortcut, bubbles: true, cancelable: true });
      target.focus(); await act(async () => target.dispatchEvent(event));
      expect(canvasState(), `${targetKind} ${shortcut.key}`).toEqual(before);
      expect(event.defaultPrevented).toBe(false);
    }
    await canvasKey({ key: "z", ctrlKey: true });
    expect(canvasState()).not.toEqual(before);
  });
  it("keeps the global command palette available from an inline preview", async () => {
    await importedEditorPreview(); const target = button("Dismiss preview"); target.focus();
    await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true })));
    expect(host.querySelector('dialog[open].studio-command-dialog')).not.toBeNull();
  });

  it("applies report colors through real editor UI, autosaves, undoes/redoes and reopens without changing data", async () => {
    writeFailure.mockRestore(); await editor(); const before = baseline.reports[0].draft.pages.map(page => page.tiles.map(tile => tile.result.table));
    await act(async () => button("Report colors").click());
    await act(async () => button("Cancel colors").click()); expect(loadDashboardWorkspace().reports[0].draft.reportColorTheme).toBeUndefined();
    await act(async () => button("Report colors").click()); await act(async () => button("Apply colors across report").click());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const saved = loadDashboardWorkspace().reports[0].draft; expect(saved.reportColorTheme?.slots.length).toBeGreaterThan(0);
    expect(saved.pages.map(page => page.tiles.map(tile => tile.result.table))).toEqual(before);
    const expected = structuredClone(saved.reportColorTheme);
    await act(async () => button("Undo").click()); await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(loadDashboardWorkspace().reports[0].draft.reportColorTheme).toBeUndefined();
    await act(async () => button("Redo").click()); await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(loadDashboardWorkspace().reports[0].draft.reportColorTheme).toEqual(expected);
    await act(async () => root.render(<p>Closed editor</p>)); workspaceSaveSession.remember(null); await editor();
    expect(JSON.parse(host.querySelector('[data-testid="canvas-state"]')!.textContent!).tiles[0].appearance.reportColorsEnabled).toBe(true);
    expect(loadDashboardWorkspace().reports[0].draft.pages.map(page => page.tiles.map(tile => tile.result.table))).toEqual(before);
  });

});
