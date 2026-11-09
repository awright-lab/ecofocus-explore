// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NumericDistribution } from "../NumericDistribution";
import { NumericFieldProfile } from "../NumericFieldProfile";
import { importDatasetBuffer } from "../../../data/datasetImportModel";
import type { NumericDistributionBin } from "../../../data/importedNumericProfile";
let host: HTMLDivElement, outside: HTMLButtonElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
const bins = (): NumericDistributionBin[] => [{ lower: 0, upper: 5, count: 1, includesUpper: false }, { lower: 5, upper: 10, count: 2, includesUpper: true }];
const selector = () => host.querySelector<HTMLSelectElement>("select")!;
async function mode(value: string) { await act(async () => { selector().focus(); selector().value = value; selector().dispatchEvent(new Event("change", { bubbles: true })); }); }
const values = () => Array.from(host.querySelectorAll("[data-view-value]"), node => Number(node.getAttribute("data-view-value")));
it("switches exact chart values, clear axes/context and a complete associated table while preserving counts", async () => {
 const input = bins(), before = structuredClone(input); await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>));
 expect(selector().value).toBe("count"); expect(values()).toEqual([1, 2]); expect(host.querySelector("svg")!.getAttribute("aria-label")).toContain("unweighted response counts");
 await mode("percent"); expect(values()).toEqual([100 / 3, 200 / 3]); expect(host.querySelector("svg")!.getAttribute("aria-label")).toContain("percent of valid numeric values"); expect(host.querySelector("svg")!.textContent).toContain("100%");
 await mode("cumulative"); expect(values()).toEqual([100 / 3, 100]); expect(host.querySelector("svg")!.getAttribute("aria-label")).toContain("cumulative percent"); expect(document.getElementById(host.querySelector("svg")!.getAttribute("aria-describedby")!)!.textContent).toContain("all earlier ranges"); expect(document.activeElement).toBe(selector());
 expect(Array.from(host.querySelectorAll("tbody tr"), row => Array.from(row.querySelectorAll("td"), cell => cell.textContent))).toEqual([["1", "33.3%", "33.3%"], ["2", "66.7%", "100%"]]); expect(host.querySelector("caption")!.textContent).toContain("Spend"); expect(host.querySelector('[role="region"]')?.getAttribute("tabindex")).toBe("0"); expect(input).toEqual(before);
 await mode("count"); expect(values()).toEqual([1, 2]);
});
it("does not display a rare value as zero or a partial range as complete", async () => {
 const input = bins(); input[1].count = 49999; await act(async () => root.render(<NumericDistribution bins={input} valid={50000} label="Rare measure"/>)); await mode("percent"); expect(values()).toEqual([0.002, 99.998]); expect(host.querySelector("table")!.textContent).toContain("0.002%"); expect(host.querySelector("table")!.textContent).toContain("99.998%"); expect(host.querySelector("rect title")!.textContent).toContain("1 of 50,000");
});
it.each(["owned", "outside", "blur"])("handles invalidated distribution controls without stealing focus: %s", async owner => {
 const input = bins(); await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>)); selector().focus(); if (owner === "outside") outside.focus(); if (owner === "blur") selector().blur(); input[1].count = 0;
 await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>)); expect(host.querySelector("svg")).toBeNull(); expect(host.querySelector("select")).toBeNull(); expect(host.textContent).toContain("totals do not match"); expect(document.activeElement).toBe(owner === "owned" ? host.querySelector("figure") : owner === "outside" ? outside : document.body);
});
it("uses the actual profile's valid denominator and updates selected-field context without editing source", async () => {
 const imported = await importDatasetBuffer(new TextEncoder().encode("Spend,Other,Region\n0,10,A\n5,20,B\n10,30,A\n,40,B\ninvalid,50,A\n").buffer, "synthetic-distribution.csv"); const dataset = imported.dataset!; const before = structuredClone(dataset);
 await act(async () => root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[0]}/>)); await mode("cumulative"); expect(values()).toEqual([100 / 3, 100]); expect(host.textContent).toContain("3 valid values");
 await act(async () => root.render(<NumericFieldProfile dataset={dataset} field={dataset.fields[1]}/>)); expect(host.querySelector("svg")!.getAttribute("aria-label")).toContain("Other"); expect(values().at(-1)).toBe(100); expect(host.textContent).toContain("5 valid values"); expect(dataset).toEqual(before);
});

it.each([...["summary", "table"].flatMap(control => ["owned", "outside", "blur"].map(owner => ({ control, owner })))])("handles removed expanded $control focus without stealing focus: $owner", async ({ control, owner }) => {
 const input = bins(); await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>));
 const details = host.querySelector<HTMLDetailsElement>("details")!; details.open = true;
 const target = control === "summary" ? details.querySelector<HTMLElement>("summary")! : details.querySelector<HTMLElement>('[role="region"]')!;
 target.focus(); expect(document.activeElement).toBe(target); if (owner === "outside") outside.focus(); if (owner === "blur") target.blur(); input[1].count = 0;
 await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>)); expect(target.isConnected).toBe(false); expect(host.querySelector("details")).toBeNull(); expect(host.querySelector("svg")).toBeNull(); expect(document.activeElement).toBe(owner === "owned" ? host.querySelector("figure") : owner === "outside" ? outside : document.body); expect(host.querySelector("figure")!.getAttribute("data-canvas-keyboard-scope")).toBe("controls");
});
it.each(["hidden", "inert"])("does not focus a fallback inside a newly %s panel", async attribute => {
 const input = bins(); await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>)); selector().focus(); expect(document.activeElement).toBe(selector()); host.setAttribute(attribute, ""); input[1].count = 0;
 await act(async () => root.render(<NumericDistribution bins={input} valid={3} label="Spend"/>)); expect(host.querySelector("select")).toBeNull(); expect(document.activeElement).toBe(document.body);
});
