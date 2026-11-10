// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportNavigator } from "../ReportNavigator";
import { reportNavigatorPages } from "./reportNavigatorFixture";
const preview = vi.hoisted(() => ({ fail: false }));
vi.mock("../../../document/DocumentPreview", () => ({ DocumentPreview: () => { if (preview.fail) throw Error("Synthetic preview failure"); return <svg data-test-preview />; } }));
let host: HTMLDivElement, trigger: HTMLButtonElement, root: Root;
beforeEach(() => { preview.fail = false; vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); trigger = document.createElement("button"); trigger.textContent = "Browse report"; document.body.append(host, trigger); trigger.focus(); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); trigger.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(node => node.getAttribute("aria-label") === label || node.textContent === label)!;
async function click(label: string) { await act(async () => button(label).click()); }
async function change(node: HTMLInputElement | HTMLSelectElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); }); }
async function setup(initialQuery = "") {
  const pages = reportNavigatorPages(), onPage = vi.fn(), onObject = vi.fn(), onClose = vi.fn();
  const render = async () => act(async () => root.render(<ReportNavigator pages={pages} activePageId={pages[0].id} initialQuery={initialQuery} onPage={onPage} onObject={onObject} onClose={onClose}/>));
  await render(); return { pages, onPage, onObject, onClose, render };
}
it("bounds 100-page previews, shows current page and reaches the last page without edits", async () => {
  const f = await setup(), before = JSON.stringify(f.pages);
  expect(document.querySelectorAll("[data-test-preview]")).toHaveLength(12);
  expect(document.querySelector('[aria-current="page"]')?.textContent).toContain("Current");
  await click("Page overview pagination: last"); expect(document.querySelectorAll("[data-test-preview]")).toHaveLength(4);
  const last = Array.from(document.querySelectorAll<HTMLButtonElement>(".navigator-page-card")).at(-1)!;
  await act(async () => last.click()); expect(f.onPage).toHaveBeenCalledWith(f.pages[99]); expect(JSON.stringify(f.pages)).toBe(before);
});
it("shows honest counts and reaches duplicate-named Unicode objects 21 and 2000 with descriptions", async () => {
  const f = await setup("Research note"); expect(document.querySelectorAll(".navigator-object")).toHaveLength(25); expect(document.querySelector('[role="status"]')?.textContent).toContain("of 2000");
  const target = document.querySelectorAll<HTMLButtonElement>(".navigator-object")[20]; await act(async () => target.click()); expect(f.onObject.mock.calls[0][0].object.id).toBe(f.pages[1].elements[0].id);
  await click("Object results pagination: last"); const last = Array.from(document.querySelectorAll<HTMLButtonElement>(".navigator-object")).at(-1)!;
  expect(last.getAttribute("aria-label")).toContain("object 2000 of 2000"); expect(last.getAttribute("aria-label")).toContain("Locked");
  await act(async () => last.click()); expect(f.onObject.mock.calls.at(-1)![0].object.id).toBe(f.pages[99].elements[19].id);
  await change(document.querySelector<HTMLInputElement>('input[type="search"]')!, "clear information");
  const described = document.querySelector(".navigator-object")!; expect(document.getElementById(described.getAttribute("aria-describedby")!)?.textContent).toContain("clear information");
});
it("resets the window on filters, safely handles removed filtered pages and stale in-place results", async () => {
  const f = await setup("Research note"); await click("Object results pagination: last");
  await change(document.querySelectorAll<HTMLSelectElement>("select")[0], f.pages[2].id);
  expect(document.querySelector('[role="status"]')?.textContent).toContain("1–20 of 20");
  const target = document.querySelector<HTMLButtonElement>(".navigator-object")!; target.focus();
  f.pages[2].elements[0].name = "Renamed"; await act(async () => target.click()); expect(f.onObject).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("changed");
  f.pages.splice(2, 1); await f.render(); expect(document.querySelectorAll(".navigator-object")).toHaveLength(0); expect(document.querySelector(".navigator-empty")?.textContent).toContain("removed");
});
it("contains keyboard events, traps Tab, handles Escape and restores trigger focus", async () => {
  const f = await setup(); const modal = document.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(document.activeElement).toBe(modal); expect(trigger.inert).toBe(true);
  const background = vi.fn(); window.addEventListener("keydown", background);
  for (const key of ["Delete", "Backspace", "ArrowRight", "z"]) await act(async () => modal.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: key === "z", bubbles: true })));
  expect(background).not.toHaveBeenCalled(); window.removeEventListener("keydown", background);
  await act(async () => modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
  expect(modal.contains(document.activeElement)).toBe(true);
  await act(async () => modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(f.onClose).toHaveBeenCalled(); await act(async () => root.render(null)); expect(document.activeElement).toBe(trigger); expect(Boolean(trigger.inert)).toBe(false);
});

it("isolates failed previews and keeps page navigation available", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {}); preview.fail = true;
  try { const f = await setup(); expect(document.querySelectorAll(".navigator-preview-error")).toHaveLength(12); await act(async () => document.querySelector<HTMLButtonElement>(".navigator-page-card")!.click()); expect(f.onPage).toHaveBeenCalledWith(f.pages[0]); } finally { errors.mockRestore(); }
});
it("recovers focused results removed on rerender and never navigates an ambiguous identity", async () => {
  const f = await setup("Research note"); const first = document.querySelector<HTMLButtonElement>(".navigator-object")!; first.focus();
  const removed = f.pages[0].elements.shift()!; await f.render(); expect(document.activeElement).toBe(document.querySelector('input[type="search"]'));
  const second = document.querySelector<HTMLButtonElement>(".navigator-object")!;
  const object = f.pages[0].elements[0]; f.pages[0].elements.push({ ...object });
  await act(async () => second.click()); expect(f.onObject).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(removed.id).not.toBe(object.id);
});

it.each(["identifier", "removed", "ambiguous", "renamed"])("revalidates page-card identity and search eligibility after %s updates", async kind => {
  const f = await setup();
  await change(document.querySelector<HTMLInputElement>('input[type="search"]')!, "Chapter 1 ·");
  const target = document.querySelector<HTMLButtonElement>(".navigator-page-card")!;
  if (kind === "identifier") f.pages[0].id = "new identity";
  if (kind === "removed") f.pages.shift();
  if (kind === "ambiguous") f.pages[1].id = f.pages[0].id;
  if (kind === "renamed") f.pages[0].title = "Changed chapter";
  await act(async () => target.click());
  expect(f.onPage).not.toHaveBeenCalled(); expect(f.onClose).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("That page changed");
  expect(document.activeElement).toBe(document.querySelector('input[type="search"]'));
});

it("respects deliberate blur instead of restoring focus after a later removal", async () => {
  const f = await setup("Research note"); const first = document.querySelector<HTMLButtonElement>(".navigator-object")!;
  first.focus(); first.blur(); f.pages[0].elements.shift(); await f.render();
  expect(document.activeElement).toBe(document.body);
});

it("keeps focus on pagination boundaries and ignores repeated boundary activation", async () => {
  await setup(); const last = button("Page overview pagination: last");
  await act(async () => { last.focus(); last.click(); });
  expect(document.activeElement).toBe(last); expect(last.disabled).toBe(false); expect(last.getAttribute("aria-disabled")).toBe("true");
  await act(async () => last.click()); expect(document.querySelector(".navigator-count")?.textContent).toContain("97–100 of 100");
  const first = button("Page overview pagination: first");
  await act(async () => { first.focus(); first.click(); first.click(); });
  expect(document.activeElement).toBe(first); expect(first.getAttribute("aria-disabled")).toBe("true");
  expect(document.querySelector(".navigator-count")?.textContent).toContain("1–12 of 100");
});
