// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ObjectNameField } from "../ObjectNameField";
let root: Root, host: HTMLDivElement, outside: HTMLButtonElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); outside = document.createElement("button"); document.body.append(host, outside); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
const input = () => host.querySelector("input")!;
const cancel = () => host.querySelector("button")!;
async function render(name = "Original", onApply = vi.fn(), key = "one") { await act(async () => root.render(<ObjectNameField key={key} label="Analysis name" name={name} onApply={onApply} />)); return onApply; }
async function change(value: string) { await act(async () => { input().focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); }); }
async function key(key: string, isComposing = false) { await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key, isComposing, bubbles: true, cancelable: true }))); }
function unload() { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }
it("requests browser-leave protection only for unapplied edits and removes its listener on unmount", async () => {
  await render(); expect(unload()).toBe(false); await change("Pending"); expect(unload()).toBe(true); expect(host.querySelector('[role="status"]')?.textContent).toContain("not applied"); await key("Escape"); expect(unload()).toBe(false); await change("Pending"); await act(async () => root.render(<p>Other selection</p>)); expect(unload()).toBe(false);
});
it("stages typing, commits once on Enter and makes no redundant blur write", async () => {
  const apply = vi.fn(); function Harness() { const [name, set] = useState("Original"); return <ObjectNameField label="Analysis name" name={name} onApply={next => { apply(next); set(next); }} />; }
  await act(async () => root.render(<Harness />)); await change(" New name "); expect(apply).not.toHaveBeenCalled(); await key("Enter"); expect(apply).toHaveBeenCalledExactlyOnceWith("New name"); expect(input().value).toBe("New name"); await act(async () => outside.focus()); expect(apply).toHaveBeenCalledTimes(1);
});
it("commits once when focus leaves the composite editor", async () => { const apply = await render(); await change("Changed"); await act(async () => cancel().focus()); expect(apply).not.toHaveBeenCalled(); await act(async () => outside.focus()); expect(apply).toHaveBeenCalledExactlyOnceWith("Changed"); });
it("cancels using Escape and an accessible keyboard Cancel button without a blur write", async () => {
  const apply = await render(); await change("Changed"); await key("Escape"); expect(input().value).toBe("Original"); await change("Another"); await act(async () => cancel().focus()); expect(apply).not.toHaveBeenCalled(); await act(async () => cancel().click()); expect(document.activeElement).toBe(input()); expect(input().value).toBe("Original"); await act(async () => outside.focus()); expect(apply).not.toHaveBeenCalled();
});
it("does not steal focus for a programmatic Cancel activation", async () => { await render(); await change("Changed"); await act(async () => cancel().focus()); await act(async () => { outside.focus(); cancel().click(); }); expect(document.activeElement).toBe(outside); });
it("keeps current external rename instead of overwriting it with a stale edit", async () => { const apply = await render(); await change("Draft"); await render("External", apply); expect(input().value).toBe("Draft"); await key("Enter"); expect(apply).not.toHaveBeenCalled(); expect(input().value).toBe("External"); expect(host.querySelector('[role="alert"]')?.textContent).toContain("changed while you were editing"); });
it("changes idle values and replacement selections without a write", async () => { const apply = await render(); await render("External", apply); expect(input().value).toBe("External"); await change("Draft"); await render("Other item", apply, "two"); expect(input().value).toBe("Other item"); expect(apply).not.toHaveBeenCalled(); });
it.each(["", "x".repeat(201)])("refuses invalid names and exposes an associated error", async value => { const apply = await render(); await change(value); await key("Enter"); expect(apply).not.toHaveBeenCalled(); expect(input().value).toBe("Original"); expect(input().getAttribute("aria-invalid")).toBe("true"); for (const id of input().getAttribute("aria-describedby")!.split(" ")) expect(document.getElementById(id)).not.toBeNull(); });
it("preserves untouched legacy names exactly even if too long or containing line endings", async () => { const apply = vi.fn(); for (const name of ["x".repeat(1000), "Line\r\nName", "\ud800"]) { await render(name, apply); await act(async () => { input().focus(); outside.focus(); }); expect(apply).not.toHaveBeenCalled(); } });
it("trimming to the existing name does not make an edit", async () => { const apply = await render(); await change(" Original "); await key("Enter"); expect(apply).not.toHaveBeenCalled(); expect(input().value).toBe("Original"); });
it("defers IME Enter and outside blur until composition ends", async () => {
  const apply = await render(); await act(async () => input().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }))); await change("新しい名前"); await key("Enter", true); await act(async () => { cancel().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })); input().blur(); cancel().click(); }); expect(apply).not.toHaveBeenCalled(); expect(input().value).toBe("新しい名前"); expect(document.activeElement).toBe(input()); expect(cancel().getAttribute("aria-disabled")).toBe("true"); await act(async () => outside.focus()); expect(apply).not.toHaveBeenCalled(); await act(async () => input().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }))); expect(apply).toHaveBeenCalledExactlyOnceWith("新しい名前");
});
it.each([false, true])("reports command uncertainty honestly if applied=%s", async applied => {
  function Harness() { const [name, set] = useState("Original"); return <ObjectNameField label="Layer name" name={name} onApply={next => { if (applied) set(next); throw Error("Synthetic command failure"); }} />; }
  await act(async () => root.render(<Harness />)); await change("New"); await key("Enter"); expect(input().value).toBe(applied ? "New" : "Original"); expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be confirmed"); expect(host.querySelector('[role="alert"]')?.textContent).not.toContain("kept");
});

it.each(["pointerdown", "mousedown"])("cancels before null-relatedTarget blur on primary %s without issuing a command", async eventName => {
  const apply = await render(); await change("Do not apply");
  await act(async () => { cancel().dispatchEvent(new MouseEvent(eventName, { button: 0, bubbles: true, cancelable: true })); input().blur(); cancel().click(); });
  expect(apply).not.toHaveBeenCalled(); expect(input().value).toBe("Original"); expect(document.activeElement).toBe(input()); expect(unload()).toBe(false);
});
it("does not steal newer outside focus after a primary Cancel press", async () => {
  const apply = vi.fn(); function Harness() { const [name, set] = useState("Original"); return <ObjectNameField label="Analysis name" name={name} onApply={next => { apply(next); set(next); }} />; }
  await act(async () => root.render(<Harness />)); await change("Keep on outside focus");
  await act(async () => { cancel().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })); input().blur(); outside.focus(); cancel().click(); });
  expect(apply).toHaveBeenCalledExactlyOnceWith("Keep on outside focus"); expect(document.activeElement).toBe(outside); expect(input().value).toBe("Keep on outside focus");
});
it("keeps non-primary presses from discarding an edit", async () => {
  const apply = await render();
  for (const [index, eventName] of ["mousedown", "pointerdown"].entries()) {
    await change(`Keep normal blur ${index}`); const event = new MouseEvent(eventName, { button: index === 0 ? 2 : 0, bubbles: true, cancelable: true }); if (index === 1) Object.defineProperty(event, "isPrimary", { value: false });
    await act(async () => { cancel().dispatchEvent(event); input().blur(); });
  }
  expect(apply.mock.calls).toEqual([["Keep normal blur 0"], ["Keep normal blur 1"]]);
});

it("revokes stale pointer focus ownership after outside focus and blur", async () => {
  const apply = vi.fn(); function Harness() { const [name, set] = useState("Original"); return <ObjectNameField label="Analysis name" name={name} onApply={next => { apply(next); set(next); }} />; }
  await act(async () => root.render(<Harness />)); await change("Keep on leaving");
  await act(async () => cancel().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })));
  await act(async () => outside.focus()); await act(async () => outside.blur()); expect(document.activeElement).toBe(document.body);
  await act(async () => cancel().click()); expect(document.activeElement).toBe(document.body); expect(apply).toHaveBeenCalledExactlyOnceWith("Keep on leaving"); expect(input().value).toBe("Keep on leaving");
});
it("retains typing after an aborted pointer gesture instead of discarding on press", async () => {
  const apply = await render(); await change("Continue typing");
  await act(async () => { cancel().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })); input().blur(); cancel().dispatchEvent(new Event("pointercancel", { bubbles: true })); });
  expect(input().value).toBe("Continue typing"); expect(apply).not.toHaveBeenCalled(); expect(unload()).toBe(true); await key("Enter"); expect(apply).toHaveBeenCalledExactlyOnceWith("Continue typing");
});
it("retains typing when the press releases outside without an activation", async () => {
  const apply = await render(); await change("Continue after release");
  await act(async () => { cancel().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })); input().blur(); outside.dispatchEvent(new MouseEvent("pointerup", { button: 0, bubbles: true })); });
  expect(input().value).toBe("Continue after release"); expect(apply).not.toHaveBeenCalled(); expect(unload()).toBe(true); await key("Enter"); expect(apply).toHaveBeenCalledExactlyOnceWith("Continue after release");
});
it("removes pending-gesture lifecycle listeners without a late command after unmount", async () => {
  const apply = await render(); await change("Pending before unmount"); await act(async () => cancel().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })));
  await act(async () => root.render(<p>Replacement</p>)); await act(async () => { outside.focus(); outside.blur(); }); expect(apply).not.toHaveBeenCalled();
});
