// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LinearModelExplorer from "../LinearModelExplorer";
import { computeLinearModel } from "../linearModelComputation";
import type { NumericModelCase } from "../linearModelMath";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import reference from "./linear-model-numpy-reference.json";

class TestWorker {
  static instances: TestWorker[] = []; static fail = false; static pending = false;
  onmessage: ((event: MessageEvent) => void) | null = null; onerror: (() => void) | null = null; onmessageerror = null;
  posted?: { cases: NumericModelCase[]; seed: number }; terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
  postMessage(input: { cases: NumericModelCase[]; seed: number }) { this.posted = structuredClone(input); if (!TestWorker.pending) this.complete(); }
  complete() { if (TestWorker.fail) this.onerror?.(); else this.onmessage?.({ data: { type: "complete", result: computeLinearModel(this.posted!.cases, this.posted!.seed) } } as MessageEvent); }
}
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("Worker", TestWorker); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("No model services"))); TestWorker.instances = []; TestWorker.fail = TestWorker.pending = false; host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function fixture() {
  const csv = ["Outcome,PredictorA,PredictorB,Group,Respondent ID", ...reference.cases.map((row, index) => `${row.outcome},${row.predictors[0]},${row.predictors[1]},${index % 2 ? "B" : "A"},${index + 1}`)].join("\n");
  const { dataset } = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic-model.csv");
  const draft = structuredClone(initialDashboard); draft.importedDatasets = [];
  const props = { draft, studies: [dataset!], onClose: vi.fn() };
  await act(async () => root.render(<LinearModelExplorer {...props} />)); return props;
}
function control<T extends HTMLElement>(label: string): T { const node = Array.from(document.querySelectorAll("label")).find(node => node.firstChild?.textContent === label)?.querySelector("input,select"); if (!node) throw Error(`Missing ${label}`); return node as T; }
async function change(label: string, value: string) { await act(async () => { const node = control<HTMLSelectElement>(label); const prototype = node.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event(node.tagName === "SELECT" ? "change" : "input", { bubbles: true })); }); }
async function click(text: string) { await act(async () => { const node = Array.from(document.querySelectorAll("button")).find(button => button.textContent === text); if (!node) throw Error(text); node.click(); }); }
async function selectPredictor(name: string) { await act(async () => { const node = Array.from(document.querySelectorAll(".model-fields label")).find(label => label.textContent?.startsWith(name))?.querySelector<HTMLInputElement>("input"); if (!node) throw Error(name); node.click(); }); }
async function setup(props: Awaited<ReturnType<typeof fixture>>) { await change("Numeric outcome", props.studies[0].fields[0].id); await selectPredictor("PredictorA"); await selectPredictor("PredictorB"); }
async function fit() { await click("Fit exploratory model"); await act(async () => vi.runOnlyPendingTimersAsync()); }

it("fits the actual job and renders holdout, coefficients, accessible plots and every diagnostic row without modifying source", async () => {
  const props = await fixture(), original = structuredClone({ draft: props.draft, studies: props.studies }); await setup(props); await fit();
  expect(document.querySelector('[aria-label="Holdout model metrics"]')?.textContent).toContain("36 rows");
  expect(document.querySelector('[aria-label="Training model metrics"]')?.textContent).toContain("144 rows");
  expect(document.querySelector('[aria-label="Model population"]')?.textContent).toContain("180 complete cases");
  expect(document.querySelectorAll('svg[role="img"]')).toHaveLength(3);
  expect(document.querySelectorAll('.model-plots circle')).toHaveLength(108);
  expect(document.body.textContent).toContain("Associations, not causes");
  await click("Next model cases"); expect(document.body.textContent).toMatch(/Showing 26.36 of 36/);
  expect(props.draft).toEqual(original.draft); expect(props.studies).toEqual(original.studies); expect(fetch).not.toHaveBeenCalled();
});
it("excludes identifiers, requires explicit fields and leaves unsupported remote studies actionable", async () => {
  const props = await fixture(); expect(control<HTMLSelectElement>("Numeric outcome").textContent).not.toContain("Respondent ID");
  expect(Array.from(document.querySelectorAll("button")).find(node => node.textContent === "Fit exploratory model")?.disabled).toBe(true);
  props.studies[0].sourceType = "netlify"; await setup(props); await act(async () => root.render(<LinearModelExplorer {...props} />));
  expect(document.querySelector('[role="status"]')?.textContent).toContain("local-file"); expect(TestWorker.instances).toHaveLength(0);
});
it("cancels a pending model, ignores its late reply, then permits a clean retry", async () => {
  const props = await fixture(); await setup(props); TestWorker.pending = true; await fit(); const worker = TestWorker.instances[0];
  await click("Cancel model fitting"); expect(worker.terminate).toHaveBeenCalledOnce(); await act(async () => worker.complete());
  expect(document.querySelector('[aria-label="Linear model results"]')).toBeNull(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("canceled");
  TestWorker.pending = false; await fit(); expect(document.querySelector('[aria-label="Linear model results"]')).not.toBeNull();
});
it("preserves choices after worker failure and supports retry", async () => {
  const props = await fixture(); await setup(props); TestWorker.fail = true; await fit(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("unavailable"); expect(control<HTMLSelectElement>("Numeric outcome").value).toBe(props.studies[0].fields[0].id);
  TestWorker.fail = false; await fit(); expect(document.querySelector('[aria-label="Linear model results"]')).not.toBeNull();
});
it("hides a completed model after an in-place source edit and refuses stale import rebinding", async () => {
  const props = await fixture(); await setup(props); await fit(); props.studies[0].rows[0].Outcome = "999"; await act(async () => root.render(<LinearModelExplorer {...props} />));
  expect(document.querySelector('[aria-label="Linear model results"]')).toBeNull(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("changed");
  props.studies[0].importedAt = "2026-11-07T00:00:00Z"; await act(async () => root.render(<LinearModelExplorer {...props} />)); expect(document.querySelector('[role="status"]')?.textContent).toContain("replaced");
  await click("Review this replacement import and reset choices"); expect(control<HTMLSelectElement>("Numeric outcome").value).toBe(""); expect(document.querySelectorAll('.model-fields input:checked')).toHaveLength(0);
});
it("aborts a pending fit on changed settings and on close/unmount", async () => {
  const props = await fixture(); await setup(props); TestWorker.pending = true; await fit(); const first = TestWorker.instances[0]; await selectPredictor("PredictorB"); expect(first.terminate).toHaveBeenCalledOnce();
  await fit(); const second = TestWorker.instances[1]; await act(async () => root.render(<div />)); expect(second.terminate).toHaveBeenCalledOnce();
});
it("keeps keyboard focus inside and closes with Escape without sending keys to report controls", async () => {
  const props = await fixture(), modal = document.querySelector('[role="dialog"]')!; expect(document.activeElement).toBe(modal); expect(host.inert).toBe(true);
  await act(async () => modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(props.onClose).toHaveBeenCalledOnce();
});

it.each(["outcome", "predictor"])("refuses tiny %s units through the real computation instead of displaying misleading diagnostics", async kind => {
  const props = await fixture(), column = kind === "outcome" ? "Outcome" : "PredictorA";
  props.studies[0].rows.forEach(row => { row[column] = String(Number(row[column]) * 1e-162); });
  const before = structuredClone(props.studies);
  await setup(props); await fit();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("1e-150 range");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("Rescale its units");
  expect(document.querySelector('[aria-label="Linear model results"]')).toBeNull(); expect(props.studies).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
});
