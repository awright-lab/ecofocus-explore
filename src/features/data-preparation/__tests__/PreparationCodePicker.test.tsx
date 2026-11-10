// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi, type Mock } from "vitest";
import PreparationCodePicker from "../PreparationCodePicker";
let root: Root, host: HTMLDivElement, outside: HTMLButtonElement, fallback: { current: HTMLButtonElement | null }, selected: Mock<(values: string[]) => void>;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); fallback = { current: outside }; selected = vi.fn(); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
function Harness({ values, initial = [] }: { values: string[]; initial?: string[] }) { const [choices, setChoices] = useState(initial); return <PreparationCodePicker values={values} selected={choices} onSelected={next => { selected(next); setChoices(next); }} fallback={fallback}/>; }
const input = () => host.querySelector<HTMLInputElement>('input:not([type="checkbox"])')!;
const box = (value: string) => Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(n => n.getAttribute("aria-label") === `Select raw code ${JSON.stringify(value)}`)!;
const button = (label: string) => Array.from(host.querySelectorAll("button")).find(n => n.textContent === label || n.getAttribute("aria-label") === label)!;
async function click(label: string) { await act(async () => { const b = button(label); b.focus(); b.click(); }); }
async function search(value: string) { await act(async () => { const n = input(); n.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(n, value); n.dispatchEvent(new Event("input", { bubbles: true })); }); }
it("reaches codes beyond500 and retains exact selections across pages and filtered views", async () => {
  const values = Array.from({ length: 1000 }, (_, i) => `Code-${String(i).padStart(5, "0")}`), before = [...values]; await act(async () => root.render(<Harness values={values}/>)); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(50); await act(async () => box(values[0]).click()); await click("Last code page"); expect(box(values[999])).toBeDefined(); await act(async () => box(values[999]).click()); expect(selected).toHaveBeenLastCalledWith([values[0], values[999]]);
  await search(values[700]); await act(async () => box(values[700]).click()); expect(selected).toHaveBeenLastCalledWith([values[0], values[999], values[700]]); await search("no match"); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(0); expect(host.querySelectorAll('.preparation-selected-codes li')).toHaveLength(3); expect(host.textContent).toContain("Selected raw codes (3 of 100)"); await search(""); expect(box(values[0]).checked).toBe(true); expect(values).toEqual(before);
});
it("distinguishes exact escaped line endings, blank and whitespace without normalizing raw selections", async () => {
  const values = ["", " ", "A\rB", "A\nB", "A\r\nB", "A\\rB"]; await act(async () => root.render(<Harness values={values}/>));
  for (const value of values) { await search(JSON.stringify(value)); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(1); await act(async () => box(value).click()); expect(selected.mock.calls.at(-1)![0]).toContain(value); }
  expect(selected).toHaveBeenLastCalledWith(values); expect(Array.from(host.querySelectorAll('.preparation-selected-codes code')).map(n => JSON.parse(n.textContent!))).toEqual(values);
});
it("enforces the100-code limit before preview and allows removal/replacement without dropping hidden choices", async () => {
  const values = Array.from({ length: 101 }, (_, i) => `V${String(i).padStart(3, "0")}`); await act(async () => root.render(<Harness values={values} initial={values.slice(0, 100)}/>)); await search(values[100]); const last = box(values[100]); expect(last.getAttribute("aria-disabled")).toBe("true"); await act(async () => last.click()); expect(selected).not.toHaveBeenCalled(); expect(last.checked).toBe(false); expect(host.textContent).toContain("Select at most 100");
  await click(`Remove selected raw code ${JSON.stringify(values[0])}`); expect(document.activeElement).toBe(host.querySelector("h4")); await act(async () => box(values[100]).click()); expect(selected).toHaveBeenLastCalledWith([...values.slice(1, 100), values[100]]); expect(host.querySelectorAll('.preparation-selected-codes li')).toHaveLength(100);
});
it("discloses overlong codes and refuses an entire oversized list while retaining externally restored selections", async () => {
  const long = "L".repeat(513), seed = ["Restored"], values = ["Normal", long]; await act(async () => root.render(<Harness values={values} initial={seed}/>)); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(1); expect(host.textContent).toContain("1 codes exceed"); expect(host.textContent).toContain("Not in the current selectable list"); const large = Array.from({ length: 10000 }, (_, i) => String(i).padEnd(512, "x")); await act(async () => root.render(<Harness values={large}/>)); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(0); expect(host.textContent).toContain("No partial list"); expect(host.querySelector('.preparation-selected-codes code')!.textContent).toBe('"Restored"'); expect(selected).not.toHaveBeenCalled();
});
it.each(["inside", "outside", "blur"] as const)("conditionally keeps focus when a focused code disappears for %s ownership", async owner => {
  const values = ["A", "B"]; await act(async () => root.render(<Harness values={values}/>)); const a = box("A"); a.focus(); if (owner === "outside") outside.focus(); if (owner === "blur") a.blur(); const active = document.activeElement; await act(async () => root.render(<Harness values={["B"]}/>)); expect(document.activeElement).toBe(owner === "inside" ? input() : active); expect(selected).not.toHaveBeenCalled();
});
it.each(["inside", "outside", "blur"] as const)("does not lose or steal focus on picker removal for %s ownership", async owner => {
  await act(async () => root.render(<Harness values={["A"]}/>)); box("A").focus(); if (owner === "outside") outside.focus(); if (owner === "blur") box("A").blur(); const active = document.activeElement; await act(async () => root.render(null)); expect(document.activeElement).toBe(owner === "inside" ? outside : active);
});

it("offers whole escaped-display matching without changing selected codes or recipe", async () => {
 const values = ["", '\"', "A\rB", "A\nB"]; await act(async () => root.render(<Harness values={values}/>)); await search('""'); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(2);
 const exact = host.querySelector<HTMLInputElement>('.preparation-code-exact input')!; await act(async () => exact.click()); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(1); expect(box("")).toBeDefined(); await act(async () => box("").click()); expect(selected).toHaveBeenLastCalledWith([""]); await search(JSON.stringify("A\rB")); expect(host.querySelectorAll('.preparation-choices input')).toHaveLength(1); expect(box("A\rB")).toBeDefined(); expect(selected).toHaveBeenCalledTimes(1);
});

it("keeps both selections from a single event batch and guards the cap using pending choices", async () => {
 const values = Array.from({ length: 102 }, (_, i) => `Code-${String(i).padStart(3, "0")}`); await act(async () => root.render(<Harness values={values}/>)); await act(async () => { box(values[0]).click(); box(values[1]).click(); }); expect(selected).toHaveBeenLastCalledWith([values[0], values[1]]); expect(host.textContent).toContain("Selected raw codes (2 of 100)");
 await act(async () => root.render(null)); await act(async () => root.render(<Harness values={values} initial={values.slice(0, 99)}/>)); await click("Last code page"); await act(async () => { box(values[100]).click(); box(values[101]).click(); }); expect(selected).toHaveBeenLastCalledWith([...values.slice(0, 99), values[100]]); expect(host.textContent).toContain("Selected raw codes (100 of 100)"); expect(box(values[101]).checked).toBe(false);
});

it("renders different visible and accessible choices for an empty code and literal blank-marker text", async () => {
 const values = ["", "[blank]", '\"\"', " "]; await act(async () => root.render(<Harness values={values}/>)); const labels = Array.from(host.querySelectorAll('.preparation-choices label')).map(n => n.textContent); expect(new Set(labels).size).toBe(values.length); expect(labels).toContain('""'); expect(labels).toContain("[blank]"); await act(async () => box("").click()); expect(selected).toHaveBeenLastCalledWith([""]); expect(box("[blank]").checked).toBe(false); expect(box('""').checked).toBe(false);
});
