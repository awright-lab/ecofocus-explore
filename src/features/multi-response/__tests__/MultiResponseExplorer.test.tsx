// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MultiResponseExplorer from "../MultiResponseExplorer";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn()); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function fixture(size = 1000) {
  const csv = ["ID,AnswerA,AnswerB,Group", ...Array.from({ length: size }, (_, i) => `${i + 1},${i >= 990 ? "" : i === 989 ? "skip" : i < 500 ? "1" : "0"},${i < 250 || i >= 500 && i < 750 ? "1" : "0"},${i < 500 ? "Core" : "Growth"}`)].join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic-response.csv");
  const draft = structuredClone(initialDashboard); draft.importedDatasets = [dataset!]; draft.savedAudiences = [];
  const props = { draft, studies: [dataset!], onClose: vi.fn() }; await act(async () => root.render(<MultiResponseExplorer {...props} />)); return props;
}
function control(label: string) { const node = Array.from(document.querySelectorAll("label")).find(node => Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE).map(child => child.textContent).join("") === label)?.querySelector("input,select"); if (!node) throw Error(label); return node as HTMLSelectElement; }
async function change(label: string, value: string) { await act(async () => { const node = control(label); Object.getOwnPropertyDescriptor(node.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }); }
async function click(text: string) { await act(async () => { const node = Array.from(document.querySelectorAll("button")).find(button => button.textContent === text); if (!node) throw Error(text); node.click(); }); }
async function configure(props: Awaited<ReturnType<typeof fixture>>) { await change("Respondent ID field", props.studies[0].fields[0].id); await change("Response 1 field", props.studies[0].fields[1].id); await change("Response 2 field", props.studies[0].fields[2].id); await click("Use 1 / 0 for chosen responses"); await act(async () => document.querySelector<HTMLInputElement>('.multi-response-base input')!.click()); }
async function run() { await click("Analyze responses"); await act(async () => vi.runAllTimersAsync()); }
function table(caption: string) { return Array.from(document.querySelectorAll("table")).find(node => node.caption?.textContent?.startsWith(caption))!; }
it("runs the real imported-data job, displays respondent unions and overlap, preserves source and supports subset exploration", async () => {
  const props = await fixture(), before = structuredClone({ draft: props.draft, studies: props.studies }); await configure(props); await run();
  expect(document.querySelector('.multi-response-metrics')?.textContent).toContain("989");
  expect(table("Combined-response counts").textContent).toMatch(/union\)750.*intersection\)250.*answers239/);
  expect(table("Response reach").textContent).toContain("50.6%");
  expect(table("People selecting both").textContent).toMatch(/500250.*250500/);
  await act(async () => document.querySelectorAll<HTMLInputElement>('.multi-response-combination input')[1].click());
  expect(table("Combined-response counts").textContent).toMatch(/union\)500.*intersection\)500.*answers489/);
  expect(props.draft).toEqual(before.draft); expect(props.studies).toEqual(before.studies); expect(fetch).not.toHaveBeenCalled();
});
it("requires explicit review and refuses duplicate identities without changing the source", async () => {
  const props = await fixture(); expect(Array.from(document.querySelectorAll('button')).find(node => node.textContent === 'Analyze responses')!.disabled).toBe(true);
  props.studies[0].rows[1].ID = '1'; const before = structuredClone(props.studies); await configure(props); await run();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('unique'); expect(document.querySelector('[aria-label="Multiple-response results"]')).toBeNull(); expect(props.studies).toEqual(before);
});
it("cancels an active chunked run and permits retry", async () => {
  const props = await fixture(); await configure(props); await click('Analyze responses'); await click('Cancel response analysis'); await act(async () => vi.runAllTimersAsync());
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('canceled'); expect(document.querySelector('[aria-label="Multiple-response results"]')).toBeNull(); await run(); expect(document.querySelector('[aria-label="Multiple-response results"]')).not.toBeNull();
});
it("hides changed-source results and requires replacement import review instead of silently rebinding", async () => {
  const props = await fixture(); await configure(props); await run(); props.studies[0].rows[0].AnswerA = '0'; await act(async () => root.render(<MultiResponseExplorer {...props} />));
  expect(document.querySelector('[aria-label="Multiple-response results"]')).toBeNull(); expect(document.querySelector('[role="alert"]')?.textContent).toContain('changed');
  props.studies[0].importedAt = '2026-11-09T00:00:00Z'; await act(async () => root.render(<MultiResponseExplorer {...props} />)); await click('Review this replacement import and reset mappings'); expect(control('Respondent ID field').value).toBe(''); expect(control('Response 1 field').value).toBe('');
});
it("invalidates results and explicit review after editing mappings", async () => {
  const props = await fixture(); await configure(props); await run(); await change('Response 1 selected code', 'yes'); expect(document.querySelector('[aria-label="Multiple-response results"]')).toBeNull(); expect(document.querySelector<HTMLInputElement>('.multi-response-base input')!.checked).toBe(false);
});
it("focuses the dialog, makes background inert and handles Escape", async () => {
  const props = await fixture(), dialog = document.querySelector('[role="dialog"]')!; expect(document.activeElement).toBe(dialog); expect(host.inert).toBe(true); await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); expect(props.onClose).toHaveBeenCalledOnce();
});

it.each(['__proto__', 'constructor', 'toString'])("renders an unlabeled prototype-named raw code %s safely and preserves explicit own labels", async code => {
  const props = await fixture(); props.studies[0].rows[0].AnswerA = code;
  props.studies[0].fields[1].valueLabels = {};
  await configure(props);
  const list = document.querySelector('#response-code-examples-0')!;
  expect(Array.from(list.querySelectorAll('option')).find(option => option.value === code)?.textContent).toBe(code);
  Object.defineProperty(props.studies[0].fields[1].valueLabels, code, { value: 'Explicit answer label', enumerable: true });
  await act(async () => root.render(<MultiResponseExplorer {...props} />));
  expect(Array.from(list.querySelectorAll('option')).find(option => option.value === code)?.textContent).toBe('Explicit answer label');
  await change('Response 1 selected code', code); await act(async () => document.querySelector<HTMLInputElement>('.multi-response-base input')!.click()); await run();
  expect(document.querySelector('[aria-label="Multiple-response results"]')).not.toBeNull(); expect(fetch).not.toHaveBeenCalled();
});

