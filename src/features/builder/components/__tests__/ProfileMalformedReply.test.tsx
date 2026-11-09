// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NumericFieldProfile } from "../NumericFieldProfile";
import { CategoricalFieldProfile } from "../CategoricalFieldProfile";
import { HeldProfileWorker, profileStudy } from "../../../data/__tests__/fixtures/profileDeadlineFixture";
let host: HTMLDivElement, root: Root, workers: HeldProfileWorker[];
beforeEach(() => { workers = []; vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("fetch", vi.fn()); vi.stubGlobal("Worker", class extends HeldProfileWorker { constructor() { super(); workers.push(this); } }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it.each(["numeric", "categorical"] as const)("refuses a malformed %s reply without crashing or accepting data, then permits a real retry", async kind => {
  const dataset = await profileStudy(6000), before = structuredClone(dataset); vi.useFakeTimers(); await act(async () => root.render(kind === "numeric" ? <NumericFieldProfile dataset={dataset} field={dataset.fields[1]}/> : <CategoricalFieldProfile dataset={dataset} field={dataset.fields[0]}/>));
  if (kind === "categorical") await act(async () => { const details = host.querySelector("details")!; details.open = true; details.dispatchEvent(new Event("toggle", { bubbles: true })); });
  await act(async () => vi.advanceTimersByTimeAsync(100)); const profile = kind === "numeric" ? { status: "ready", rows: 6000, valid: 6000, blank: 0, invalid: 0 } : { status: "ready", rows: 6000, valid: 6000, blank: 0, categories: [{ id: "A", label: {} }] };
  await act(async () => workers[0].onmessage!({ data: { type: "complete", profile } } as MessageEvent)); expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/background.*failed/i); expect(host.querySelector("dl")).toBeNull(); expect(host.querySelector("table")).toBeNull(); expect(workers[0].terminate).toHaveBeenCalledOnce();
  const retry = host.querySelector("button")!; expect(retry.textContent).toContain("Retry"); await act(async () => retry.click()); await act(async () => vi.advanceTimersByTimeAsync(100)); await act(async () => { workers[1].complete(); await vi.advanceTimersByTimeAsync(100); }); expect(host.querySelector("dl")).not.toBeNull(); expect(host.textContent).toContain("6,000 stored responses"); expect(dataset).toEqual(before); expect(fetch).not.toHaveBeenCalled();
});
