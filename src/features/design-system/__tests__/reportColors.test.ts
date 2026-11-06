import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { applyReportColorTheme, reconcileReportColors, removeReportColorTheme, chartColor, validReportColorTheme, reportColorEligibility } from "../reportColors";
import { createReportRecord, normalizeDashboardWorkspace, saveDashboardWorkspace, loadDashboardWorkspace, workspaceStorageKey } from "../../document/workspacePersistence";
import { buildPageVisualSvg } from "../../export/pageVisualExport";
import { buildNativePptxChartDescriptor } from "../../export/pptxNativeCharts";
import type { DashboardDraft } from "../../../../shared/types/dashboard";
const palette = ["#112233", "#445566", "#778899", "#aabbcc"];
function fixture(): DashboardDraft {
 const draft = structuredClone(initialDashboard); draft.pages = [draft.pages[0]];
 const tile = draft.pages[0].tiles[0]; tile.visualization = "grouped_bar"; tile.appearance.showValueLabels = false;
 tile.result.columns = [{ id: "north", label: "North" }, { id: "south", label: "South" }];
 tile.result.table = [{ optionId: "yes", label: "Yes", values: { north: 10, south: 20 }, bases: { north: 50, south: 50 } }, { optionId: "no", label: "No", values: { north: 40, south: 30 }, bases: { north: 50, south: 50 } }];
 tile.query = structuredClone(tile.result.query); tile.appearance.barStyles = {}; tile.appearance.barFillMode = "solid";
 draft.pages[0].elements = []; draft.pages[0].tiles = [tile, { ...structuredClone(tile), id: "second", layout: { ...tile.layout, x: tile.layout.x + tile.layout.width + 15 } }]; return draft;
}
it("leaves existing reports unchanged until enabled", () => { const draft = fixture(); expect(reconcileReportColors(draft)).toBe(draft); });
it("shares exact source identities across tiles and keeps slots when rows/columns are reordered, filtered and return", () => {
 const original = fixture(), before = structuredClone(original), themed = applyReportColorTheme(structuredClone(original), palette), first = themed.pages[0].tiles[0], second = themed.pages[0].tiles[1];
 expect(first.appearance.reportColorSlots).toEqual(second.appearance.reportColorSlots);
 const north = chartColor(first, "columns", "north", 0), yes = chartColor(first, "rows", "yes", 0), slots = structuredClone(themed.reportColorTheme!.slots);
 second.result.columns.reverse(); second.result.table.reverse(); second.result.table = second.result.table.filter(row => row.optionId === "yes");
 const filtered = reconcileReportColors(themed); expect(chartColor(filtered.pages[0].tiles[1], "columns", "north", 1)).toBe(north); expect(chartColor(filtered.pages[0].tiles[1], "rows", "yes", 0)).toBe(yes); expect(filtered.reportColorTheme!.slots).toEqual(slots);
 expect(original).toEqual(before);
});
it("appends new categories without moving existing ones and changes palette without renumbering", () => {
 const draft = applyReportColorTheme(fixture(), palette), slots = structuredClone(draft.reportColorTheme!.slots), tile = draft.pages[0].tiles[0];
 tile.result.table.push({ ...structuredClone(tile.result.table[0]), optionId: "new", label: "New" });
 const extended = reconcileReportColors(draft); expect(extended.reportColorTheme!.slots.slice(0, slots.length)).toEqual(slots);
 const changed = applyReportColorTheme(extended, [...palette].reverse()); expect(changed.reportColorTheme!.slots).toEqual(extended.reportColorTheme!.slots);
 expect(chartColor(changed.pages[0].tiles[0], "rows", "new", 0)).not.toBe(chartColor(extended.pages[0].tiles[0], "rows", "new", 0));
});
it("scopes identical codes to their study and field without using labels or tile IDs", () => {
 const draft = fixture(), second = draft.pages[0].tiles[1]; second.result.query.question = "different" as never;
 const themed = applyReportColorTheme(draft, palette); expect(themed.pages[0].tiles[0].appearance.reportColorSlots!.rows.yes).not.toBe(themed.pages[0].tiles[1].appearance.reportColorSlots!.rows.yes);
 second.result.query.question = draft.pages[0].tiles[0].result.query.question; second.result.table[0].label = "Renamed";
 const same = applyReportColorTheme(draft, palette); expect(same.pages[0].tiles[0].appearance.reportColorSlots!.rows.yes).toBe(same.pages[0].tiles[1].appearance.reportColorSlots!.rows.yes);
});
it("preserves overrides, individual palette opt-outs and the original palette on disable", () => {
 const draft = fixture(), originalPalette = [...draft.pages[0].tiles[0].appearance.palette];
 draft.pages[0].tiles[0].appearance.barStyles.north = { color: "#ff0000", fillMode: "solid", gradientTo: "#fff", radius: 0 };
 const themed = applyReportColorTheme(draft, palette); expect(chartColor(themed.pages[0].tiles[0], "columns", "north", 0)).toBe("#ff0000");
 const second = themed.pages[0].tiles[1]; second.appearance.reportColorsEnabled = false; second.appearance.palette = ["#000000"];
 expect(reconcileReportColors(themed).pages[0].tiles[1].appearance.palette).toEqual(["#000000"]);
 const off = removeReportColorTheme(themed); expect(off.reportColorTheme).toBeUndefined(); expect(off.pages[0].tiles[0].appearance.palette).toEqual(originalPalette); expect(off.pages[0].tiles[1].appearance.palette).toEqual(["#000000"]);
});
it("preserves recorded duplicate results and ignores damaged plans instead of replacing them", () => {
 const draft = fixture(); draft.pages[0].tiles[0].result.table[1].optionId = "yes";
 const themed = applyReportColorTheme(draft, palette); expect(themed.pages[0].tiles[0].appearance.reportColorSlots).toBeUndefined(); expect(themed.pages[0].tiles[0].result).toEqual(draft.pages[0].tiles[0].result);
 for (const plan of [null, {}, { version: 1, palette, slots: [{ key: "a", label: "A", index: 0 }, { key: "a", label: "B", index: 1 }] }]) expect(validReportColorTheme(plan)).toBe(false);
});
it("uses safe own-key bindings for constructor and prototype-shaped category IDs", () => {
 const draft = fixture(); draft.pages[0].tiles[0].result.table[0].optionId = "constructor";
 const themed = applyReportColorTheme(draft, palette), tile = themed.pages[0].tiles[0]; expect(typeof chartColor(tile, "rows", "constructor", 0)).toBe("string"); expect(Object.hasOwn(tile.appearance.reportColorSlots!.rows, "constructor")).toBe(true);
});
it("retains the plan, original palette and exact result through actual save/load", () => {
 const store = new Map<string, string>(); const previous = globalThis.window; Object.assign(globalThis, { window: { localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } } });
 try { const draft = applyReportColorTheme(fixture(), palette), workspace = normalizeDashboardWorkspace({ reports: [createReportRecord(draft)] }); expect(saveDashboardWorkspace(workspace)).toBe(true); expect(store.has(workspaceStorageKey)).toBe(true); const loaded = loadDashboardWorkspace().reports[0].draft; expect(loaded.reportColorTheme).toEqual(draft.reportColorTheme); expect(loaded.pages[0].tiles[0].appearance.reportColorSlots).toEqual(draft.pages[0].tiles[0].appearance.reportColorSlots); expect(loaded.pages[0].tiles[0].result.table).toEqual(draft.pages[0].tiles[0].result.table); }
 finally { Object.assign(globalThis, { window: previous }); }
});
it("uses the same column colors in reconstructed PDF SVG and native PowerPoint", () => {
 const draft = applyReportColorTheme(fixture(), palette), tile = draft.pages[0].tiles[0]; draft.pages[0].tiles = [tile];
 for (const column of tile.result.columns) { const color = chartColor(tile, "columns", column.id, 0); expect(buildPageVisualSvg(draft.pages[0])).toContain(`fill="${color}"`); expect(buildNativePptxChartDescriptor(tile, 1, 3, "rId2").chartXml).toContain(`val="${color.slice(1).toUpperCase()}"`); }
});
it("preserves row colors in vertical-bar PDF and native PowerPoint data points", () => {
 const draft = applyReportColorTheme(fixture(), palette), tile = draft.pages[0].tiles[0]; tile.visualization = "vertical_bar"; tile.result.columns = [tile.result.columns[0]]; draft.pages[0].tiles = [tile];
 const pptx = buildNativePptxChartDescriptor(tile, 1, 3, "rId2").chartXml;
 tile.result.table.forEach((row, index) => { const color = chartColor(tile, "rows", row.optionId, index); expect(buildPageVisualSvg(draft.pages[0])).toContain(`fill="${color}"`); expect(pptx).toContain(`<c:dPt><c:idx val="${index}"/><c:spPr><a:solidFill><a:srgbClr val="${color.slice(1).toUpperCase()}"`); });
});

it("keeps imported raw category identity when actual filters change frequency-based result IDs", async () => {
 const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Answer,Region\nYes,North\nYes,North\nNo,North\nNo,South\nNo,South\nNo,South\n").buffer, "synthetic-colors.csv");
 const result = runImportedDatasetQuery({ dataset: dataset!, field: dataset!.fields[0], metric: "count", chartType: "vertical_bar" });
 const filtered = runImportedDatasetQuery({ dataset: dataset!, field: dataset!.fields[0], filter: { field: dataset!.fields[1], value: "North" }, metric: "count", chartType: "vertical_bar" });
 const draft = fixture(), tile = draft.pages[0].tiles[0]; draft.pages[0].tiles = [tile]; tile.result = result; tile.query = result.query;
 const themed = applyReportColorTheme(draft, palette), before = themed.pages[0].tiles[0];
 const old = result.table.find(row => row.label === "Yes")!, next = filtered.table.find(row => row.label === "Yes")!; expect(next.optionId).not.toBe(old.optionId); expect(next.sourceCategoryKey).toBe(old.sourceCategoryKey);
 const oldColor = chartColor(before, "rows", old.optionId, 0);
 const changed = reconcileReportColors({ ...themed, pages: [{ ...themed.pages[0], tiles: [{ ...before, result: filtered, query: filtered.query }] }] });
 expect(chartColor(changed.pages[0].tiles[0], "rows", next.optionId, 0)).toBe(oldColor);
});

it("does not promise stable colors for imported results with missing, ambiguous or malformed source keys", async () => {
 const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Answer\nYes\nNo\n").buffer, "synthetic-legacy-colors.csv");
 const result = runImportedDatasetQuery({ dataset: dataset!, field: dataset!.fields[0], metric: "count", chartType: "vertical_bar" }), draft = fixture(), tile = draft.pages[0].tiles[0]; tile.result = result;
 expect(reportColorEligibility(tile)).toBeNull(); delete result.table[0].sourceCategoryKey;
 expect(reportColorEligibility(tile)).toMatch(/Refresh/); expect(applyReportColorTheme(draft, palette).pages[0].tiles[0].appearance.reportColorSlots).toBeUndefined();
 result.table[0].sourceCategoryKey = result.table[1].sourceCategoryKey; expect(reportColorEligibility(tile)).toMatch(/Refresh/);
 result.table[0].sourceCategoryKey = "{}"; expect(reportColorEligibility(tile)).toMatch(/Refresh/);
});

it("drops stale bindings when a replacement result lacks keys and rejoins the theme after refresh", async () => {
 const { dataset } = await importDatasetBuffer(new TextEncoder().encode("Answer\nYes\nNo\n").buffer, "synthetic-replacement.csv");
 const result = runImportedDatasetQuery({ dataset: dataset!, field: dataset!.fields[0], metric: "count", chartType: "vertical_bar" }), draft = fixture(), tile = draft.pages[0].tiles[0]; draft.pages[0].tiles = [tile]; tile.result = result;
 const themed = applyReportColorTheme(draft, palette), previousPalette = [...tile.appearance.palette];
 const missing = structuredClone(result); delete missing.table[0].sourceCategoryKey;
 const blocked = reconcileReportColors({ ...themed, pages: [{ ...themed.pages[0], tiles: [{ ...themed.pages[0].tiles[0], result: missing }] }] });
 expect(blocked.pages[0].tiles[0].appearance.reportColorSlots).toBeUndefined(); expect(blocked.pages[0].tiles[0].appearance.palette).toEqual(previousPalette);
 const restored = reconcileReportColors({ ...blocked, pages: [{ ...blocked.pages[0], tiles: [{ ...blocked.pages[0].tiles[0], result }] }] });
 expect(restored.pages[0].tiles[0].appearance.reportColorSlots!.rows).toEqual(themed.pages[0].tiles[0].appearance.reportColorSlots!.rows);
});
