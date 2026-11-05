import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
vi.mock("../pageVisualExport", async original => ({ ...await original<typeof import("../pageVisualExport")>(), renderPageVisualImages: vi.fn() }));
import { buildPageVisualSvg, renderPageVisualImages } from "../pageVisualExport";
import { buildPdfBlob, buildPptxBlob, buildXlsxBlob, exportCoreDocument } from "../coreDocumentExports";
import { assertExportResultsCurrent, spreadsheetColumnName } from "../exportIntegrity";
import { buildNativePptxChartDescriptor, canReconstructTileAsNativePptxChart } from "../pptxNativeCharts";
import { buildDashboardExportSpec } from "../../builder/builderExportPackage";
import { updateTileFilterValue } from "../../builder/components/inspectorTileQueryModel";
import { initialDashboard } from "../../document/documentSeeds";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";
import type { DashboardDraft, DashboardPage } from "../../../../shared/types/dashboard";
import type { AnalyticsQueryResponse } from "../../../../shared/types/analytics";

const output = process.env.ECOFOCUS_EXPORT_ARTIFACTS ?? join(tmpdir(), "ecofocus-export-integrity-artifacts");
const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (text: string, options: { contentType: string }) => { window: { document: Document } } };
const selected = "FILTER-SYNTHETIC-NORTH";
function document(result: AnalyticsQueryResponse): DashboardDraft {
  const draft = structuredClone(initialDashboard), page = draft.pages[0];
  page.elements = []; page.tiles = [{ ...page.tiles[0], query: result.query, result, title: "Synthetic totals", name: "Synthetic totals", visualization: "grouped_bar" }];
  page.tiles[0].appearance.axisLabelOverrides = { [result.table[0].optionId]: "DISPLAY-OVERRIDE-SENTINEL" };
  draft.pages = [page]; return draft;
}
async function analysis(csv: string, metric: "sum" | "count" | "average") {
  const bytes = new TextEncoder().encode(csv); const imported = await importDatasetBuffer(bytes.buffer, "synthetic.csv");
  if (!imported.dataset) throw new Error(imported.error ?? "Synthetic import failed");
  const dataset = imported.dataset;
  for (const field of dataset.fields) if (field.sourceColumn !== "Spend") Object.assign(field, { type: "categorical", modelingRole: "candidate_dimension", eligibleForFilter: true, eligibleForBanner: true });
  const field = (name: string) => dataset.fields.find(field => field.sourceColumn === name)!;
  return runImportedDatasetQuery({ dataset, field: field("Answer"), bannerField: field("Banner"), filter: { field: field("Region"), value: selected },
    measureField: metric === "count" ? null : { ...field("Spend"), type: "numeric", modelingRole: "candidate_measure" }, chartType: "grouped_bar", metric });
}
async function wide() {
  let csv = "Answer,Banner,Region,Spend\n";
  for (let index = 1; index <= 30; index++) {
    const banner = `G${String(index).padStart(2, "0")}`;
    for (let row = 0; row < index; row++) csv += `Yes & <Ω>,${banner},${selected},${index}\n`;
    csv += `Excluded,${banner},EXCLUDED-SOUTH,9999\n`;
  }
  return document(await analysis(csv, "count"));
}
async function measures() {
  return document(await analysis(`Answer,Banner,Region,Spend\nA,Core,${selected},$10\nA,Core,${selected},\nA,Growth,${selected},20\nA,Growth,${selected},30\nB,Core,${selected},40\nB,Core,${selected},50\nB,Core,${selected},60\nB,Growth,${selected},70\nA,Core,EXCLUDED-SOUTH,9999\n`, "sum"));
}
async function files(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer); const parts = new Map<string, string>(); let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    expect(view.getUint16(offset + 8, true)).toBe(0);
    const size = view.getUint32(offset + 18, true), names = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + names)), start = offset + 30 + names + extra;
    if (name.endsWith(".xml")) parts.set(name, new TextDecoder().decode(bytes.subarray(start, start + size)));
    offset = start + size;
  }
  return { bytes, parts };
}
function xml(text: string) { return new JSDOM(text, { contentType: "application/xml" }).window.document; }
function rows(text: string) {
  return [...xml(text).getElementsByTagName("row")].map(row => [...row.getElementsByTagName("c")].map(cell => ({
    ref: cell.getAttribute("r")!, value: cell.textContent!, number: cell.getElementsByTagName("v").length > 0, type: cell.getAttribute("t")
  })));
}
function save(name: string, content: string | Uint8Array) { mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${name}`, content); }

describe("data-preserving export integrity", () => {
  it("writes all 30 banner values and their bases to valid A1 addresses beyond Z", async () => {
    const draft = await wide(), original = structuredClone(draft); const result = draft.pages[0].tiles[0].result;
    expect(result.columns).toHaveLength(30); expect(result.table.map(row => row.label)).toEqual(["Yes & <Ω>"]);
    const { bytes, parts } = await files(buildXlsxBlob(draft, draft.pages)), sheet = parts.get("xl/worksheets/sheet2.xml")!, parsed = rows(sheet);
    for (const row of parsed) for (const cell of row) expect(cell.ref).toMatch(/^[A-Z]+[1-9]\d*$/);
    const data = parsed.find(row => row[0]?.value === "Yes & <Ω>")!;
    expect(data).toHaveLength(62); expect(data[61].ref).toMatch(/^BJ\d+$/); expect(data[1].value).toBe("DISPLAY-OVERRIDE-SENTINEL");
    result.columns.forEach((column, index) => { expect(Number(data[2 + 2 * index].value)).toBe(Number(column.label.slice(1))); expect(Number(data[3 + 2 * index].value)).toBe(Number(column.label.slice(1))); });
    expect(sheet).toContain(selected); expect(sheet).toContain("Executed query (JSON)"); expect(sheet).toContain("Unweighted");
    expect(draft).toEqual(original); save("fixed-wide.xlsx", bytes); save("fixed-wide-source.json", JSON.stringify(result, null, 2));
  });
  it("preserves exact per-cell numeric bases 1/2 and 3/1 alongside the filtered sums", async () => {
    const draft = await measures(); draft.pages[0].tiles[0].appearance.axisLabelOverrides[draft.pages[0].tiles[0].result.columns[0].id] = "DISPLAY-CORE";
    const { bytes, parts } = await files(buildXlsxBlob(draft, draft.pages));
    const sheet = parts.get("xl/worksheets/sheet2.xml")!, parsed = rows(sheet);
    const numbers = (label: string) => parsed.find(row => row[0]?.value === label)!.filter(cell => cell.number).map(cell => Number(cell.value));
    expect(numbers("A")).toEqual([10, 1, 50, 2]); expect(numbers("B")).toEqual([150, 3, 70, 1]);
    expect(sheet).toContain("Valid measure per cell"); expect(sheet).toContain("sum; number"); expect(sheet).toContain(selected);
    expect(sheet).toContain("Core (display: DISPLAY-CORE)"); expect(sheet).toContain("Column labels (JSON)");
    save("fixed-measures.xlsx", bytes); save("fixed-measures-source.json", JSON.stringify(draft.pages[0].tiles[0].result, null, 2));
  });
  it("keeps formula-like and Unicode labels as literal text, with full numerical precision", async () => {
    const draft = await measures(), result = draft.pages[0].tiles[0].result;
    result.table[0].label = "=1+1 & <Ω>"; result.table[0].values[result.columns[0].id] = -0.1234567890123;
    const { parts } = await files(buildXlsxBlob(draft, draft.pages)); const sheet = parts.get("xl/worksheets/sheet2.xml")!;
    const row = rows(sheet).find(row => row[0]?.value === "=1+1 & <Ω>")!;
    expect(row[0].type).toBe("inlineStr"); expect(xml(sheet).getElementsByTagName("f")).toHaveLength(0);
    expect(Number(row[2].value)).toBe(-0.1234567890123);
    draft.pages[0].tiles[0].title = "Synthetic\r\nmultiline";
    const multiline = await files(buildXlsxBlob(draft, draft.pages));
    expect(rows(multiline.parts.get("xl/worksheets/sheet2.xml")!).some(row => row[0]?.value === "Tile" && row[1]?.value === "Synthetic\r\nmultiline")).toBe(true);
  });
  it("labels weighted bases as totals without presenting them as respondent sample sizes", async () => {
    const draft = await measures(), result = draft.pages[0].tiles[0].result;
    result.weighting = { applied: true, id: "weightvar", label: "Synthetic weighting" }; result.query.weight = "weightvar";
    result.table[0].bases[result.columns[0].id] = 2.75;
    const { parts } = await files(buildXlsxBlob(draft, draft.pages)); const sheet = parts.get("xl/worksheets/sheet2.xml")!;
    expect(sheet).toContain("weighted base total"); expect(sheet).toContain("Synthetic weighting"); expect(sheet).toContain("Significance unavailable");
    expect(sheet).toContain("respondent sample size is unavailable"); expect(sheet).not.toContain("Valid measure per cell");
    expect(rows(sheet).some(row => row.some(cell => cell.number && Number(cell.value) === 2.75))).toBe(true);
  });
  it("blocks pending analysis edits for XLSX and JSON without changing the original result", async () => {
    const draft = await wide(), tile = draft.pages[0].tiles[0];
    draft.pages[0].tiles[0] = { ...tile, ...updateTileFilterValue(tile, "SHOPPER_SEGMENT", "price_first") };
    const original = structuredClone(draft);
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow("edited analysis settings");
    expect(() => buildDashboardExportSpec(draft, draft.pages)).toThrow("edited analysis settings");
    expect(draft).toEqual(original);
  });
  it("allows cosmetic chart changes and equivalent filter ordering while retaining executed provenance", async () => {
    const draft = await wide(), tile = draft.pages[0].tiles[0];
    tile.query = { ...tile.query, chartType: "table", filters: [{ field: "SHOPPER_SEGMENT", values: ["eco_engaged", "price_first"] }] };
    tile.result.query = { ...tile.result.query, filters: [{ field: "SHOPPER_SEGMENT", values: ["price_first", "eco_engaged"] }] };
    expect(() => assertExportResultsCurrent(draft.pages)).not.toThrow();
    const exported = buildDashboardExportSpec(draft, draft.pages).slides[0].tiles[0];
    expect(exported.query).toEqual(tile.result.query); expect(exported.result.query).toEqual(tile.result.query); expect(exported.result.table).toEqual(tile.result.table);
  });
  it("declines unverified cached numeric bases in XLSX while JSON retains the original data with a refresh cue", async () => {
    const draft = await measures(), tile = draft.pages[0].tiles[0];
    const source = tile.result.metadataRefs.source;
    if (source?.kind !== "imported") throw new Error("Synthetic imported result required");
    delete source.measureBaseScope;
    const querySource = tile.result.query.sourceIdentity; if (querySource?.kind === "imported") delete querySource.measureBaseScope;
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow("cached numeric sample bases are unverified");
    const exported = buildDashboardExportSpec(draft, draft.pages).slides[0].tiles[0];
    expect(exported.result.table).toEqual(tile.result.table); expect(exported.exportHints.sampleSize).toContain("need refresh");
  });
  it("treats reordered comparison waves as a pending analytical change", async () => {
    const draft = await wide(), tile = draft.pages[0].tiles[0];
    tile.result.query = { ...tile.result.query, comparisonMode: "wave", comparisonDatasets: ["ecofocus_2024", "ecofocus_2023"] };
    tile.query = { ...tile.result.query, comparisonDatasets: ["ecofocus_2023", "ecofocus_2024"] };
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow("edited analysis settings");
    expect(() => buildDashboardExportSpec(draft, draft.pages)).toThrow("edited analysis settings");
  });
  it.each(["missing value", "nonfinite value", "missing base", "negative base"])("fails explicitly for %s", async defect => {
    const draft = await measures(), result = draft.pages[0].tiles[0].result, key = result.columns[0].id;
    if (defect === "missing value") delete result.table[0].values[key];
    if (defect === "nonfinite value") result.table[0].values[key] = Infinity;
    if (defect === "missing base") delete result.table[0].bases[key];
    if (defect === "negative base") result.table[0].bases[key] = -1;
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow(/missing|invalid|finite/);
  });
  it("uses case-insensitively unique worksheet names and preserves full titles in metadata", async () => {
    const draft = await measures(), page = draft.pages[0]; page.tiles[0].title = "Report";
    page.tiles.push({ ...structuredClone(page.tiles[0]), id: "other", title: "report" });
    const { parts } = await files(buildXlsxBlob(draft, draft.pages));
    const names = [...xml(parts.get("xl/workbook.xml")!).getElementsByTagName("sheet")].map(sheet => sheet.getAttribute("name")!.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(parts.get("xl/worksheets/sheet2.xml")).toContain(">Report<"); expect(parts.get("xl/worksheets/sheet3.xml")).toContain(">report<");
  });
  it("rejects Excel text limits/control characters rather than truncate, while JSON remains lossless", async () => {
    const draft = await measures(); draft.pages[0].tiles[0].title = "X".repeat(32768);
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow("32,767");
    expect(buildDashboardExportSpec(draft, draft.pages).slides[0].tiles[0].title).toHaveLength(32768);
    draft.pages[0].tiles[0].title = "Synthetic\u0000control";
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow("invalid XML character");
    expect(JSON.stringify(buildDashboardExportSpec(draft, draft.pages))).toContain("Synthetic\\u0000control");
    draft.pages[0].tiles[0].title = "Line\n".repeat(254);
    expect(() => buildXlsxBlob(draft, draft.pages)).toThrow("253 line feeds");
  });
  it("supports the complete Excel column range and rejects overflow", () => {
    expect([25, 26, 51, 52, 16383].map(spreadsheetColumnName)).toEqual(["Z", "AA", "AZ", "BA", "XFD"]);
    expect(() => spreadsheetColumnName(16384)).toThrow("16,384"); expect(() => spreadsheetColumnName(-1)).toThrow();
  });
  it.each(["pptx", "pdf"] as const)("refuses unsupported donut geometry before %s rasterization or download", async target => {
    const draft = await wide(), createURL = vi.spyOn(URL, "createObjectURL");
    draft.pages[0].tiles[0].visualization = "donut";
    draft.pages[0].tiles[0].layout = {x:20,y:20,width:1200,height:680,zIndex:1};
    try {
      await expect((target === "pptx" ? buildPptxBlob : buildPdfBlob)(draft.pages)).rejects.toThrow("mutually exclusive");
      await expect(exportCoreDocument(draft, draft.pages, target)).rejects.toThrow("mutually exclusive");
      expect(renderPageVisualImages).not.toHaveBeenCalled(); expect(createURL).not.toHaveBeenCalled();
    } finally { createURL.mockRestore(); }
  });
  it("retains all experimental native chart series and display labels", async () => {
    const draft = await wide(), tile = draft.pages[0].tiles[0];
    const descriptor = buildNativePptxChartDescriptor(tile, 1, 101, "rId2"), parsed = xml(descriptor.chartXml);
    expect(parsed.getElementsByTagName("c:ser")).toHaveLength(30);
    expect(descriptor.chartXml).toContain("G30"); expect(descriptor.chartXml).toContain("DISPLAY-OVERRIDE-SENTINEL");
    save("EXPERIMENTAL-NOT-OFFICE-ACCEPTANCE-chart.xml", descriptor.chartXml);
    const spec = buildDashboardExportSpec(draft, draft.pages); save("fixed-presentation-package.json", JSON.stringify(spec, null, 2));
    expect(spec.slides[0].tiles[0].result.table).toEqual(tile.result.table);
  });
});

it("retains small nonzero calculated values in XLSX, native chart data and visual labels", async () => {
  const result = await analysis(`Answer,Banner,Region,Spend\nA,Core,${selected},0.000001\nA,Core,${selected},0.000003\n`, "sum");
  const draft = document(result), tile = draft.pages[0].tiles[0];
  expect(result.table[0].values[result.columns[0].id]).toBe(0.000004);
  const { parts, bytes } = await files(buildXlsxBlob(draft, draft.pages));
  const data = rows(parts.get("xl/worksheets/sheet2.xml")!).find(row => row[0]?.value === "A")!;
  expect(Number(data[2].value)).toBe(0.000004); expect(data[2].number).toBe(true);
  const descriptor = buildNativePptxChartDescriptor(tile, 1, 101, "rId2");
  expect(descriptor.chartXml).toContain("0.000004"); expect(descriptor.chartXml).toContain("4E-6");
  expect(xml(descriptor.chartXml).getElementsByTagName("c:valAx")[0].getElementsByTagName("c:numFmt")[0].getAttribute("formatCode")).toBe("General");
  const svg = buildPageVisualSvg(draft.pages[0]); expect(svg).toContain("4E-6"); expect(svg).toContain('data-value="0.000004"');
  save('precise-numeric-summary.xlsx', bytes); save('precise-numeric-summary.svg',svg); save('precise-numeric-chart.xml',descriptor.chartXml);
});

it("exports unavailable means as nonnumeric cells and sparse chart gaps, with explicit JSON status", async () => {
 const result=await analysis(`Answer,Banner,Region,Spend\nNegative,A,${selected},-10\nLower,A,${selected},-20\nMissing,A,${selected},invalid\nZero,A,${selected},0\nNegative,B,${selected},-5\n`,"average");
 const order=["Negative","Missing","Lower","Zero"];result.table=order.map(label=>result.table.find(row=>row.label===label)!);
 const draft=document(result),tile=draft.pages[0].tiles[0];tile.layout={x:20,y:20,width:1200,height:680,zIndex:1};tile.appearance.showValueLabels=false;
 const {parts}=await files(buildXlsxBlob(draft,draft.pages));const data=rows(parts.get("xl/worksheets/sheet2.xml")!);
 const missing=data.find(row=>row[0]?.value==="Missing")!;expect(missing.filter(cell=>cell.value==="Unavailable")).toHaveLength(2);expect(missing[2].number).toBe(false);expect(missing[3]).toMatchObject({value:"0",number:true});
 const zero=data.find(row=>row[0]?.value==="Zero")!;expect(zero[2]).toMatchObject({value:"0",number:true});
 const descriptor=buildNativePptxChartDescriptor(tile,1,101,"rId2"),chart=xml(descriptor.chartXml);
 const caches=Array.from(chart.getElementsByTagName("c:val"));
 expect(caches[0].getElementsByTagName("c:ptCount")[0].getAttribute("val")).toBe("4");
 expect(Array.from(caches[0].getElementsByTagName("c:pt")).map(point=>point.getAttribute("idx"))).toEqual(["0","2","3"]);
 expect(Array.from(caches[1].getElementsByTagName("c:pt")).map(point=>point.getAttribute("idx"))).toEqual(["0"]);
 tile.visualization="line_chart";const svg=buildPageVisualSvg(draft.pages[0]);
 const points=Array.from(svg.matchAll(/<circle data-row="([^"]+)" data-column="([^"]+)" data-value="([^"]+)"/g));expect(points).toHaveLength(4);expect(points.some(point=>point[1]===result.table[1].optionId)).toBe(false);
 const lines=Array.from(svg.matchAll(/<polyline data-series="[^"]+" points="([^"]+)"/g));expect(lines).toHaveLength(1);expect(lines[0][1].split(" ")).toHaveLength(2);
 tile.visualization="table";const tableSvg=buildPageVisualSvg(draft.pages[0]);expect(tableSvg).toContain("Unavailable");
 const spec=buildDashboardExportSpec(draft,draft.pages), exported=spec.slides[0].tiles[0].result;
 expect(exported.cellStatuses.find(row=>row.rowId===result.table[1].optionId)?.cells[result.columns[0].id]).toEqual({status:"no_observations",value:null});
 expect(exported.table[1].values[result.columns[0].id]).toBe(0);
 save("missing-means-chart.xml",descriptor.chartXml);save("missing-means-line.svg",svg);save("missing-means-table.svg",tableSvg);
});

it("keeps an explicit unavailable-chart message in PPTX raster fallback when all means are empty", async () => {
 const result=await analysis(`Answer,Banner,Region,Spend\nMissing,A,${selected},invalid\nOther,B,${selected},invalid\n`,"average");
 const draft=document(result),tile=draft.pages[0].tiles[0];tile.layout={x:20,y:20,width:1200,height:680,zIndex:1};
 expect(canReconstructTileAsNativePptxChart(tile)).toBe(false);expect(buildPageVisualSvg(draft.pages[0])).toContain("Unavailable: no valid numeric observations.");
});

it("rejects legacy unverified numeric bases in XLSX rather than exporting them as sample sizes", async () => {
 const result=await analysis(`Answer,Banner,Region,Spend\nA,Core,${selected},10\nB,Growth,${selected},20\n`,"average");
 if(result.metadataRefs.source?.kind!=="imported")throw Error("Missing imported source");delete result.metadataRefs.source.measureBaseScope;
 const draft=document(result);expect(()=>buildXlsxBlob(draft,draft.pages)).toThrow("cached numeric sample bases are unverified");
});
