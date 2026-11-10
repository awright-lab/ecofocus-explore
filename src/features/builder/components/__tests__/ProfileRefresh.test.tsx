// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NumericFieldProfile } from "../NumericFieldProfile";
import { CategoricalFieldProfile } from "../CategoricalFieldProfile";
import { HeldProfileWorker, profileStudy } from "../../../data/__tests__/fixtures/profileDeadlineFixture";
let root: Root, host: HTMLDivElement, workers: HeldProfileWorker[];
beforeEach(() => { workers = []; vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("Worker", class extends HeldProfileWorker { constructor() { super(); workers.push(this); } }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function action(prefix: string) { const button = Array.from(host.querySelectorAll("button")).find(b => b.textContent?.startsWith(prefix)); if (!button) throw Error(prefix); return button; }
it.each((["numeric", "categorical"] as const).flatMap(kind => ["owned", "outside", "blur"].map(focus => ({ kind, focus }))))("explicitly refreshes a verified snapshot without stale display or focus theft for %j", async ({ kind, focus }) => {
 const dataset = await profileStudy(); vi.useFakeTimers();
 const render = () => root.render(<><button>Outside</button>{kind === "numeric" ? <NumericFieldProfile dataset={dataset} field={dataset.fields[1]}/> : <CategoricalFieldProfile dataset={dataset} field={dataset.fields[0]}/>}</>);
 await act(async () => render()); if (kind === "categorical") await act(async () => { const details = host.querySelector("details")!; details.open = true; details.dispatchEvent(new Event("toggle", { bubbles: true })); });
 await act(async () => vi.advanceTimersByTimeAsync(100)); await act(async () => workers[0].complete()); expect(host.textContent).toContain("Snapshot of the values verified for this run");
 dataset.rows[0][kind === "numeric" ? "Amount" : "Category"] = kind === "numeric" ? "101" : "C"; const before = structuredClone(dataset); await act(async () => render());
 const refresh = action("Refresh"); refresh.focus(); if (focus === "outside") action("Outside").focus(); if (focus === "blur") refresh.blur();
 await act(async () => refresh.click()); expect(host.querySelector("dl")).toBeNull(); expect(host.querySelector("table")).toBeNull(); expect(action("Cancel")).not.toBeNull();
 const target = host.querySelector(`[aria-label="${kind === "numeric" ? "Numeric" : "Category"} field summary"]`)!;
 expect(document.activeElement).toBe(focus === "owned" ? target : focus === "outside" ? action("Outside") : document.body);
 await act(async () => vi.advanceTimersByTimeAsync(100)); expect(workers).toHaveLength(2); await act(async () => workers[1].complete());
 if (kind === "numeric") expect(Array.from(host.querySelectorAll("dt")).find(n => n.textContent === "Mean")?.nextElementSibling?.textContent).toBe("2.02");
 else expect(Array.from(host.querySelectorAll("tbody tr")).some(n => n.textContent?.startsWith("C1"))).toBe(true);
 expect(dataset).toEqual(before); expect(workers[1].terminate).toHaveBeenCalledOnce();
});
