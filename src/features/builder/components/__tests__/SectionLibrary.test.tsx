// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialDashboard } from "../../../document/documentSeeds";
import { SectionLibrary } from "../SectionLibrary";
import { sectionBlocks } from "./sectionLibraryFixture";
vi.mock("../../../document/DocumentPreview", () => ({ DocumentPreview: ({ page, viewport }: {page: {id: string}; viewport: {width: number}}) => <svg data-preview-id={page.id} data-width={viewport.width}/> }));
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const button = (name: string) => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(node => node.getAttribute("aria-label") === name || node.textContent?.trim() === name)!;
async function click(name: string) { await act(async () => { button(name).focus(); button(name).click(); }); }
async function change(node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); }); }
async function setup() {
  const page = structuredClone(initialDashboard.pages[0]);
  const props: ComponentProps<typeof SectionLibrary> = { curated: [], saved: sectionBlocks(), pages: [page], activePage: page, onInsertSaved: vi.fn(() => true), onInsertCurated: vi.fn(() => true), onUpdate: vi.fn(), onDelete: vi.fn() };
  const render = async () => act(async () => root.render(<SectionLibrary {...props}/>)); await render(); await click("Browse sections ↗"); return { props, render };
}
const cards = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".section-card"));
async function inspect(index = 0) { await act(async () => { cards()[index].focus(); cards()[index].click(); }); }
it("bounds 500 results and previews, reaches the last section and restores card and opener focus", async () => {
  const f = await setup(), before = JSON.stringify(f.props.saved); expect(cards()).toHaveLength(12); expect(document.querySelectorAll("[data-section-preview]")).toHaveLength(12);
  expect(document.querySelector(".section-count")?.textContent).toContain("of 500");
  await click("Sections: Last"); expect(document.activeElement).toBe(button("Sections: Last")); expect(cards()).toHaveLength(8); expect(cards().at(-1)?.getAttribute("aria-label")).toContain("section 500 of 500");
  await inspect(7); expect(document.querySelector(".section-inspection h3")?.textContent).toBe("Reusable insight 500"); expect(document.querySelectorAll("[data-section-preview]")).toHaveLength(1);
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(document.activeElement).toBe(cards()[7]);
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(button("Browse sections ↗"));
  expect(f.props.onInsertSaved).not.toHaveBeenCalled(); expect(JSON.stringify(f.props.saved)).toBe(before);
});
it("combines metadata search/source/category filters and resets pagination with honest empty states", async () => {
  const f = await setup(); f.props.curated = [structuredClone(f.props.saved[0])]; await f.render(); await click("Sections: Last");
  await change(document.querySelector('input[type="search"]')!, "section 500"); expect(cards()).toHaveLength(1); expect(document.querySelector(".section-count")?.textContent).toContain("1–1 of 1");
  await change(document.querySelector('input[type="search"]')!, ""); const selects = document.querySelectorAll<HTMLSelectElement>("select"); await change(selects[0], "curated"); expect(cards()).toHaveLength(1); expect(cards()[0].textContent).toContain("Curated starter"); await change(selects[1], "callout"); expect(cards()).toHaveLength(0); expect(document.querySelector(".section-empty")?.textContent).toContain("No sections");
});
it("requires explicit Insert, keeps inspection frozen, and forwards only the sorted editable-copy input", async () => {
  const f = await setup(), before = JSON.stringify(f.props.saved); await inspect(); expect(f.props.onInsertSaved).not.toHaveBeenCalled(); expect(document.querySelector(".section-inspection")?.textContent).toContain("800 × 300");
  await click("Insert section"); expect(f.props.onInsertSaved).toHaveBeenCalledOnce(); const copy = vi.mocked(f.props.onInsertSaved).mock.calls[0][0]; expect(copy.items[0].relativeLayout.zIndex).toBe(0); expect(JSON.stringify(f.props.saved)).toBe(before); expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it.each(["renamed", "removed", "ambiguous", "destination"])("rejects %s selections, including same-reference updates, before Insert", async kind => {
  const f = await setup(); await inspect();
  if (kind === "renamed") f.props.saved[0].label = "Changed";
  if (kind === "removed") f.props.saved.shift();
  if (kind === "ambiguous") f.props.saved.push(structuredClone(f.props.saved[0]));
  if (kind === "destination") f.props.activePage.title = "Changed destination";
  await f.render(); expect(document.querySelector(".section-inspection h3")?.textContent).toBe("Reusable insight"); await click("Insert section"); expect(f.props.onInsertSaved).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/changed|deleted|ambiguous/);
});
it("distinguishes duplicate names/reserved IDs, handles empty blocks and rejects ambiguous inspection", async () => {
  const f = await setup(); expect(new Set(cards().slice(0, 4).map(card => card.getAttribute("aria-label"))).size).toBe(4);
  f.props.saved[0].items = []; f.props.saved[0].summary = { ...f.props.saved[0].summary, objectCount: 0, elementCount: 0 }; await f.render(); await inspect(); expect(button("Insert section").disabled).toBe(true); expect(document.querySelector(".section-inspection")?.textContent).toContain("empty");
  await click("← Back to gallery"); f.props.saved.push(structuredClone(f.props.saved[0])); await f.render(); await inspect(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("ambiguous");
});
it("preserves explicit edit-details/delete flows and guards stale management actions", async () => {
  const f = await setup(); await inspect(); await click("Edit"); const name = Array.from(document.querySelectorAll("label")).find(label => label.textContent?.startsWith("Block name"))!.querySelector("input")!;
  await change(name, "Revised section"); await act(async () => document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(f.props.onUpdate).toHaveBeenCalledWith(f.props.saved[0], expect.objectContaining({ label: "Revised section" })); expect(document.activeElement).toBe(cards()[0]);
  await inspect(); await click("Delete"); expect(f.props.onDelete).toHaveBeenCalledWith(f.props.saved[0]);
});
it("owns background canvas shortcuts, traps Tab and respects deliberate blur when results disappear", async () => {
  const f = await setup(), handler = vi.fn(); window.addEventListener("keydown", handler);
  for (const key of ["Delete", "Backspace", "ArrowRight", "z", "d"]) await act(async () => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true })));
  expect(handler).not.toHaveBeenCalled(); window.removeEventListener("keydown", handler);
  const modal = document.querySelector<HTMLElement>('[role="dialog"]')!; modal.focus(); await act(async () => modal.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }))); expect(modal.contains(document.activeElement)).toBe(true);
  cards()[0].focus(); cards()[0].blur(); f.props.saved.shift(); await f.render(); expect(document.activeElement).toBe(document.body);
});
it("returns focus to Edit after cancellation or Escape and never saves abandoned details", async () => {
  const f = await setup(); await inspect(); await click("Edit"); await click("Cancel"); expect(document.activeElement).toBe(button("Edit"));
  await click("Edit"); await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.querySelector("form")).toBeNull(); expect(document.activeElement).toBe(button("Edit")); expect(f.props.onUpdate).not.toHaveBeenCalled();
});
it("shows an unsupported geometry explanation and guards management across a destination/report change", async () => {
  const f = await setup(); f.props.saved[0].items[0].relativeLayout.width = Infinity; await f.render();
  expect(cards()[0].textContent).toContain("Preview unsupported"); await inspect(); expect(button("Insert section").disabled).toBe(true);
  f.props.activePage = structuredClone(f.props.activePage); f.props.pages = [f.props.activePage]; await f.render(); await click("Delete"); expect(f.props.onDelete).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')?.textContent).toContain("report changed");
});
it.each(["oval", "large"])('explains an unsupported %s preview but permits explicit insertion', async kind => {
  const f = await setup(), block = f.props.saved[0], item = block.items[0]; if (item.kind !== "element") throw Error("Expected element");
  if (kind === "oval") { item.element.type = "circle"; item.relativeLayout.width = 250; item.relativeLayout.height = 100; }
  else { for (let i = 0; i < 79; i++) { const copy = structuredClone(item); copy.element.id = `extra-${i}`; block.items.push(copy); } block.summary.objectCount = block.items.length; block.summary.elementCount = block.items.length; }
  await f.render(); await inspect(); expect(document.querySelector(".section-inspection")?.textContent).toContain("You can still insert this section.");
  expect(button("Insert section").disabled).toBe(false); expect(f.props.onInsertSaved).not.toHaveBeenCalled(); await click("Insert section"); expect(f.props.onInsertSaved).toHaveBeenCalledOnce(); expect(vi.mocked(f.props.onInsertSaved).mock.calls[0][0].items).toHaveLength(block.items.length);
});
