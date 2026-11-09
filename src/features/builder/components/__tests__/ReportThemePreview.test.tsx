// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportThemeControl } from "../ReportThemeControl";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../../data/importedDatasetAnalytics";
import { applyReportColorTheme } from "../../../design-system/reportColors";
import { initialDashboard } from "../../../document/documentSeeds";
import { createReportRecord, loadDashboardWorkspace, normalizeDashboardWorkspace, saveDashboardWorkspace } from "../../../document/workspacePersistence";
import type { DashboardDraft } from "../../../../../shared/types/dashboard";
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn()); localStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals(); });
function button(text: string) { const node = Array.from(host.querySelectorAll("button")).find(n => n.textContent === text); if (!node) throw Error(text); return node; }
async function click(text: string) { await act(async () => { button(text).focus(); button(text).click(); }); }
function previewCount() { return Number(host.textContent?.match(/(\d+) (?:recorded category\/audience assignments retained|retained or new category\/audience color assignments)/)?.[1]); }
async function fixture() {
  const imported = await importDatasetBuffer(new TextEncoder().encode("Answer,Region\nYes,North\nYes,North\nNo,North\nNo,South\nNo,South\nNo,South\n").buffer, "synthetic-theme-preview.csv"); if (!imported.dataset) throw Error("fixture"); let dataset = imported.dataset;
  const query = () => runImportedDatasetQuery({ dataset, field: dataset.fields[0], bannerField: dataset.fields[1], metric: "count", chartType: "grouped_bar" });
  const original = structuredClone(initialDashboard), page = original.pages[0], result = query(), tile = { ...page.tiles[0], id: "theme-preview-source", title: "Current source responses", visualization: "grouped_bar" as const, query: result.query, result };
  tile.appearance.barStyles = {}; tile.appearance.barFillMode = "solid"; original.pages = [{ ...page, elements: [], tiles: [tile] }]; original.importedDatasets = [dataset]; const palette = original.designLibrary.palettes[0];
  const themed = applyReportColorTheme(original, palette.colors); expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(themed)], importedDatasets: [dataset] }))).toBe(true); const reopened = loadDashboardWorkspace(), draft = reopened.reports[0].draft; dataset = reopened.importedDatasets[0]; draft.importedDatasets = [dataset]; let changed: DashboardDraft | undefined; const onChange = vi.fn((update: (d: DashboardDraft) => DashboardDraft) => { changed = update(draft); });
  const render = async () => { await act(async () => root.render(<ReportThemeControl dashboard={draft} onChange={onChange}/>)); }; await render(); await click("Report colors");
  return { draft, dataset, query, onChange, render, changed: () => changed, palette };
}
it("recalculates the preview when actual source results change under the same report reference", async () => {
  const f = await fixture(); expect(previewCount()).toBe(4);
  f.dataset.rows.push({ Answer: "Maybe", Region: "North" }); f.dataset.rowCount++; const result = f.query(); f.draft.pages[0].tiles[0].result = result; f.draft.pages[0].tiles[0].query = result.query;
  const before = structuredClone(f.draft); await f.render(); expect(previewCount()).toBe(5); expect(f.draft.reportColorTheme!.slots).toHaveLength(4); expect(f.draft).toEqual(before); expect(f.onChange).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it("keeps current assignments visible when no selected palette can be previewed", async () => {
  const f = await fixture(); f.draft.designLibrary.palettes = []; const before = structuredClone(f.draft); await f.render();
  expect(host.querySelector('[aria-label="Current report color assignments"]')?.textContent).toContain("4"); expect(host.querySelector('[aria-label="Report color preview"]')?.textContent).toContain("Choose a palette"); expect(button("Apply colors across report").disabled).toBe(true); expect(f.draft).toEqual(before); expect(f.onChange).not.toHaveBeenCalled();
});
it("applies the preview through the real updater and saves/reopens without changing source values or explicit colors", async () => {
  const f = await fixture(), tile = f.draft.pages[0].tiles[0], column = tile.result.columns[0]; tile.appearance.reportColorsEnabled = false; tile.appearance.barStyles[column.id] = { color: "#aabbcc", fillMode: "solid", gradientTo: "#ffffff", radius: 0 };
  const before = structuredClone(f.draft); await f.render(); await click("Apply colors across report"); const changed = f.changed()!; expect(f.onChange).toHaveBeenCalledOnce(); expect(changed.pages[0].tiles[0].appearance.reportColorsEnabled).toBe(true); expect(changed.pages[0].tiles[0].appearance.barStyles[column.id].color).toBe("#aabbcc"); expect(changed.pages[0].tiles[0].result).toEqual(before.pages[0].tiles[0].result); expect(changed.importedDatasets).toEqual(before.importedDatasets); expect(f.draft).toEqual(before);
  expect(saveDashboardWorkspace(normalizeDashboardWorkspace({ reports: [createReportRecord(changed)], importedDatasets: changed.importedDatasets }))).toBe(true); const reopened = loadDashboardWorkspace(); expect(reopened.reports[0].draft.reportColorTheme).toEqual(changed.reportColorTheme); expect(reopened.reports[0].draft.pages[0].tiles[0].result).toEqual(changed.pages[0].tiles[0].result); expect(reopened.importedDatasets[0].rows).toEqual(before.importedDatasets[0].rows); expect(reopened.importedDatasets[0].fields).toEqual(before.importedDatasets[0].fields); expect(fetch).not.toHaveBeenCalled();
});
it("cancels without applying and restores focus to the connected trigger", async () => {
  const f = await fixture(), before = structuredClone(f.draft); await click("Cancel colors"); expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(button("Report colors")); expect(f.draft).toEqual(before); expect(f.onChange).not.toHaveBeenCalled();
});
