// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LayoutFields } from "../LayoutFields";
import { LayoutFitControls } from "../LayoutFitControls";
import type { CanvasLayout } from "../../../../../shared/types/dashboard";
import { initialDashboard } from "../../../document/documentSeeds";
import { ElementOptionsInspector, TileOptionsInspector } from "../InspectorSections";
const initial: CanvasLayout = { x: -10, y: 900, width: 2560, height: 1000, zIndex: 7 };
let root: Root, host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fit() { return host.querySelector<HTMLButtonElement>(".layout-fit button")!; }
async function render(layout = initial, locked = false, staged = false, onApply = vi.fn()) { await act(async () => root.render(<LayoutFitControls layout={layout} locked={locked} staged={staged} onApply={onApply} />)); return onApply; }
async function click() { await act(async () => { fit().focus(); fit().click(); }); }
it("shows the actual proposed geometry and issues only the geometry patch", async () => {
  const apply = await render();
  expect(host.textContent).toContain("Proposed box: X 0, Y 260; width 1280, height 500.");
  expect(host.textContent).toContain("may still clip");
  expect(apply).not.toHaveBeenCalled(); await click();
  expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 260, width: 1280, height: 500 });
  expect(document.activeElement).toBe(fit());
});
it("keeps the focused button after a successful fit and prevents a redundant write", async () => {
  const apply = vi.fn(); function Harness() { const [layout, set] = useState(initial); return <LayoutFields layout={layout} onApply={change => { apply(change); set(previous => ({ ...previous, ...change })); }} />; }
  await act(async () => root.render(<Harness />)); await click();
  expect(host.textContent).toContain("already inside"); expect(fit().getAttribute("aria-disabled")).toBe("true"); expect(document.activeElement).toBe(fit());
  await click(); expect(apply).toHaveBeenCalledTimes(1);
});
it.each([[true, false], [false, true]])("protects locked=%s staged=%s boxes", async (locked, staged) => { const apply = await render(initial, locked, staged); await click(); expect(apply).not.toHaveBeenCalled(); expect(fit().getAttribute("aria-disabled")).toBe("true"); });
it("refuses invalid geometry without removing the control", async () => { const apply = await render({ ...initial, width: NaN }); await click(); expect(apply).not.toHaveBeenCalled(); expect(host.textContent).toContain("outside the supported"); expect(document.activeElement).toBe(fit()); });
it("retains unfinished numeric input and resolves a valid blur before a later fit", async () => {
  const apply = vi.fn(); function Harness() { const [layout, set] = useState(initial); return <LayoutFields layout={layout} onApply={change => { apply(change); set(previous => ({ ...previous, ...change })); }} />; }
  await act(async () => root.render(<Harness />)); const x = host.querySelector<HTMLInputElement>('input[type="number"]')!;
  await act(async () => { x.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(x, "100"); x.dispatchEvent(new Event("input", { bubbles: true })); });
  for (const name of ["pointerdown", "mousedown"]) { const event = new MouseEvent(name, { bubbles: true, cancelable: true }); await act(async () => fit().dispatchEvent(event)); expect(event.defaultPrevented).toBe(true); }
  expect(document.activeElement).toBe(x); expect(x.value).toBe("100"); expect(apply).not.toHaveBeenCalled();
  await click(); expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 100 });
  expect(host.textContent).toContain("Proposed box: X 0, Y 260");
  await click(); expect(apply).toHaveBeenLastCalledWith({ x: 0, y: 260, width: 1280, height: 500 });
});
it("uses current rendered geometry after external replacement", async () => { const apply = await render(); await render({ ...initial, x: 1400, y: -5, width: 320, height: 220 }, false, false, apply); await click(); expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 960, y: 0, width: 320, height: 220 }); });
it.each([{ width: 400, height: 2000 }, { width: 4000, height: 300 }, { width: 100, height: 100 }])("refuses unsupported chart proportions %j without a command", async dimensions => { const apply = await render({ ...initial, ...dimensions }); await click(); expect(fit().getAttribute("aria-disabled")).toBe("true"); expect(apply).not.toHaveBeenCalled(); expect(host.textContent).toContain("rendered minimum size (320 × 220)"); expect(host.textContent).not.toContain("already inside"); });
it("uses the element's unconstrained frame instead of chart minima", async () => { const apply = vi.fn(); await act(async () => root.render(<LayoutFields itemKind="element" layout={{ ...initial, x: 1400, y: -5, width: 100, height: 100 }} onApply={apply} />)); await click(); expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 1180, y: 0, width: 100, height: 100 }); });
it("routes chart-options and object-options panels through their actual frame limits", async () => {
  const apply = vi.fn(), chart = structuredClone(initialDashboard.pages[0].tiles[0]); chart.locked = false; Object.assign(chart.layout, { x: 1500, y: 0, width: 400, height: 2000 });
  const chartProps = { selectedTile: chart, updateSelectedLayout: apply, updateSelectedAppearance: vi.fn() } as unknown as Parameters<typeof TileOptionsInspector>[0];
  await act(async () => root.render(<TileOptionsInspector {...chartProps} />)); await click(); expect(apply).not.toHaveBeenCalled(); expect(fit().getAttribute("aria-disabled")).toBe("true");
  const element = structuredClone(initialDashboard.pages[0].elements[0]); element.locked = false; Object.assign(element.layout, { x: 1400, y: -5, width: 100, height: 100 });
  const elementProps = { selectedElement: element, updateSelectedLayout: apply, updateSelectedElement: vi.fn() } as unknown as Parameters<typeof ElementOptionsInspector>[0];
  await act(async () => root.render(<ElementOptionsInspector {...elementProps} />)); await click(); expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 1180, y: 0, width: 100, height: 100 });
});
it.each([false, true])("reports uncertain commands honestly, including already-applied=%s", async applied => {
  function Harness() { const [layout, set] = useState(initial); return <LayoutFitControls layout={layout} locked={false} staged={false} onApply={change => { if (applied) set(previous => ({ ...previous, ...change })); throw Error("Synthetic command failure"); }} />; }
  await act(async () => root.render(<Harness />)); await click(); expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be confirmed"); expect(host.querySelector('[role="alert"]')?.textContent).not.toContain("kept");
});
