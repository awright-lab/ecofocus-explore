// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NumericFieldProfile } from "../NumericFieldProfile";
import { CategoricalFieldProfile } from "../CategoricalFieldProfile";
import { HeldProfileWorker, profileStudy, type ProfileKind } from "../../../data/__tests__/fixtures/profileDeadlineFixture";
let host: HTMLDivElement, root: Root, workers: HeldProfileWorker[];
beforeEach(() => { workers = []; vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("Worker", class extends HeldProfileWorker { constructor() { super(); workers.push(this); } }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function setup(kind: ProfileKind, observed?: string[]) {
  const dataset = await profileStudy(6000), field = dataset.fields[kind === "numeric" ? 1 : 0]; vi.useFakeTimers();
  function View() { useLayoutEffect(() => { observed?.push(host.querySelector("dl")?.textContent ?? "no summary"); }); return kind === "numeric" ? <NumericFieldProfile dataset={dataset} field={field}/> : <CategoricalFieldProfile dataset={dataset} field={field}/>; }
  const render = async () => { await act(async () => root.render(<View/>)); };
  await render(); if (kind === "categorical") await act(async () => { const details = host.querySelector("details")!; details.open = true; details.dispatchEvent(new Event("toggle", { bubbles: true })); });
  await act(async () => vi.advanceTimersByTimeAsync(100)); await act(async () => { workers[0].complete(); await vi.advanceTimersByTimeAsync(100); });
  expect(host.querySelector("dl")).not.toBeNull(); return { dataset, field, render };
}
it.each(["numeric", "categorical"] as const)("retains the captured %s field name and physical column until explicit refresh", async kind => {
  const f = await setup(kind), originalLabel = f.field.variableLabel || f.field.label, originalColumn = f.field.sourceColumn;
  f.field.variableLabel = "Replacement display label"; f.field.sourceColumn = "Tag"; const before = structuredClone(f.dataset); await f.render();
  const description = kind === "numeric" ? host.querySelector(".numeric-distribution svg")?.getAttribute("aria-label") : host.querySelector("caption")?.textContent;
  expect(description).toContain(originalLabel); expect(description).not.toContain("Replacement display label");
  expect(host.querySelector('[data-profile-snapshot-field]')?.textContent).toContain(originalColumn); expect(workers).toHaveLength(1);
  await act(async () => Array.from(host.querySelectorAll("button")).find(b => b.textContent?.startsWith("Refresh"))!.click());
  await act(async () => vi.advanceTimersByTimeAsync(100)); await act(async () => { workers[1].complete(); await vi.advanceTimersByTimeAsync(100); });
  expect(host.querySelector('[data-profile-snapshot-field]')?.textContent).toContain("Replacement display label"); expect(host.querySelector('[data-profile-snapshot-field]')?.textContent).toContain("Tag"); expect(f.dataset).toEqual(before);
});
it.each(["numeric", "categorical"] as const)("hides a completed %s snapshot before layout observers after an in-place row-count change", async kind => {
  const observed: string[] = [], f = await setup(kind, observed); observed.length = 0; f.dataset.rows.pop(); f.dataset.rowCount--; const before = structuredClone(f.dataset); await f.render();
  expect(observed[0]).toBe("no summary"); expect(host.querySelector("dl")).toBeNull(); await act(async () => vi.advanceTimersByTimeAsync(100)); expect(workers).toHaveLength(2);
  await act(async () => { workers[1].complete(); await vi.advanceTimersByTimeAsync(100); }); expect(host.textContent).toContain("5,999 stored responses"); expect(f.dataset).toEqual(before);
});
it.each(["numeric", "categorical"] as const)("restarts the %s job when only the declared count changes, without waiting forever", async kind => {
  const observed: string[] = [], f = await setup(kind, observed); observed.length = 0; f.dataset.rowCount--; const before = structuredClone(f.dataset); await f.render();
  expect(observed[0]).toBe("no summary"); expect(host.querySelector("dl")).toBeNull(); await act(async () => vi.advanceTimersByTimeAsync(100)); expect(workers).toHaveLength(2);
  await act(async () => { workers[1].complete(); await vi.advanceTimersByTimeAsync(100); }); expect(host.textContent).toContain("6,000 stored responses"); expect(host.querySelector("dl")).not.toBeNull(); expect(f.dataset).toEqual(before);
});
