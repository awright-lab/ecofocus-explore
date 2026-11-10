// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import App from "../../../../App";
import { formulaFixture } from "../../../metrics/__tests__/formulaFixture";
import { reportNavigatorPages } from "./reportNavigatorFixture";
import { createReportRecord, createPublishedSnapshot, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace } from "../../../document/workspacePersistence";
import { workspaceSaveSession } from "../../../document/workspaceSaveSession";
async function until(check: () => boolean) { for (let i = 0; i < 600 && !check(); i++) await act(async () => new Promise(resolve => setTimeout(resolve, 10))); expect(check()).toBe(true); }
function button(label: string) { const node = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(n => n.textContent?.trim() === label || n.getAttribute("aria-label") === label); if (!node) throw Error(label); return node; }
it("actual App navigates 100 pages and 2,001 objects, protects content/history and restores focus", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal("fetch", vi.fn(() => { throw Error("No services allowed"); }));
  const f = await formulaFixture(10, 3); f.draft.pages = reportNavigatorPages(); f.draft.pages[0].tiles = [f.source];
  localStorage.clear(); sessionStorage.clear(); workspaceSaveSession.remember(null);
  const workspace = createPublishedSnapshot(normalizeDashboardWorkspace({ reports: [createReportRecord(f.draft)], importedDatasets: [f.dataset] }), f.draft).workspace;
  expect(saveDashboardWorkspace(workspace)).toBe(true); const before = structuredClone(loadDashboardWorkspace());
  window.history.replaceState(null, "", `/#/reports/${f.draft.id}`);
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<App/>)); await until(() => !!document.querySelector("details.export-menu"));
    await act(async () => button("Pages").click()); await until(() => !!document.querySelector(".report-browse-button"));
    expect(document.querySelectorAll(".report-page-thumbnail")).toHaveLength(12);
    await act(async () => { button("Browse report ↗").focus(); button("Browse report ↗").click(); }); await until(() => !!document.querySelector('[role="dialog"]'));
    expect(document.querySelectorAll(".navigator-page-preview")).toHaveLength(12);
    await act(async () => button("Find objects").click());
    expect(document.querySelectorAll(".navigator-object")).toHaveLength(25);
    expect(document.querySelector(".navigator-count")?.textContent).toContain("of 2001");
    for (const key of ["Delete", "Backspace", "ArrowRight", "z", "d"]) await act(async () => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: key === "z" || key === "d", bubbles: true })));
    await act(async () => button("Object results pagination: last").click());
    const last = Array.from(document.querySelectorAll<HTMLButtonElement>(".navigator-object")).at(-1)!;
    expect(last.getAttribute("aria-label")).toContain("object 2001 of 2001");
    await act(async () => { last.focus(); last.click(); }); await until(() => !document.querySelector('[role="dialog"]'));
    expect(document.querySelector('[aria-current="page"]')?.getAttribute("aria-label")).toContain("page 100");
    expect(document.body.textContent).toContain("Research note");
    expect(document.activeElement?.classList.contains("report-browse-button")).toBe(true);
    await act(async () => { button("Browse report ↗").focus(); button("Browse report ↗").click(); }); await act(async () => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const after = loadDashboardWorkspace(); expect(after.reports[0].draft).toEqual(before.reports[0].draft); expect(after.importedDatasets).toEqual(before.importedDatasets); expect(after.publishedSnapshots).toEqual(before.publishedSnapshots); expect(fetch).not.toHaveBeenCalled(); expect(workspaceSaveSession.hasPending()).toBe(false);
  } finally { await act(async () => root.unmount()); host.remove(); workspaceSaveSession.remember(null); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); }
}, 45000);
