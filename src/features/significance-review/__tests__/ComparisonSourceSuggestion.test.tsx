// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ComparisonReview from "../ComparisonReview";
import { ComparisonSourceSuggestion } from "../ComparisonSourceSuggestion";
import { comparisonSuggestionFixture } from "./comparisonSuggestionFixture";
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn()); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function control(label: string) { const node = Array.from(document.querySelectorAll("label")).find(n => Array.from(n.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("") === label)?.querySelector("input,select,textarea"); if (!node) throw Error(label); return node as HTMLInputElement; }
function input(label: string, value: string) { const node = control(label), proto = node.tagName === "SELECT" ? HTMLSelectElement.prototype : node.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value); node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }
async function change(label: string, value: string) { await act(async () => input(label, value)); }
function button(text: string) { const node = Array.from(document.querySelectorAll("button")).find(n => n.textContent === text); if (!node) throw Error(text); return node; }
async function click(text: string) { await act(async () => { button(text).focus(); button(text).click(); }); }
async function mount() { const f = await comparisonSuggestionFixture(), props = { ...f, onClose: vi.fn() }; await act(async () => root.render(<ComparisonReview {...props}/>)); document.querySelector<HTMLDetailsElement>(".comparison-source-suggestion")!.open = true; await change("Report analysis", f.origin); return props; }
async function code(legend: string, raw: string) { await act(async () => { const fs = Array.from(document.querySelectorAll("fieldset")).find(n => n.querySelector("legend")?.textContent === legend), label = Array.from(fs?.querySelectorAll("label") ?? []).find(n => n.querySelector("small")?.textContent === `Raw: ${JSON.stringify(raw)}`); label!.querySelector<HTMLInputElement>("input")!.click(); }); }
it("seeds the real comparison editor without making assumptions, running, fetching or writing", async () => {
  const f = await mount(), before = JSON.stringify({ draft: f.draft, studies: f.studies }), writes = vi.spyOn(Storage.prototype, "setItem"); await click("Use source-field suggestions");
  expect(control("Comparison study").value).toBe(f.study.id); expect(control("Outcome field").value).toBe(f.study.fields[2].id); expect(control("Group field").value).toBe(f.study.fields[1].id); expect(control("Respondent ID field").value).toBe(""); expect(control("Sampling design").value).toBe("unknown"); expect(control("Research question").value).toBe(""); expect(button("Run reviewed comparisons").disabled).toBe(true);
  expect(document.querySelector('[aria-label="Reviewed group comparisons"]')).toBeNull(); expect(JSON.stringify({ draft: f.draft, studies: f.studies })).toBe(before); expect(fetch).not.toHaveBeenCalled(); expect(writes).not.toHaveBeenCalled();
});
it("requires explicit choices and computes actual raw-row comparisons after starting from fields", async () => {
  const f = await mount(), before = JSON.stringify({ draft: f.draft, studies: f.studies }); await click("Use source-field suggestions");
  await change("Research question", "Do event rates differ?"); await change("Respondent ID field", f.study.fields[0].id); await change("Reference group", "Ref"); await code("Comparison groups", "A"); await code("Comparison groups", "B"); await code("Event response codes", "Y"); await change("Sampling design", "unweighted_independent"); await change("Sampling and research note", "Synthetic independent unweighted respondents and prespecified two-group family.");
  await act(async () => { Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(n => n.parentElement?.textContent?.startsWith("I reviewed the sampling assumptions"))!.click(); });
  await click("Run reviewed comparisons"); await act(async () => vi.runAllTimersAsync()); expect(document.querySelector('[aria-label="Exact comparison results"]')?.textContent).toContain("8 / 10"); expect(document.body.textContent).toContain("0.06993"); expect(JSON.stringify({ draft: f.draft, studies: f.studies })).toBe(before); expect(fetch).not.toHaveBeenCalled();
});
it.each(["Research question", "Family-wise alpha"])("retains existing %s edits instead of replacing the working plan", async label => {
  await mount(); await change(label, label === "Research question" ? "Existing work" : "0.01"); await click("Use source-field suggestions"); expect(control("Comparison study").value).toBe(""); expect(control(label).value).toBe(label === "Research question" ? "Existing work" : "0.01"); expect(document.body.textContent).toContain("current working plan was retained"); expect(document.activeElement).toBe(button("Use source-field suggestions"));
});
it("protects a typed edit followed by Apply in the same event batch", async () => {
  await mount(); await act(async () => { input("Research question", "Same-batch edit"); button("Use source-field suggestions").click(); }); expect(control("Research question").value).toBe("Same-batch edit"); expect(control("Comparison study").value).toBe(""); expect(document.body.textContent).toContain("current working plan was retained");
});
it("rechecks changed source metadata at click time even without a rerender", async () => {
  const f = await mount(); f.study.fields[2].sourceColumn = "Replacement"; await click("Use source-field suggestions"); expect(control("Comparison study").value).toBe(""); expect(document.body.textContent).toContain("changed while this suggestion was open"); expect(document.activeElement).toBe(button("Use source-field suggestions"));
});
it("retains the selected option while searching beyond the first 100 entries", async () => {
  const f = await comparisonSuggestionFixture(), page = f.draft.pages[0]; page.tiles = Array.from({ length: 120 }, (_, i) => ({ ...structuredClone(f.tile), id: `tile-${i}`, title: `Finding ${i}` })); const onStart = vi.fn(() => true);
  await act(async () => root.render(<ComparisonSourceSuggestion {...f} hasWork={false} onStart={onStart}/>)); document.querySelector("details")!.open = true; await change("Find a report analysis", "Finding 119"); const key = JSON.stringify([page.id, "tile-119"]); await change("Report analysis", key); await change("Find a report analysis", "unmatched"); expect(control("Report analysis").value).toBe(key); await click("Use source-field suggestions"); expect(onStart).toHaveBeenCalledTimes(1);
});
