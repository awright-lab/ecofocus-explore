// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../App";
import { formulaFixture } from "../../metrics/__tests__/formulaFixture";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace, workspaceStorageKey } from "../../document/workspacePersistence";
import { workspaceSaveSession } from "../../document/workspaceSaveSession";
async function until(check: () => boolean) { for (let i = 0; i < 600 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check(), document.body.textContent?.slice(-2000)).toBe(true); }
function button(label: string) { const node = Array.from(document.querySelectorAll("button")).find(n => n.textContent?.trim() === label || n.getAttribute("aria-label") === label); if (!node) throw Error(label); return node; }
async function click(label: string) { await act(async () => { const control = button(label); control.focus(); control.click(); }); }
async function openReview() { await act(async () => document.querySelector("details.export-menu")!.setAttribute("open", "")); await click("Review before exporting"); await until(() => !!document.querySelector('[role="dialog"]')); }
it("actual App navigates report-wide export checks and preserves study, draft and published history through reopen", async () => {
 vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-09T02:00:00.000Z")); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("fetch", vi.fn(() => { throw Error("No service call expected"); }));
 const f = await formulaFixture(1000); const page = { ...structuredClone(f.draft.pages[0]), id: "preflight-destination", title: "Methodology", order: 2, tiles: [], elements: [], backgroundMode: "image" as const, backgroundImage: "" }; f.draft.pages.push(page);
 localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null); const initial = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }), f.draft).workspace; expect(saveDashboardWorkspace(initial)).toBe(true); const before = structuredClone(loadDashboardWorkspace()), raw = localStorage.getItem(workspaceStorageKey); window.history.replaceState(null, "", `/#/reports/${f.draft.id}`);
 const host = document.createElement("div"); document.body.append(host); let root = createRoot(host);
 try {
  await act(async () => root.render(<App/>)); await until(() => !!document.querySelector("details.export-menu")); await act(async () => new Promise(resolve => setTimeout(resolve, 1100))); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw);
  await openReview(); const target = button("Review page 2: Methodology"); await act(async () => { target.focus(); target.click(); }); expect(document.querySelector<HTMLSelectElement>(".export-preflight-page select")!.value).toBe(page.id); expect(document.querySelector(".export-preflight-grid")!.textContent).toContain("background image is missing"); expect(document.activeElement).toBe(target);
  for (const key of ["Delete", "Backspace"]) await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
  expect(loadDashboardWorkspace()).toEqual(before); expect(localStorage.getItem(workspaceStorageKey)).toBe(raw); expect(workspaceSaveSession.hasPending()).toBe(false); await click("Close review");
  await act(async () => root.unmount()); workspaceSaveSession.remember(null); root = createRoot(host); await act(async () => root.render(<App/>)); await until(() => !!document.querySelector("details.export-menu")); await openReview(); await click("Review page 2: Methodology"); expect(document.querySelector<HTMLSelectElement>(".export-preflight-page select")!.value).toBe(page.id); expect(loadDashboardWorkspace()).toEqual(before); expect(fetch).not.toHaveBeenCalled();
 } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); }
}, 45000);
