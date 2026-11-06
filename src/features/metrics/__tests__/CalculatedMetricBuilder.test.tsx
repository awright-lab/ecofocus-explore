// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import CalculatedMetricBuilder from "../CalculatedMetricBuilder";
import { formulaFixture } from "./formulaFixture";
import { commitCellFormula, previewCellFormula } from "../cellFormulaCommands";
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("No services"))); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup(saved = false) {
  const fixture = await formulaFixture(); let current = saved ? commitCellFormula(fixture.draft, fixture.plan, previewCellFormula(fixture.draft, fixture.plan).token, "create", { pageId: "result-page", tileId: "result-tile" }).draft : fixture.draft;
  const onClose = vi.fn(), onNavigate = vi.fn(), onChange = vi.fn((update: Parameters<React.ComponentProps<typeof CalculatedMetricBuilder>["onChange"]>[0]) => { current = update(current); render(); return true; });
  function render() { root.render(<CalculatedMetricBuilder draft={current} selectedTileId={fixture.source.id} onClose={onClose} onNavigate={onNavigate} onChange={onChange} onCreateAnalysis={() => {}} />); }
  await act(async () => render()); return { ...fixture, get current() { return current; }, onClose, onNavigate, onChange, render };
}
function control(label: string): HTMLInputElement | HTMLSelectElement { const node = Array.from(document.querySelectorAll("label")).find(item => item.firstChild?.textContent === label)?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select"); if (!node) throw Error(label); return node; }
async function change(label: string, value: string) { await act(async () => { const node = control(label), prototype = node.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }); }
async function click(name: string) { await act(async () => { const button = Array.from(document.querySelectorAll("button")).find(item => item.textContent === name); if (!button) throw Error(name); button.click(); }); }
async function configure(fixture: Awaited<ReturnType<typeof setup>>) { await change("Source column", fixture.plan.columnId); await change("A: first input", fixture.plan.rowId); await change("B: second input", fixture.plan.comparedRowId); await change("Metric name", "Ratio A/B"); }
async function consent() { await act(async () => document.querySelector<HTMLInputElement>('.calculated-metric-consent input')!.click()); }
it("previews exact cells without writes, requires review, and atomically saves a reusable formula plus new result page", async () => {
  const fixture = await setup(), original = structuredClone(fixture.current); await configure(fixture); await click("Preview formula"); expect(fixture.onChange).not.toHaveBeenCalled(); expect(document.querySelector('[aria-label="Calculated metric preview"]')?.textContent).toContain("0.4285714286");
  expect(Array.from(document.querySelectorAll("button")).find(item => item.textContent === "Save formula and add result page")?.disabled).toBe(true);
  await consent(); await click("Save formula and add result page"); expect(fixture.onChange).toHaveBeenCalledOnce(); expect(fixture.current.pages).toHaveLength(2); expect(fixture.current.pages[0]).toEqual(original.pages[0]); expect(fixture.current.importedDatasets).toEqual(original.importedDatasets); expect(fixture.current.analysisLibrary.derivedDefinitions).toHaveLength(1); expect(fixture.onNavigate).toHaveBeenCalledOnce(); expect(fetch).not.toHaveBeenCalled();
});
it("invalidates preview and consent after formula edits or in-place source changes", async () => {
  const fixture = await setup(); await configure(fixture); await click("Preview formula"); await consent(); await change("Formula expression", "A/B*100"); expect(document.querySelector('[aria-label="Calculated metric preview"]')).toBeNull(); await click("Preview formula"); expect(document.querySelector<HTMLInputElement>('.calculated-metric-consent input')?.checked).toBe(false);
  fixture.current.pages[0].tiles[0].result.table[0].bases.summary = 999; await act(async () => fixture.render()); expect(document.querySelector('[aria-label="Calculated metric preview"]')).toBeNull(); expect(fixture.onChange).not.toHaveBeenCalled();
});
it("saves a reusable definition without adding a page, then reuses its protected bindings", async () => {
  const fixture = await setup(); await configure(fixture); await click("Preview formula"); await consent(); await click("Save definition only");
  expect(fixture.current.pages).toHaveLength(1); expect(fixture.current.analysisLibrary.derivedDefinitions).toHaveLength(1); expect(document.querySelector('[aria-label="Calculated metric preview"]')).not.toBeNull();
  expect(document.querySelector('.calculated-metric-notice')?.textContent).toBeTruthy(); await change("Formula expression", "A/B*100"); await click("Preview formula"); await consent(); await click("Save formula and add result page");
  expect(fixture.current.pages).toHaveLength(2); expect(fixture.current.analysisLibrary.derivedDefinitions).toHaveLength(1); expect(fixture.current.pages[1].tiles[0].result.table[0].values.summary).toBe(300 / 700 * 100);
});
it("loads saved expressions without rebinding changed category meanings until explicitly reviewed", async () => {
  const fixture = await setup(true); fixture.current.pages[0].tiles[0].result.table.find(row => row.optionId === fixture.plan.rowId)!.sourceCategoryKey = '"replacement"'; await act(async () => fixture.render()); await change("Saved formula", "formula-test");
  expect(document.querySelector('[role="status"]')?.textContent).toContain("meaning changed"); expect(document.querySelector('[aria-label="Calculated metric preview"]')).toBeNull(); await click("Review current cell bindings explicitly"); await click("Preview formula"); expect(document.querySelector('[aria-label="Calculated metric preview"]')).not.toBeNull();
});
it("loads an existing result for explicit refresh, and removing its definition preserves result pages", async () => {
  const fixture = await setup(true), beforePages = structuredClone(fixture.current.pages); await click("Edit or refresh this result"); expect(control("Formula expression").value).toBe("A / B * 100"); await click("Preview formula"); await consent(); await click("Save and refresh selected result"); expect(fixture.current.pages).toHaveLength(2); expect(fixture.onNavigate).toHaveBeenCalledWith("result-page", "result-tile");
  await change("Saved formula", "formula-test"); await click("Remove saved definition"); expect(fixture.current.analysisLibrary.derivedDefinitions).toHaveLength(0); expect(fixture.current.pages[0]).toEqual(beforePages[0]); expect(fixture.current.pages[1].tiles[0].result).toEqual(beforePages[1].tiles[0].result);
});
it("refuses zero denominators and closes with focus isolated from the background", async () => {
  const fixture = await setup(); await configure(fixture); await change("Formula expression", "A/(B-B)"); expect(document.querySelector('[role="status"]')?.textContent).toContain("Division by zero"); expect(fixture.onChange).not.toHaveBeenCalled();
  const modal = document.querySelector('[role="dialog"]')!; expect(host.inert).toBe(true); await act(async () => modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(fixture.onClose).toHaveBeenCalledOnce();
});
it("copies a saved formula into a separate definition without overwriting the original", async () => {
  const fixture = await setup(true), original = structuredClone(fixture.current.analysisLibrary.derivedDefinitions[0]);
  await change("Saved formula", "formula-test"); await click("Make a new formula from these choices"); await change("Metric name", "Independent ratio"); await click("Ratio"); await click("Preview formula"); await consent(); await click("Save definition only");
  expect(fixture.current.analysisLibrary.derivedDefinitions).toHaveLength(2); expect(fixture.current.analysisLibrary.derivedDefinitions.find(item => item.id === original.id)).toEqual(original); expect(fixture.current.pages).toHaveLength(2);
});
