// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ReportPageTree } from "../ReportPageTree";
import { reportNavigatorPages } from "./reportNavigatorFixture";
vi.mock("../../../document/DocumentPreview", () => ({ DocumentPreview: () => <svg data-test-preview/> }));
it("bounds the original outline and expanded rows, and keeps move focus across page batches", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const pages = reportNavigatorPages(), host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const props: ComponentProps<typeof ReportPageTree> = { sortedPages: pages, activePage: pages[0], selectedTileId: null, selectedElementId: null, multiSelectedObjects: [], toggleMultiSelectedObject: vi.fn(), clearMultiSelection: vi.fn(), pageTemplates: [], pageThemes: [], setActivePageId: vi.fn(), selectPage: vi.fn(), selectTile: vi.fn(), selectElement: vi.fn(), recordReportTreeSelectionCue: vi.fn(), updateTile: vi.fn(), updateElement: vi.fn(), renamePage: vi.fn(), addPage: vi.fn(), duplicateActivePage: vi.fn(), duplicatePageById: vi.fn(), deleteActivePage: vi.fn(), deletePageById: vi.fn(), movePage: vi.fn((id: string) => { const index = pages.findIndex(p => p.id === id); [pages[index], pages[index + 1]] = [pages[index + 1], pages[index]]; pages.forEach((p, n) => p.order = n + 1); }) };
  const render = async () => act(async () => root.render(<ReportPageTree {...props}/>));
  try {
    // A dense page must also have a bounded outline, independent of the report-wide browser.
    pages[0].elements = reportNavigatorPages(1, 2000)[0].elements;
    await render(); expect(host.querySelectorAll("[data-test-preview]")).toHaveLength(12);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label^="Show objects on page 1:"]')!.click());
    expect(host.querySelectorAll(".report-page-object-row")).toHaveLength(25);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Objects on page 1 pagination: last"]')!.click());
    const last = Array.from(host.querySelectorAll<HTMLButtonElement>(".report-page-object-select")).at(-1)!;
    expect(last.getAttribute("aria-label")).toContain("object 2000 on page 1");
    await act(async () => last.click()); expect(props.selectElement).toHaveBeenCalledWith(pages[0].elements[1999].id);
    const movedId = pages[11].id, movedName = pages[11].title;
    const group = Array.from(host.querySelectorAll(".report-page-group"))[11];
    await act(async () => Array.from(group.querySelectorAll("button")).find(b => b.textContent === "Move down")!.click()); await render();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Open page 13: ${movedName}`);
    expect(pages[12].id).toBe(movedId); expect(host.querySelectorAll("[data-test-preview]")).toHaveLength(12);
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
