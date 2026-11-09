// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReportPageTree } from "../ReportPageTree";
import { initialDashboard } from "../../../document/documentSeeds";
let host: HTMLDivElement, outside: HTMLButtonElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); outside = document.createElement("button"); outside.textContent = "Outside"; document.body.append(host, outside); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); outside.remove(); vi.unstubAllGlobals(); });
async function setup() {
  const first = structuredClone(initialDashboard.pages[0]); first.id = "first"; first.title = "Overview"; first.order = 1; first.tiles = first.tiles.slice(0, 1); first.elements = first.elements.slice(0, 1); first.elements[0].type = "text"; first.elements[0].name = "Intro"; first.elements[0].content = "An introduction";
  const second = structuredClone(first); second.id = "second/#"; second.title = "Recommendations"; second.order = 2; second.elements[0].id = "written-note"; second.elements[0].name = "Research commentary"; second.elements[0].content = "Pricing flexibility is the key concern.";
  const props: ComponentProps<typeof ReportPageTree> = { sortedPages: [first, second], activePage: first, selectedTileId: null, selectedElementId: null, multiSelectedObjects: [], toggleMultiSelectedObject: vi.fn(), clearMultiSelection: vi.fn(), pageTemplates: [], pageThemes: [], setActivePageId: vi.fn(), selectPage: vi.fn(), selectTile: vi.fn(), selectElement: vi.fn(), recordReportTreeSelectionCue: vi.fn(), updateTile: vi.fn(), updateElement: vi.fn(), renamePage: vi.fn(), addPage: vi.fn(), duplicateActivePage: vi.fn(), duplicatePageById: vi.fn(), deleteActivePage: vi.fn(), deletePageById: vi.fn(), movePage: vi.fn() };
  const render = async () => { await act(async () => root.render(<ReportPageTree {...props}/>)); }; await render(); return { props, first, second, render };
}
const input = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
async function search(value: string) { await act(async () => { input().focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value); input().dispatchEvent(new Event("input", { bubbles: true })); }); }
const match = () => host.querySelector<HTMLButtonElement>(".report-object-match")!;
it("jumps directly to a written match on an inactive collapsed page without editing content", async () => {
  const { props, second } = await setup(), before = structuredClone(props.sortedPages); await search("flexibility"); expect(host.querySelectorAll(".report-object-match")).toHaveLength(1); expect(match().textContent).toContain("Recommendations"); expect(match().textContent).toContain("flexibility"); await act(async () => { match().focus(); match().click(); });
  expect(props.setActivePageId).toHaveBeenCalledWith(second.id); expect(props.selectElement).toHaveBeenCalledWith("written-note"); expect(props.recordReportTreeSelectionCue).toHaveBeenCalledWith(expect.objectContaining({ pageId: second.id, objectId: "written-note", objectKind: "element" })); expect(props.updateElement).not.toHaveBeenCalled(); expect(props.updateTile).not.toHaveBeenCalled(); expect(props.sortedPages).toEqual(before); expect(document.activeElement).toBe(match());
});
it("labels hidden and locked matches rather than changing their state", async () => { const f = await setup(); f.second.elements[0].hidden = true; f.second.elements[0].locked = true; await f.render(); await search("flexibility"); expect(match().getAttribute("aria-label")).toContain("Hidden"); expect(match().getAttribute("aria-label")).toContain("Locked"); await act(async () => match().click()); expect(f.props.selectElement).toHaveBeenCalledWith("written-note"); expect(f.second.elements[0].hidden).toBe(true); expect(f.second.elements[0].locked).toBe(true); });
it.each(["owned", "outside", "blur"])("recovers disappearing-match focus only when still owned: %s", async owner => {
  const f = await setup(); await search("flexibility"); match().focus(); if (owner === "outside") outside.focus(); if (owner === "blur") match().blur(); f.second.elements = []; await f.render(); expect(host.querySelector(".report-object-match")).toBeNull(); expect(document.activeElement).toBe(owner === "owned" ? input() : owner === "outside" ? outside : document.body);
});
it("does not navigate an obsolete match activated after in-place content changes", async () => { const f = await setup(); await search("flexibility"); f.second.elements[0].content = "Changed discussion"; await act(async () => { match().focus(); match().click(); }); expect(f.props.selectElement).not.toHaveBeenCalled(); expect(f.props.setActivePageId).not.toHaveBeenCalled(); expect(host.querySelector('[role="alert"]')?.textContent).toContain("changed or was removed"); expect(document.activeElement).toBe(input()); });
it("clears search on Escape without clearing an IME composition or changing selection", async () => {
  const f = await setup(); await search("flexibility"); await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true }))); expect(input().value).toBe("flexibility"); await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))); expect(input().value).toBe(""); expect(host.querySelector(".report-object-match")).toBeNull(); expect(document.activeElement).toBe(input()); expect(f.props.selectPage).not.toHaveBeenCalled(); expect(f.props.selectElement).not.toHaveBeenCalled();
});
it("updates same-reference text and selected state instead of retaining a memoized search", async () => { const f = await setup(); await search("renewal"); expect(match()).toBeNull(); f.second.elements[0].content = "Renewal opportunities"; f.props.activePage = f.second; f.props.selectedElementId = "written-note"; await f.render(); expect(match().getAttribute("aria-pressed")).toBe("true"); expect(host.querySelector('[role="status"]')?.textContent).toContain("1 matching objects"); });
it("caps quick matches with an explicit total while retaining the filtered page tree", async () => { const f = await setup(); f.second.elements = Array.from({ length: 25 }, (_, i) => ({ ...structuredClone(f.second.elements[0]), id: `note-${i}` })); await f.render(); await search("flexibility"); expect(host.querySelectorAll(".report-object-match")).toHaveLength(20); expect(host.textContent).toContain("first 20 of 25"); expect(host.querySelector('nav[aria-label="Report pages and objects"]')).not.toBeNull(); });

it("distinguishes same-page duplicate names and associates each matching excerpt", async () => {
  const f = await setup(); const original = f.second.elements[0];
  f.second.elements = [
    { ...structuredClone(original), id: "duplicate/one", name: "Research commentary", content: "Pricing flexibility helps families.", layout: { ...original.layout, zIndex: 1 } },
    { ...structuredClone(original), id: "duplicate#two", name: "Research commentary", content: "Pricing flexibility supports businesses.", layout: { ...original.layout, zIndex: 2 } }
  ];
  const before = structuredClone(f.props.sortedPages); await f.render(); await search("flexibility");
  const results = Array.from(host.querySelectorAll<HTMLButtonElement>(".report-object-match")); expect(results).toHaveLength(2);
  const names = results.map(node => node.getAttribute("aria-label")); expect(new Set(names).size).toBe(2);
  const descriptionIds: string[] = [];
  for (const [i, result] of results.entries()) {
    expect(names[i]).toContain(`matching object ${i + 1} of 2`);
    expect(names[i]).toContain("Research commentary"); expect(names[i]).toContain("page 2: Recommendations");
    const id = result.getAttribute("aria-describedby"); expect(id).toBeTruthy(); descriptionIds.push(id!);
    const description = document.getElementById(id!); expect(description).not.toBeNull(); expect(result.contains(description)).toBe(true);
    expect(description!.textContent).toBe(f.second.elements[i].content);
    await act(async () => { result.focus(); result.click(); }); expect(document.activeElement).toBe(result);
    expect(f.props.selectElement).toHaveBeenLastCalledWith(f.second.elements[i].id);
  }
  expect(new Set(descriptionIds).size).toBe(2); expect(f.props.sortedPages).toEqual(before);
  // A name-only match has no dangling or empty description reference.
  await search("commentary");
  for (const result of host.querySelectorAll(".report-object-match")) expect(result.hasAttribute("aria-describedby")).toBe(false);
});
