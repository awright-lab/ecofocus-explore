// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportPageTree } from "../ReportPageTree";
import { reportNavigatorPages } from "./reportNavigatorFixture";
vi.mock("../../../document/DocumentPreview", () => ({ DocumentPreview: () => <svg data-test-preview/> }));
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function setup(count = 12, objects = 1) {
  const pages = reportNavigatorPages(count, objects);
  const props: ComponentProps<typeof ReportPageTree> = { sortedPages: pages, activePage: pages[0], selectedTileId: null, selectedElementId: null, multiSelectedObjects: [], toggleMultiSelectedObject: vi.fn(), clearMultiSelection: vi.fn(), pageTemplates: [], pageThemes: [], setActivePageId: vi.fn(), selectPage: vi.fn(), selectTile: vi.fn(), selectElement: vi.fn(), recordReportTreeSelectionCue: vi.fn(), updateTile: vi.fn(), updateElement: vi.fn(), renamePage: vi.fn(), addPage: vi.fn(), duplicateActivePage: vi.fn(), duplicatePageById: vi.fn(), deleteActivePage: vi.fn(), deletePageById: vi.fn(), movePage: vi.fn() };
  const render = async () => act(async () => root.render(<ReportPageTree {...props}/>));
  await render(); return { pages, props, render };
}
const button = (name: string) => Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(node => node.getAttribute("aria-label") === name || node.textContent?.trim() === name)!;
async function click(name: string) { await act(async () => button(name).click()); }
const current = () => host.querySelector<HTMLButtonElement>('.report-page-node[aria-current="page"]');
it.each(["constructor", "__proto__", "toString", "**proto**"])("paginates objects for opaque page ID %s without inherited values", async id => {
  const f = await setup(1, 26); f.pages[0].id = id; await f.render(); const before = JSON.stringify(f.pages);
  await click("Show objects on page 1: Chapter 1 · Research findings");
  expect(host.querySelectorAll(".report-page-object-row")).toHaveLength(25); expect(host.textContent).toContain("Page 1 of 2"); expect(host.textContent).not.toContain("NaN");
  await click("Objects on page 1 pagination: next"); expect(host.querySelectorAll(".report-page-object-row")).toHaveLength(1); expect(host.textContent).toContain("Page 2 of 2");
  await act(async () => host.querySelector<HTMLButtonElement>(".report-page-object-select")!.click()); expect(f.props.selectElement).toHaveBeenCalledWith(f.pages[0].elements[25].id);
  await click("Objects on page 1 pagination: first"); expect(host.querySelectorAll(".report-page-object-row")).toHaveLength(25); expect(JSON.stringify(f.pages)).toBe(before);
});
it.each(["New page", "Duplicate page"])("follows page 13 after %s without changing the callback contract", async action => {
  const f = await setup(); const added = structuredClone(f.pages[0]); added.id = "new-page"; added.order = 13;
  const callback = vi.fn(() => { f.pages.push(added); f.props.activePage = added; });
  if (action === "New page") f.props.addPage = callback; else f.props.duplicateActivePage = callback;
  await f.render(); await click(action); await f.render(); expect(callback).toHaveBeenCalledOnce(); expect(current()?.getAttribute("aria-label")).toContain("Open page 13:"); expect(host.querySelectorAll(".report-page-thumbnail")).toHaveLength(1);
  await click("Pages outline pagination: first"); await f.render(); expect(current()).toBeNull(); expect(host.querySelectorAll(".report-page-thumbnail")).toHaveLength(12);
});
it("follows external active-page changes but preserves deliberate browsing across unchanged-active rerenders", async () => {
  const f = await setup(24); f.props.activePage = f.pages[12]; await f.render(); expect(current()?.getAttribute("aria-label")).toContain("Open page 13:");
  await click("Pages outline pagination: first"); f.props.activePage = { ...f.pages[12] }; await f.render(); expect(current()).toBeNull();
  f.props.activePage = f.pages[0]; await f.render(); expect(current()?.getAttribute("aria-label")).toContain("Open page 1:");
  await click("Pages outline pagination: last"); await f.render(); expect(current()).toBeNull();
  f.props.activePage = f.pages[13]; await f.render(); expect(current()?.getAttribute("aria-label")).toContain("Open page 14:");
});
it("reopens a remounted Pages outline at page 13 and follows changes while its parent is hidden", async () => {
  const f = await setup(24); f.props.activePage = f.pages[12]; await f.render(); await click("Pages outline pagination: first");
  await act(async () => root.render(null)); await f.render(); expect(current()?.getAttribute("aria-label")).toContain("Open page 13:");
  host.hidden = true; f.props.activePage = f.pages[0]; await f.render(); host.hidden = false; expect(current()?.getAttribute("aria-label")).toContain("Open page 1:");
});
