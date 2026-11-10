// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../../App";
import { sectionLibraryAppFixture } from "./sectionLibraryAppFixture";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace } from "../../../document/workspacePersistence";
import { workspaceSaveSession } from "../../../document/workspaceSaveSession";
async function until(check: () => boolean) { for (let i = 0; i < 1000 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check()).toBe(true); }
const button = (name: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(node => node.getAttribute("aria-label") === name || node.textContent?.trim() === name)!;
async function click(name: string) { await act(async () => { button(name).focus(); button(name).click(); }); }
it("actual App browses 500 stored sections without mutation, inserts an editable copy, undoes/redoes and cold reopens it", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("fetch", vi.fn(() => { throw Error("No services allowed"); }));
  const f = await sectionLibraryAppFixture(); localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  const workspace = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }), f.draft).workspace;
  expect(saveDashboardWorkspace(workspace)).toBe(true); const before = structuredClone(loadDashboardWorkspace()); window.history.replaceState(null, "", `/#/reports/${f.draft.id}`);
  const host = document.createElement("div"); document.body.append(host); let root = createRoot(host);
  try {
    await act(async () => root.render(<App/>)); await until(() => !!document.querySelector("details.export-menu"));
    await click("Styles"); await until(() => !!button("Browse sections ↗")); const smart = document.querySelector(".composition-starter-list.smart")!.textContent;
    await click("Browse sections ↗"); expect(document.querySelectorAll(".section-card")).toHaveLength(12); expect(document.querySelector(".section-count")?.textContent).toContain("of 500");
    await act(async () => { const card = document.querySelectorAll<HTMLButtonElement>(".section-card")[3]; card.focus(); card.click(); });
    expect(document.querySelector(".section-cache-note")?.textContent).toContain("does not use the selected study");
    for (const key of ["Delete", "Backspace", "ArrowRight", "z", "d"]) await act(async () => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true })));
    const browsed = loadDashboardWorkspace(); expect(browsed.reports[0].draft).toEqual(before.reports[0].draft); expect(browsed.importedDatasets).toEqual(before.importedDatasets); expect(browsed.publishedSnapshots).toEqual(before.publishedSnapshots);
    expect(document.querySelector(".composition-starter-list.smart")!.textContent).toBe(smart);
    await click("Insert section");
    await until(() => loadDashboardWorkspace().reports[0].draft.pages[0].elements.length === 2 && !workspaceSaveSession.hasPending());
    const inserted = structuredClone(loadDashboardWorkspace()), addedPage = inserted.reports[0].draft.pages[0];
    expect(addedPage.tiles).toHaveLength(2); expect(addedPage.elements.map(element => element.name)).toEqual(["Section background", "Section commentary"]);
    const sourceBlock = before.reports[0].draft.designLibrary.compositionBlocks[0], newBlock = inserted.reports[0].draft.designLibrary.compositionBlocks[0];
    const { lastUsedAt, ...blockWithoutUsage } = newBlock; expect(lastUsedAt).toBeTypeOf("number"); expect(blockWithoutUsage).toEqual(sourceBlock);
    expect(addedPage.elements[1].id).not.toBe("text-0"); expect(addedPage.elements[0].layout.zIndex).toBeLessThan(addedPage.tiles[1].layout.zIndex); expect(addedPage.tiles[1].layout.zIndex).toBeLessThan(addedPage.elements[1].layout.zIndex);
    expect(addedPage.tiles[1].query).toEqual(sourceBlock.items.find(item => item.kind === "tile")!.tile.query);
    expect(inserted.importedDatasets).toEqual(before.importedDatasets); expect(inserted.publishedSnapshots).toEqual(before.publishedSnapshots);
    await click("Undo"); await until(() => loadDashboardWorkspace().reports[0].draft.pages[0].elements.length === 0 && !workspaceSaveSession.hasPending());
    expect(loadDashboardWorkspace().reports[0].draft.pages).toEqual(before.reports[0].draft.pages);
    await click("Redo"); await until(() => loadDashboardWorkspace().reports[0].draft.pages[0].elements.length === 2 && !workspaceSaveSession.hasPending());
    await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host); await act(async () => root.render(<App/>)); await until(() => !!document.querySelector("details.export-menu"));
    const reopened = loadDashboardWorkspace(); expect(reopened.reports[0].draft.pages).toEqual(inserted.reports[0].draft.pages); expect(reopened.importedDatasets).toEqual(before.importedDatasets); expect(reopened.publishedSnapshots).toEqual(before.publishedSnapshots); expect(fetch).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); }
}, 60000);
