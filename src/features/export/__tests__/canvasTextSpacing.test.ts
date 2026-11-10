import { expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { buildPageVisualSvg } from "../pageVisualExport";
import { buildEditableSlideReconstruction, canReconstructElementInPptx } from "../pptxEditableReconstruction";
import { textLineAdvance, pptxTextLineSpacing } from "../textLineSpacing";
import { buildReportPreflight } from "../reportPreflight";
import { buildPptxBlob, buildPdfBlob } from "../coreDocumentExports";
import { reviewNarrative, narrativeState } from "../../narratives/narrativeEvidence";
import { changeSummaryFixture } from "../../analytics/__tests__/changeSummaryFixture";
function fixture() {
 const draft = structuredClone(initialDashboard), element = structuredClone(draft.pages.flatMap(p => p.elements).find(e => e.type === "text")!);
 element.id = "synthetic-spacing-text"; element.name = "Synthetic spacing text"; element.content = "LINE-ONE\nLINE-TWO"; element.layout = { x: 20, y: 20, width: 1000, height: 600, zIndex: 1 }; element.style = { ...element.style, fontSize: 20, padding: 0, lineHeight: 2 };
 draft.pages = [{ ...draft.pages[0], elements: [element], tiles: [] }]; return { draft, element, page: draft.pages[0] };
}
function positions(svg: string) { return [...svg.matchAll(/<text[^>]*\by="([^"]+)"[^>]*>(LINE-[^<]+)<\/text>/g)].map(m => Number(m[1])); }
it("uses the authored line height for exported SVG baselines", () => {
 const { page, element } = fixture(), before = structuredClone(page); expect(positions(buildPageVisualSvg(page))).toEqual([40, 80]); element.style.lineHeight = 1; expect(positions(buildPageVisualSvg(page))).toEqual([40, 60]); element.style.lineHeight = 2; expect(page).toEqual(before);
});
it("renders more than eight complete text lines when the authored box has space", () => {
 const { page, element } = fixture(); element.style.lineHeight = 1.2; element.content = Array.from({ length: 10 }, (_, i) => `LINE-${i + 1}`).join("\n"); const before = structuredClone(page), svg = buildPageVisualSvg(page); expect(positions(svg)).toHaveLength(10); expect(svg).toContain("LINE-10"); expect(page).toEqual(before);
});
it("records authored point line spacing in editable PowerPoint paragraphs", () => {
 const { page } = fixture(), before = structuredClone(page), xml = buildEditableSlideReconstruction(page, 3).editableXml;
 expect(xml.match(/<a:lnSpc><a:spcPts val="3000"\/><\/a:lnSpc>/g)).toHaveLength(2); expect(page).toEqual(before);
});

it.each([0.8, 1, 1.3, 2])("keeps authored baseline advance for lineHeight%s", lineHeight => {
 const { page, element } = fixture(); element.style.lineHeight = lineHeight;
 expect(positions(buildPageVisualSvg(page))[1] - positions(buildPageVisualSvg(page))[0]).toBeCloseTo(20 * lineHeight, 12); expect(pptxTextLineSpacing(20, lineHeight)).toBe(Math.round(20 * lineHeight * 75));
});
it.each([0, -1, NaN, Infinity])("refuses invalid authored lineHeight%s without changing the object", lineHeight => {
 const { page, element } = fixture(); element.style.lineHeight = lineHeight; const before = structuredClone(page);
 expect(() => buildPageVisualSvg(page)).toThrow(/line height/); expect(canReconstructElementInPptx(element)).toBe(false); expect(page).toEqual(before);
});
it.each([0, -1, NaN, Infinity])("refuses invalid fontSize%s in the shared spacing calculation", size => { expect(() => textLineAdvance(size, 1.3)).toThrow(/font size/); });
it("checks multiplication and DrawingML representability instead of clamping authored spacing", () => {
 expect(() => textLineAdvance(Number.MAX_VALUE, 2)).toThrow(); expect(pptxTextLineSpacing(20, 105.6)).toBe(158400);
 expect(() => pptxTextLineSpacing(20, 105.6007)).toThrow(/PowerPoint/); expect(() => pptxTextLineSpacing(0.000001, 1)).toThrow(/PowerPoint/);
 const { element } = fixture(); element.style.fontSize = 0.000001; element.style.lineHeight = 1; expect(canReconstructElementInPptx(element)).toBe(false);
});
it("retains missing legacy spacing without adding it to the stored style", () => {
 const { page, element } = fixture(); delete (element.style as Partial<typeof element.style>).lineHeight; const before = structuredClone(page);
 expect(positions(buildPageVisualSvg(page))).toEqual([40, 64.8]); const xml = buildEditableSlideReconstruction(page, 3).editableXml; expect(xml).not.toContain("a:lnSpc"); expect(xml).toContain('<a:pPr algn="l"/>'); expect(Object.hasOwn(element.style, "lineHeight")).toBe(false); expect(page).toEqual(before);
});
it("honors padding and complete line-box capacity and reports insufficient height before rendering", () => {
 const { draft, page, element } = fixture(); element.style.padding = 10; element.layout.height = 100; expect(positions(buildPageVisualSvg(page))).toEqual([50, 90]); element.layout.height = 99; const before = structuredClone(draft);
 expect(() => buildPageVisualSvg(page)).toThrow(/fit/); expect(buildReportPreflight(draft)[0].issues).toContainEqual(expect.objectContaining({ check: "PDF layout", objectId: element.id })); expect(draft).toEqual(before);
});
it("retains every fitting line and refuses the next smaller capacity rather than truncating", () => {
 const { page, element } = fixture(); element.style.lineHeight = 1.2; element.layout.height = 240; element.content = Array.from({ length: 10 }, (_, i) => `LINE-${i + 1}`).join("\n"); expect(positions(buildPageVisualSvg(page))).toHaveLength(10); element.layout.height = 239; expect(() => buildPageVisualSvg(page)).toThrow(/fit/);
});
it("uses authored spacing for valid evidence-linked text without changing its evidence or source", async () => {
 const { page, element } = fixture(), { before: result } = await changeSummaryFixture(); element.style.lineHeight = 1.3;
 const tile = { ...structuredClone(initialDashboard.pages[0].tiles[0]), id: "spacing-evidence-source", query: result.query, result, visualization: "table" as const };
 const sourcePage = { ...structuredClone(page), id: "source-page", title: "Synthetic evidence source", order: 0, elements: [], tiles: [tile] }; const pages = [sourcePage, page];
 element.evidence = reviewNarrative(element, pages, [{ tileId: tile.id, rowId: result.table[0].optionId, columnId: result.columns[0].id }]); const before = structuredClone(pages);
 expect(narrativeState(element, pages)?.current).toBe(true); expect(positions(buildPageVisualSvg(page))).toEqual([40, 66]); expect(buildPageVisualSvg(page)).toContain("Recorded evidence:"); expect(pages).toEqual(before);
});
async function zipParts(blob: Blob) {
 const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), out = new Map<string, string>(); let at = 0;
 while (view.getUint32(at, true) === 0x04034b50) { expect(view.getUint16(at + 8, true)).toBe(0); const size = view.getUint32(at + 18, true), name = view.getUint16(at + 26, true), extra = view.getUint16(at + 28, true), start = at + 30 + name + extra; out.set(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + name)), new TextDecoder().decode(bytes.subarray(start, start + size))); at = start + size; }
 return out;
}
it("routes the complete SVG to PDF rasterization and emits explicit spacing in the actual PPTX package", async () => {
 const { page, element } = fixture(); element.content = Array.from({ length: 10 }, (_, i) => `LINE-${i + 1}`).join("\n"); const before = structuredClone(page), svgs: string[] = [];
 const raster = async (svg: string) => { svgs.push(svg); return "data:image/jpeg;base64,/9j/2Q=="; }; await buildPdfBlob([page], raster); expect(svgs[0]).toBe(buildPageVisualSvg(page)); expect(positions(svgs[0])).toHaveLength(10);
 const parts = await zipParts(await buildPptxBlob([page], async()=>"data:image/png;base64,iVBORw0KGgo=")); const slide = parts.get("ppt/slides/slide1.xml")!; expect(slide.match(/<a:lnSpc><a:spcPts val="3000"\/><\/a:lnSpc>/g)).toHaveLength(10); expect(slide).toContain("LINE-10"); expect(page).toEqual(before);
});

it("accepts an exact fractional line-box boundary without allowing a height deficit", () => {
 const { page, element } = fixture(); element.style.fontSize = 19; element.style.lineHeight = 1.1; element.layout.height = 209; element.content = Array.from({ length: 10 }, (_, i) => `LINE-${i + 1}`).join("\n");
 expect(positions(buildPageVisualSvg(page))).toHaveLength(10); element.layout.height = 208.999; expect(() => buildPageVisualSvg(page)).toThrow(/fit/);
});
