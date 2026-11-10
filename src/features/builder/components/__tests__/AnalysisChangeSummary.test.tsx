// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnalysisChangeExplorer } from "../AnalysisChangeExplorer";
import { changeSummaryFixture, zeroBaseChangeFixture } from "../../../analytics/__tests__/changeSummaryFixture";
import { editorControlsOwnCanvasKeys } from "../../editorModalGuard";
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn()); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function tableRows() { const caption = Array.from(host.querySelectorAll("caption")).find(c => c.textContent?.startsWith("Complete results")); return Array.from(caption?.parentElement?.querySelectorAll("tbody tr") ?? []); }
function order() { return Array.from(host.querySelectorAll("label")).find(l => l.textContent?.startsWith("Preferred answer order"))!.querySelector("select")!; }
async function largest() { await act(async () => { order().value = "largest"; order().dispatchEvent(new Event("change", { bubbles: true })); }); }
it("summarizes all selected-column cells, hides only identical entries and orders changes without writes", async () => {
 const { before, after, dataset } = await changeSummaryFixture(), original = structuredClone({ before, after, dataset }); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>));
 expect(host.textContent).toContain("3 changed values; 0 changed bases"); expect(host.textContent).toContain("1 identical comparable entries"); await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await largest();
 expect(tableRows().map(r => r.querySelector("th")?.textContent)).toEqual(["A", "B", "D"]); expect(host.textContent).toContain("1–3 of 3 matching answers"); expect({ before, after, dataset }).toEqual(original); expect(fetch).not.toHaveBeenCalled();
});
it("keeps unknown comparisons visible and explains the requested ranking fallback", async () => {
 const { before, after } = await changeSummaryFixture(); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>)); await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); await largest(); expect(tableRows()).toHaveLength(3);
 after.query.weight = "weightvar"; const original = structuredClone({ before, after }); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>));
 expect(tableRows()).toHaveLength(4); expect(host.textContent).toContain("Arithmetic ranking is unavailable for these results. Source order is shown."); expect(tableRows().every(r => r.lastElementChild?.textContent === "Not comparable")).toBe(true); expect({ before, after }).toEqual(original);
});
it("refreshes the summary after same-reference result values change", async () => {
 const { before, after } = await changeSummaryFixture(); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>)); await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); expect(tableRows()).toHaveLength(3);
 after.table.find(r => r.label === "C")!.values[after.columns[0].id] += 1; const original = structuredClone({ before, after }); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>)); expect(tableRows()).toHaveLength(4); expect(host.textContent).toContain("4 changed values"); expect({ before, after }).toEqual(original);
});
it.each(["search", "column", "order", "checkbox", "next"])("retains focused %s controls when invalid replacement hides the result table", async control => {
 const { before, after } = await changeSummaryFixture(); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>));
 const focused = control === "search" ? host.querySelector<HTMLInputElement>('input[type="search"]')! : control === "column" ? host.querySelector("select")! : control === "order" ? order() : control === "checkbox" ? host.querySelector<HTMLInputElement>('input[type="checkbox"]')! : Array.from(host.querySelectorAll("button")).find(b => b.textContent === "Next answers")!;
 focused.focus(); let guarded = false; focused.addEventListener("keydown", event => { guarded = editorControlsOwnCanvasKeys(event as KeyboardEvent); }); focused.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })); expect(guarded).toBe(true);
 after.table[1].sourceCategoryKey = after.table[0].sourceCategoryKey; await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>)); expect(host.querySelector('[role="alert"]')).not.toBeNull(); expect(tableRows()).toHaveLength(0); expect(focused.isConnected).toBe(true); expect(document.activeElement).toBe(focused);
});

it.each(["average", "percent_selected"] as const)("shows the known %s base change and unavailable n=0 output together", async metric => {
 const { before, after, dataset } = await zeroBaseChangeFixture(metric), original = structuredClone({ before, after, dataset }); await act(async () => root.render(<AnalysisChangeExplorer before={before} after={after}/>));
 expect(host.textContent).toContain("0 changed values; 1 changed bases"); expect(tableRows().some(r => r.textContent?.includes("n=100") && r.textContent?.includes("n=0") && r.textContent?.includes("Unavailable"))).toBe(true);
 await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); expect(tableRows()).toHaveLength(1); expect({ before, after, dataset }).toEqual(original);
});
