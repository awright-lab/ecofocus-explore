import { expect, it, vi } from "vitest";
import { initialDashboard } from "../../../document/documentSeeds";
import { createObjectsFromCompositionBlock } from "../compositionBlockModel";
import { sectionBlocks } from "./sectionLibraryFixture";
import { inspectSection, orderedSectionItems, resolveSectionInsertion, searchSections, sectionGeometry, resolveSection } from "../sectionLibraryModel";
import { sectionPreviewPage } from "../SectionPreview";
const criteria = { query: "", source: "all" as const, category: "" };
it("enumerates all 500 sections in bounded windows with exact full counts and no mutation", () => {
  const saved = sectionBlocks(), before = JSON.stringify(saved), ids: string[] = [];
  for (let index = 0; index < Math.ceil(500 / 12); index++) { const found = searchSections([], saved, criteria, index); expect(found.total).toBe(500); expect(found.entries.length).toBeLessThanOrEqual(12); ids.push(...found.entries.map(entry => entry.id)); }
  expect(new Set(ids).size).toBe(500); expect(ids.at(-1)).toBe("section-499"); expect(JSON.stringify(saved)).toBe(before);
  expect(searchSections([], saved, { ...criteria, query: "section 500" }).entries[0].id).toBe("section-499");
  expect(searchSections([], saved, { ...criteria, category: "callout" }).total).toBe(250);
});
it("searches metadata only and distinguishes same IDs and names by source", () => {
  const saved = sectionBlocks(1); Object.defineProperty(saved[0], "items", { get() { throw Error("Payload must not be indexed"); } });
  expect(searchSections(saved, saved, { ...criteria, query: "reusable" }).total).toBe(2);
  expect(searchSections(saved, saved, { ...criteria, source: "saved" }).total).toBe(1);
  expect(searchSections(saved, saved, { ...criteria, query: "x".repeat(201) }).issue).toContain("200");
});
it("adapts native relative geometry and arbitrary bounds without generating IDs or reading time", () => {
  const block = sectionBlocks(1)[0], before = JSON.stringify(block);
  block.items[0].relativeLayout = { x: -30, y: 800, width: 1500, height: 170, zIndex: 3 };
  const random = vi.spyOn(Math, "random").mockImplementation(() => { throw Error("No IDs"); }), now = vi.spyOn(Date, "now").mockImplementation(() => { throw Error("No timestamps"); });
  try { const page = sectionPreviewPage(block); expect(page.elements[0].layout).toEqual(block.items[0].relativeLayout); expect(sectionGeometry(block).viewport).toEqual({ x: -30, y: 0, width: 1500, height: 970 }); expect(page.elements[0]).not.toBe(block.items[0].kind === "element" && block.items[0].element); } finally { random.mockRestore(); now.mockRestore(); }
  block.items[0].relativeLayout = JSON.parse(before).items[0].relativeLayout; expect(JSON.stringify(block)).toBe(before);
});
it("keeps source intact and normalizes only the confirmed copy for existing insertion ordering", () => {
  const block = sectionBlocks(1)[0], page = structuredClone(initialDashboard.pages[0]); page.tiles = []; page.elements = [];
  const before = JSON.stringify(block), receipt = inspectSection({ source: "saved", id: block.id, block }, page);
  const resolved = resolveSectionInsertion(receipt, [], [block], [page], page); expect(resolved.issue).toBe(""); expect(resolved.block!.items[0].relativeLayout.zIndex).toBe(0);
  const added = createObjectsFromCompositionBlock(resolved.block!, page);
  expect(added.elements.map(element => element.name)).toEqual(["Section background", "Section commentary"]); expect(added.elements[1].layout.x - added.elements[0].layout.x).toBe(400); expect(added.elements[1].id).not.toBe("text-0"); expect(JSON.stringify(block)).toBe(before); expect(page.elements).toHaveLength(0);
});
it.each(["name", "content", "id", "removed", "ambiguous", "destination", "destination data", "destination ambiguous"])("rejects stale or ambiguous %s before insertion", kind => {
  const saved = sectionBlocks(1), block = saved[0], page = structuredClone(initialDashboard.pages[0]), pages = [page];
  const receipt = inspectSection({ source: "saved", id: block.id, block }, page); let active = page;
  if (kind === "name") block.label = "Renamed";
  if (kind === "content" && block.items[0].kind === "element") block.items[0].element.content = "Changed";
  if (kind === "id") block.id = "new-id";
  if (kind === "removed") saved.pop();
  if (kind === "ambiguous") saved.push(structuredClone(block));
  if (kind === "destination") { active = structuredClone(page); pages[0] = active; }
  if (kind === "destination data") page.title = "Changed";
  if (kind === "destination ambiguous") pages.push(structuredClone(page));
  expect(resolveSectionInsertion(receipt, [], saved, pages, active).block).toBeNull();
});
it("retains a frozen inspection and explains empty/unsupported geometry without inventing a result", () => {
  const block = sectionBlocks(1)[0], page = structuredClone(initialDashboard.pages[0]), receipt = inspectSection({ source: "saved", id: block.id, block }, page);
  block.label = "Changed"; expect(receipt.snapshot.label).toBe("Reusable insight"); expect(resolveSection(receipt, [], [block]).issue).toContain("changed");
  block.items = []; block.summary = { ...block.summary, objectCount: 0, elementCount: 0 }; const empty = inspectSection({ source: "saved", id: block.id, block }, page); expect(resolveSectionInsertion(empty, [], [block], [page], page).issue).toContain("empty");
  const invalid = sectionBlocks(1)[0]; invalid.items[0].relativeLayout.width = NaN; expect(sectionGeometry(invalid).issue).toContain("geometry");
});
it("uses element-before-analysis tie order and omits remote image payloads from preview requests", () => {
  const block = sectionBlocks(1)[0], tile = structuredClone(initialDashboard.pages[0].tiles[0]);
  block.items.unshift({ kind: "tile", tile, relativeLayout: { ...block.items[0].relativeLayout, zIndex: 2 } }); block.items[2].relativeLayout.zIndex = 2;
  expect(orderedSectionItems(block).map(item => item.kind)).toEqual(["element", "element", "tile"]);
  const image = block.items[1]; if (image.kind === "element") { image.element.type = "image"; image.element.content = "https://example.invalid/secret.png"; }
  expect(sectionPreviewPage(block).elements[0].content).toContain("preview unavailable"); expect(sectionGeometry(block).partial).toContain("not loaded");
});
it.each(["oval", "large"])('allows insertion when only the %s preview is unsupported', kind => {
  const block = sectionBlocks(1)[0], page = structuredClone(initialDashboard.pages[0]);
  if (kind === "oval") { const item = block.items[0]; if (item.kind !== "element") throw Error("Expected element"); item.element.type = "circle"; item.relativeLayout.width = 250; item.relativeLayout.height = 100; }
  else {
    const item = block.items[0]; if (item.kind !== "element") throw Error("Expected element");
    for (let i = 0; i < 79; i++) { const copy = structuredClone(item); copy.element.id = `extra-${i}`; block.items.push(copy); }
    block.summary.objectCount = block.items.length; block.summary.elementCount = block.items.length;
  }
  const before = JSON.stringify(block), geometry = sectionGeometry(block);
  expect(geometry.issue).toMatch(kind === "oval" ? /ellipses/ : /80 objects/); expect(geometry.insertionIssue).toBe("");
  const receipt = inspectSection({ source: "saved", id: block.id, block }, page), result = resolveSectionInsertion(receipt, [], [block], [page], page);
  expect(result.issue).toBe(""); expect(createObjectsFromCompositionBlock(result.block!, page).elements).toHaveLength(block.items.length); expect(JSON.stringify(block)).toBe(before);
});
