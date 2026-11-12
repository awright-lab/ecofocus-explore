// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../../App";
import { formulaFixture } from "../../../metrics/__tests__/formulaFixture";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace, workspaceStorageKey } from "../../../document/workspacePersistence";
import { workspaceSaveSession } from "../../../document/workspaceSaveSession";
async function until(check: () => boolean) { for (let i = 0; i < 600 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check(), document.body.textContent?.slice(-1700)).toBe(true); }
function button(label: string) { const node = Array.from(document.querySelectorAll("button")).find(n => n.textContent?.trim() === label || n.getAttribute("aria-label") === label); if (!node) throw Error(label); return node; }
async function click(label: string) { await act(async () => { const node = button(label); node.focus(); node.click(); }); }
const selector = () => document.querySelector<HTMLSelectElement>(".numeric-distribution select")!;
const values = () => Array.from(document.querySelectorAll(".numeric-distribution [data-view-value]"), node => Number(node.getAttribute("data-view-value")));
async function mode(value: string) { await act(async () => { selector().focus(); selector().value = value; selector().dispatchEvent(new Event("change", { bubbles: true })); }); }
it("actual App switches distribution views using the same exact1000-row profile and preserves study/report/history through reopen", async () => {
 vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-09T03:00:00.000Z")); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("fetch", vi.fn(() => { throw Error("No service request expected"); }));
 const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView"); Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
 const dialogProperties = (["showModal", "close"] as const).map(key => ({ key, descriptor: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key) }));
 Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } }); Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
 const f = await formulaFixture(1000); localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null); const initial = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }), f.draft).workspace; expect(saveDashboardWorkspace(initial)).toBe(true); const before = structuredClone(loadDashboardWorkspace()), raw = localStorage.getItem(workspaceStorageKey); window.history.replaceState(null, "", `/#/reports/${f.draft.id}`);
 const host = document.createElement("div"); document.body.append(host); let root = createRoot(host);
 async function openField() {
  await click("Pages"); await until(() => !!document.querySelector('nav[aria-label="Report pages and objects"]'));
  await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>(".report-page-group.active button")).find(node => node.getAttribute("aria-label")?.startsWith("Show objects on page"))!.click());
  await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>(".report-page-object-select")).find(node => node.getAttribute("aria-label")?.startsWith("Select analysis Responses,"))!.click());
  await click("Find a tool"); await until(() => !!document.querySelector<HTMLButtonElement>("[data-tool-command=data]")); await act(async () => document.querySelector<HTMLButtonElement>("[data-tool-command=data]")!.click()); await act(async () => document.querySelector<HTMLButtonElement>(".tool-library-open")!.click()); await until(() => Array.from(document.querySelectorAll("button")).some(n => n.textContent?.trim() === "Browse fields, filters, segments, and banners")); await click("Browse fields, filters, segments, and banners");
  await act(async () => { const field = Array.from(document.querySelectorAll<HTMLButtonElement>(".variable-tree-row__select")).find(node => node.querySelector("strong")?.textContent === "Spend"); expect(field).toBeDefined(); field!.focus(); field!.click(); }); await until(() => !!selector());
 }
 try {
  await act(async () => root.render(<App/>)); await until(() => !!document.querySelector('[aria-label="Find a tool"]')); await act(async () => new Promise(resolve => setTimeout(resolve, 1100))); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); await openField();
  expect(values()).toEqual([99, 99, 98, 96, 96, 96, 96, 96, 96, 128]); await mode("percent"); expect(values()).toEqual([9.9, 9.9, 9.8, 9.6, 9.6, 9.6, 9.6, 9.6, 9.6, 12.8]); await mode("cumulative"); expect(values()).toEqual([9.9, 19.8, 29.6, 39.2, 48.8, 58.4, 68, 77.6, 87.2, 100]); expect(document.activeElement).toBe(selector());
  for (const key of ["Delete", "Backspace"]) await act(async () => selector().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
  const details = document.querySelector<HTMLDetailsElement>(".numeric-distribution details")!; await act(async () => { details.open = true; const region = details.querySelector<HTMLElement>('[role="region"]')!; region.focus(); }); const region = details.querySelector<HTMLElement>('[role="region"]')!; expect(document.activeElement).toBe(region); for (const key of ["Delete", "Backspace"]) await act(async () => region.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
  expect(loadDashboardWorkspace()).toEqual(before); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); expect(workspaceSaveSession.hasPending()).toBe(false);
  await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host); await act(async () => root.render(<App/>)); await until(() => !!document.querySelector('[aria-label="Find a tool"]')); await openField(); expect(selector().value).toBe("count"); expect(values()).toEqual([99, 99, 98, 96, 96, 96, 96, 96, 96, 128]); expect(loadDashboardWorkspace()).toEqual(before); expect(fetch).not.toHaveBeenCalled();
 } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); for (const item of dialogProperties) { if (item.descriptor) Object.defineProperty(HTMLDialogElement.prototype, item.key, item.descriptor); else Reflect.deleteProperty(HTMLDialogElement.prototype, item.key); } if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor); else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"); vi.unstubAllGlobals(); vi.useRealTimers(); }
}, 45000);
