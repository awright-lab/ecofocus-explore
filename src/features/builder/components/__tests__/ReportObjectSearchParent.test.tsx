// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../../App";
import { formulaFixture } from "../../../metrics/__tests__/formulaFixture";
import { createCanvasElement } from "../../builderDocumentCommands";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace } from "../../../document/workspacePersistence";
import { workspaceSaveSession } from "../../../document/workspaceSaveSession";
async function until(check: () => boolean) { for (let i = 0; i < 600 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check(), document.body.textContent?.slice(-2000)).toBe(true); }
function button(label: string) { const node = Array.from(document.querySelectorAll("button")).find(n => n.textContent?.trim() === label || n.getAttribute("aria-label") === label); if (!node) throw Error(label); return node; }
it("actual App finds text on another page and keeps Delete/Backspace from changing the selected report object", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("fetch", vi.fn(() => { throw Error("No service call expected"); }));
  const f = await formulaFixture(1000), page = { ...structuredClone(f.draft.pages[0]), id: "search-destination", title: "Research conclusions", order: 2, tiles: [], elements: [] as typeof f.draft.pages[0]["elements"] }, note = createCanvasElement("text", page); note.id = "search-destination-note"; note.name = "Research commentary"; note.content = "Pricing flexibility is a key concern for customers."; page.elements = [note]; f.draft.pages.push(page);
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null); const initial = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }), f.draft).workspace; expect(saveDashboardWorkspace(initial)).toBe(true); const before = structuredClone(loadDashboardWorkspace()), source = JSON.stringify(before.importedDatasets), history = JSON.stringify(before.publishedSnapshots); window.history.replaceState(null, "", `/#/reports/${f.draft.id}`);
  const host = document.createElement("div"); document.body.append(host); let root = createRoot(host);
  try {
    await act(async () => root.render(<App/>)); await until(() => !!document.querySelector('details.export-menu')); await act(async () => button("Pages").click()); await until(() => !!document.querySelector('nav[aria-label="Report pages and objects"]'));
    const input = Array.from(document.querySelectorAll("label")).find(n => Array.from(n.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("").trim() === "Search pages")!.querySelector<HTMLInputElement>("input")!;
    await act(async () => { input.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "flexibility"); input.dispatchEvent(new Event("input", { bubbles: true })); }); const target = document.querySelector<HTMLButtonElement>(".report-object-match")!; expect(target.textContent).toContain("Research conclusions"); await act(async () => { target.focus(); target.click(); });
    await until(() => !!document.querySelector('.canvas-element.selected')?.textContent?.includes("flexibility")); expect(document.activeElement).toBe(target);
    for (const key of ["Delete", "Backspace"]) { await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))); expect(loadDashboardWorkspace().reports[0].draft).toEqual(before.reports[0].draft); expect(document.querySelector('.canvas-element.selected')?.textContent).toContain("flexibility"); }
    expect(JSON.stringify(loadDashboardWorkspace().importedDatasets)).toBe(source); expect(JSON.stringify(loadDashboardWorkspace().publishedSnapshots)).toBe(history); expect(workspaceSaveSession.hasPending()).toBe(false); expect(fetch).not.toHaveBeenCalled();
    await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host); await act(async () => root.render(<App/>)); await until(() => !!document.querySelector('details.export-menu')); expect(loadDashboardWorkspace().reports[0].draft).toEqual(before.reports[0].draft); expect(JSON.stringify(loadDashboardWorkspace().importedDatasets)).toBe(source); expect(JSON.stringify(loadDashboardWorkspace().publishedSnapshots)).toBe(history);
  } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); }
}, 45000);
