import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import { buildPageVisualSvg } from "../pageVisualExport";
import { buildPdfBlob, buildPptxBlob } from "../coreDocumentExports";
import { buildNativePptxChartDescriptor } from "../pptxNativeCharts";
import { analysisVisualLayout } from "../analysisVisualExport";
import type { DashboardPage, DashboardTile } from "../../../../shared/types/dashboard";

const output = process.env.ECOFOCUS_EXPORT_ARTIFACTS ?? join(tmpdir(), "ecofocus-synthetic-export-artifacts");
const runtime = process.env.ECOFOCUS_EXPORT_RUNTIME ?? "";
const hasRaster = Boolean(runtime) && existsSync(runtime.replace("package.json", "node_modules/sharp/package.json"));
const sharp = hasRaster ? createRequire(runtime)("sharp") : null;
const selected = "FILTER-SYNTHETIC-NORTH";
async function page(id: string, rows: number, columns: number, kind: DashboardTile["visualization"], count = false, signed = false) {
  let csv = "Answer,Banner,Region,Spend\n";
  for (let row = 1; row <= rows; row++) for (let column = 1; column <= columns; column++) {
    const amount = signed ? (row % 2 ? -1 : 1) * (row * 10 + column) : row * 100 + column;
    for (let repeat = 0; repeat < (count ? column : 1); repeat++) csv += `ROW-${String(row).padStart(2, "0")},G${String(column).padStart(2, "0")},${selected},${amount}\n`;
  }
  csv += "EXCLUDED,G01,SOUTH,99999\n";
  const bytes = new TextEncoder().encode(csv), imported = await importDatasetBuffer(bytes.buffer, "synthetic.csv");
  if (!imported.dataset) throw new Error(imported.error ?? "Synthetic import failed");
  for (const field of imported.dataset.fields) if (field.sourceColumn !== "Spend") Object.assign(field, { type: "categorical", modelingRole: "candidate_dimension", eligibleForFilter: true, eligibleForBanner: true });
  const field = (name: string) => imported.dataset!.fields.find(field => field.sourceColumn === name)!;
  const result = runImportedDatasetQuery({ dataset: imported.dataset, field: field("Answer"), bannerField: field("Banner"),
    filter: { field: field("Region"), value: selected }, measureField: count ? null : field("Spend"), metric: count ? "count" : "sum", chartType: kind });
  const draft = structuredClone(initialDashboard.pages[0]); draft.id = id; draft.title = id; draft.elements = [];
  draft.tiles = [{ ...draft.tiles[0], title: id, name: id, result, query: result.query, visualization: kind, layout: { x: 20, y: 20, width: 1200, height: 680, zIndex: 1 },
    appearance: { ...draft.tiles[0].appearance, showBases: true, showValueLabels: true, axisLabelOverrides: {} } }];
  return draft;
}
function cells(svg: string) { return [...svg.matchAll(/data-row="[^"]+" data-column="[^"]+" data-value="([^"]+)" data-base="([^"]+)"/g)].map(match => [Number(match[1]), Number(match[2])]); }
function sourceCells(p: DashboardPage) { const result = p.tiles[0].result; return result.table.flatMap(row => result.columns.map(column => [row.values[column.id], row.bases[column.id]])); }
function sorted(values: number[][]) { return values.map(value => value.join("/")).sort(); }
function save(name: string, content: string | Uint8Array) { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}`, content); }
function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), parts = new Map<string, string>(); let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), names = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true), start = offset + 30 + names + extra;
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + names));
    if (name.endsWith(".xml")) parts.set(name, new TextDecoder().decode(bytes.subarray(start, start + size)));
    offset = start + size;
  }
  return parts;
}

describe("bounded visual export completeness", () => {
  it("keeps all 72 cells, exact bases, labels and filter context in a 12 by 6 table", async () => {
    const fixture = await page("table-12x6", 12, 6, "table"), original = structuredClone(fixture), svg = buildPageVisualSvg(fixture);
    expect(cells(svg)).toHaveLength(72); expect(sorted(cells(svg))).toEqual(sorted(sourceCells(fixture)));
    for (const row of fixture.tiles[0].result.table) expect(svg).toContain(row.label);
    for (const column of fixture.tiles[0].result.columns) expect(svg).toContain(column.label);
    expect(svg).toContain(selected); expect(svg).toContain("1,206"); expect(svg).toContain("n=1"); expect(fixture).toEqual(original);
  });
  it.each(["grouped_bar", "stacked_bar", "horizontal_bar", "line_chart"] as const)("uses all source cells and honest geometry for %s", async kind => {
    const fixture = await page(kind, kind === "horizontal_bar" ? 12 : 6, kind === "grouped_bar" || kind === "stacked_bar" ? 2 : 1, kind, false, kind !== "stacked_bar");
    if (kind === "stacked_bar") fixture.tiles[0].appearance.showValueLabels = false;
    const svg = buildPageVisualSvg(fixture); expect(sorted(cells(svg))).toEqual(sorted(sourceCells(fixture)));
    expect(svg).not.toContain("NaN"); expect(svg).not.toMatch(/(?:width|height)="-/);
    if (kind === "line_chart") { expect(svg).toContain("<polyline"); expect(svg).toContain("straight line segments"); }
    if (kind === "horizontal_bar") {
      const rects = [...svg.matchAll(/<g data-row=.*?<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)];
      expect(new Set(rects.map(rect => rect[4])).size).toBe(1); expect(new Set(rects.map(rect => rect[3])).size).toBeGreaterThan(1);
    }
  });
  it("keeps line base labels clear of the plotted point markers", async () => {
    const fixture = await page("line-label-clearance", 6, 1, "line_chart", false, true);
    const svg = buildPageVisualSvg(fixture);
    const points = [...svg.matchAll(/<circle data-row=.*? cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
    const bases = [...svg.matchAll(/<text ([^>]+)>n=1<\/text>/g)];
    expect(points).toHaveLength(6); expect(bases).toHaveLength(6);
    for (const label of bases) {
      const x = Number(/x="([^"]+)"/.exec(label[1])![1]), y = Number(/y="([^"]+)"/.exec(label[1])![1]);
      const point = points.find(point => point.x === x)!;
      expect(y).toBeLessThanOrEqual(point.y - point.radius - 3);
    }
  });
  it("places native series data labels before categories/values and orders their settings per OOXML", async () => {
    const fixture = await page("native-semantic", 2, 2, "grouped_bar", true);
    const tile = fixture.tiles[0];
    const row = tile.result.table[0], column = tile.result.columns[0];
    tile.appearance.axisLabelOverrides[row.optionId] = "Response alias";
    tile.appearance.axisLabelOverrides[column.id] = "Series alias";
    const xml = buildNativePptxChartDescriptor(tile, 1, 3, "rId2").chartXml;
    expect(xml).toContain("Response alias"); expect(xml).toContain("Series alias");
    const series = [...xml.matchAll(/<c:ser>(.*?)<\/c:ser>/g)].map(match => match[1]);
    expect(series).toHaveLength(2);
    for (const content of series) {
      expect(content.indexOf("<c:dLbls>")).toBeLessThan(content.indexOf("<c:cat>"));
      expect(content.indexOf("</c:dLbls>")).toBeLessThan(content.indexOf("<c:val>"));
      expect(content).toContain('<c:showLegendKey val="0"/><c:showVal val="0"/>');
    }
    expect(xml).toContain("1 (n=2)"); expect(xml).toContain("2 (n=4)");
    expect(xml).toContain('<c:crosses val="autoZero"/>');
  });
  it("retains all 30 grouped series instead of capping or replacing data", async () => {
    const fixture = await page("grouped-30", 1, 30, "grouped_bar", true); const svg = buildPageVisualSvg(fixture);
    expect(cells(svg)).toHaveLength(30); expect(sorted(cells(svg))).toEqual(sorted(sourceCells(fixture))); expect(svg).toContain("G30");
  });
  it("refuses layouts that cannot contain all rows or labels rather than truncating", async () => {
    const fixture = await page("too-many-rows", 80, 6, "table"); expect(() => buildPageVisualSvg(fixture)).toThrow("too many rows");
    const dense = await page("dense-grouped", 12, 6, "grouped_bar"); expect(() => buildPageVisualSvg(dense)).toThrow(/labels cannot fit|bars cannot fit/);
  });
});

describe.skipIf(!hasRaster)("actual offline raster and document generation", () => {
  it("generates real chart/table PDFs and a hybrid PPTX using rendered SVG, not a raster stub", async () => {
    const pages = [await page("table-12x6", 12, 6, "table"), await page("grouped-30", 1, 30, "grouped_bar", true), await page("horizontal-signed", 12, 1, "horizontal_bar", false, true),
      await page("stacked-6x2", 6, 2, "stacked_bar"), await page("line-signed", 6, 1, "line_chart", false, true)];
    pages[3].tiles[0].appearance.showValueLabels = false;
    pages.forEach((p, index) => { p.order = index + 1; });
    const original = structuredClone(pages);
    const raster = (prefix: string) => {
      let index = 0;
      return async (svg: string, width: number, height: number) => {
        const number = ++index, png = await sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();
        const jpeg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
        save(`${prefix}-${number}.svg`, svg); save(`${prefix}-${number}.png`, png); save(`${prefix}-${number}.jpg`, jpeg);
        return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      };
    };
    const pdf = new Uint8Array(await (await buildPdfBlob(pages, raster("pdf"))).arrayBuffer());
    const pptx = new Uint8Array(await (await buildPptxBlob(pages, raster("pptx"))).arrayBuffer());
    save("actual-offline-render.pdf", pdf); save("actual-hybrid.pptx", pptx);
    const parts = unzip(pptx), chart = parts.get("ppt/charts/chart1.xml")!;
    expect([...chart.matchAll(/<c:ser>/g)]).toHaveLength(30); expect(chart).toContain("G30"); expect(chart).toContain("n=30");
    const stack = parts.get("ppt/charts/chart2.xml")!; expect(stack).toContain('<c:grouping val="stacked"/>');
    expect(pdf.slice(0, 8)).toEqual(new TextEncoder().encode("%PDF-1.4"));
    const python = runtime.replace("node/package.json", "python/python.exe");
    if (existsSync(python)) {
      const inspection = JSON.parse(execFileSync(python, ["-c", `
import sys,json
from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image,ImageChops
root=Path(sys.argv[1]); pdf=pdfium.PdfDocument(root/'actual-offline-render.pdf'); outcomes=[]
assert len(pdf)==5
for i in range(len(pdf)):
    page=pdf[i]; rendered=page.render(scale=4/3).to_pil().convert('RGB')
    expected=Image.open(root/f'pdf-{i+1}.jpg').convert('RGB').resize(rendered.size)
    bbox=ImageChops.difference(rendered,Image.new('RGB',rendered.size,'white')).getbbox()
    assert bbox is not None, f'PDF page {i+1} is blank'
    delta=ImageChops.difference(rendered,expected)
    mean=sum(sum(band.histogram()[v]*v for v in range(256)) for band in delta.split())/(rendered.width*rendered.height*3)
    assert mean<8, f'PDF page {i+1} differs from source raster: {mean}'
    rendered.save(root/f'independent-pdf-{i+1}.png')
    outcomes.append({'page':i+1,'meanAbsolutePixelDifference':mean,'nonWhiteBounds':bbox});page.close()
pdf.close();print(json.dumps(outcomes))
`, output], { encoding: "utf8" }));
      expect(inspection).toHaveLength(5); save("pdf-render-inspection.json", JSON.stringify(inspection, null, 2));
    }
    expect(pages).toEqual(original);
    save("source-manifest.json", JSON.stringify(pages.map(p => ({ id: p.id, context: p.tiles[0].result.query, result: p.tiles[0].result,
      plotArea: analysisVisualLayout(p.tiles[0]).area })), null, 2));
  }, 30000);
});
