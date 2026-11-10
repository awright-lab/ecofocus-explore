import { expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { dotPlotFixture } from "../../analytics/__tests__/dotPlotFixture";
import { reviewPptxEditability } from "../pptxEditability";
import { buildPptxBlob } from "../coreDocumentExports";
import { buildReportPreflight } from "../reportPreflight";

async function fixture() {
 const { draft, tile } = await dotPlotFixture();
 tile.visualization = "grouped_bar"; tile.query.chartType = tile.visualization; tile.result.query.chartType = tile.visualization;
 tile.appearance.showValueLabels = false; tile.layout.zIndex = 10;
 const page = draft.pages[0];
 page.elements = [{ ...structuredClone(initialDashboard.pages[0].elements[0]), id: "foreground", name: "Foreground", type: "rectangle", content: "", layout: { x: 20, y: 20, width: 100, height: 100, zIndex: 20 } }];
 return { draft, page, tile };
}
async function zipText(blob: Blob) {
 const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), parts = new Map<string, string>(); let at = 0;
 while (view.getUint32(at, true) === 0x04034b50) {
  expect(view.getUint16(at + 8, true)).toBe(0);
  const size = view.getUint32(at + 18, true), name = view.getUint16(at + 26, true), extra = view.getUint16(at + 28, true), start = at + 30 + name + extra;
  parts.set(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + name)), new TextDecoder().decode(bytes.subarray(start, start + size))); at = start + size;
 }
 return parts;
}
it.each(["hybrid", "overlap", "table"] as const)("matches actual PPTX slide XML for %s without changing source", async mode => {
 const { draft, page, tile } = await fixture();
 if (mode === "overlap") page.elements[0].layout = { ...tile.layout, zIndex: 0 };
 if (mode === "table") { tile.visualization = "table"; tile.query.chartType = "table"; tile.result.query.chartType = "table"; }
 const before = JSON.stringify(draft), review = reviewPptxEditability(page);
 expect(review.available).toBe(true); if (!review.available) throw Error("Missing review");
 const parts = await zipText(await buildPptxBlob([page], async () => "data:image/jpeg;base64,/9j/2Q==")), slide = parts.get("ppt/slides/slide1.xml")!;
 expect((slide.match(/<p:sp>/g) ?? []).length).toBe(review.editableObjects);
 expect((slide.match(/<p:graphicFrame>/g) ?? []).length).toBe(review.editableCharts);
 expect((slide.match(/<p:pic>/g) ?? []).length).toBe(1);
 expect(review.imageObjects + review.editableObjects + review.editableCharts).toBe(2);
 expect(buildReportPreflight(draft)[0].pptxEditability).toEqual(review);
 expect(JSON.stringify(draft)).toBe(before);
});
it("excludes hidden content and identifies individual image-only chart bodies", async () => {
 const { page, tile } = await fixture(); page.elements[0].hidden = true; tile.visualization = "dot_plot"; tile.query.chartType = "dot_plot"; tile.result.query.chartType = "dot_plot";
 expect(reviewPptxEditability(page)).toMatchObject({ editableObjects: 0, editableCharts: 0, imageObjects: 1, objects: [{ id: tile.id, mode: "Slide image" }] });
 tile.hidden = true; expect(reviewPptxEditability(page)).toMatchObject({ objects: [], imageObjects: 0 });
});
it("bounds object details consistently with exporter policy", async () => {
 const { page } = await fixture(); page.tiles = []; page.elements = Array.from({ length: 501 }, (_, i) => ({ ...page.elements[0], id: String(i) }));
 expect(reviewPptxEditability(page)).toMatchObject({ mode: "complete_visual", imageObjects: 501, editableObjects: 0, objects: [], detailsOmitted: true });
});
it("discloses the exporter conservative fallback when eligibility cannot be checked", async () => {
 const { page, tile } = await fixture(); tile.result.table = null as never;
 expect(reviewPptxEditability(page)).toMatchObject({ available: true, mode: "complete_visual", editableObjects: 0, editableCharts: 0, reason: expect.stringContaining("invalid analytical content still blocks export") });
});
it("rechecks changed composition instead of mutating or caching a prior result", async () => {
 const { page } = await fixture(); expect(reviewPptxEditability(page)).toMatchObject({ editableObjects: 1 });
 page.elements[0].type = "image"; expect(reviewPptxEditability(page)).toMatchObject({ editableObjects: 0, imageObjects: 1 });
});

it("reports unavailable inventory for an unreadable page structure", async () => {
 const { page } = await fixture(); page.tiles = null as never;
 expect(reviewPptxEditability(page)).toEqual({ available: false });
});

it.each(["table", "dot_plot", "image", "empty"] as const)("does not advertise editable overlays for a %s-only page", async kind => {
 const { draft, page, tile } = await fixture(); page.elements = [];
 if (kind === "image" || kind === "empty") page.tiles = [];
 else { tile.visualization = kind; tile.query.chartType = kind; tile.result.query.chartType = kind; }
 if (kind === "image") page.elements = [{ ...structuredClone(initialDashboard.pages[0].elements[0]), id: "image", name: "Synthetic image", type: "image", content: "data:image/png;base64,iVBORw0KGgo=", layout: { x: 20, y: 20, width: 100, height: 100, zIndex: 1 } }];
 const before = JSON.stringify(draft), review = reviewPptxEditability(page);
 expect(review).toMatchObject({ available: true, mode: "hybrid", editableObjects: 0, editableCharts: 0, imageObjects: kind === "empty" ? 0 : 1 });
 const parts = await zipText(await buildPptxBlob([page], async () => "data:image/jpeg;base64,/9j/2Q==")), slide = parts.get("ppt/slides/slide1.xml")!;
 expect(slide).not.toContain("<p:sp>"); expect(slide).not.toContain("<p:graphicFrame>"); expect(slide).toContain("<p:pic>"); expect(JSON.stringify(draft)).toBe(before);
});
