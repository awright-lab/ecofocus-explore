import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import { slugifyFileName } from "../builder/components/CanvasRenderers";
import { dataUrlToBytes, renderPageVisualImages, type PageVisualImage } from "./pageVisualExport";
import { buildEditableSlideReconstruction, canReconstructElementInPptx } from "./pptxEditableReconstruction";
import { buildZip } from "./zip";
import type { DashboardDraft, DashboardPage } from "../../../shared/types/dashboard";

export type CoreExportTarget = "pptx" | "pdf" | "xlsx" | "json";

export interface CoreExportResult {
  target: CoreExportTarget;
  fileName: string;
  warnings: string[];
}

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const slideCx = 12192000;
const slideCy = 7239000;
const pdfPageWidth = 960;
const pdfPageHeight = Math.round((canvasHeight / canvasWidth) * pdfPageWidth);
const textEncoder = new TextEncoder();

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function visiblePages(pages: DashboardPage[]) {
  return [...pages].sort((a, b) => a.order - b.order);
}

function visibleTiles(page: DashboardPage) {
  return page.tiles.filter((tile) => !tile.hidden).sort((a, b) => a.layout.zIndex - b.layout.zIndex);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function visualSlideXml(image: PageVisualImage, index: number, editableXml = "") {
  return `${xmlHeader}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Slide ${index}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="${escapeXml(image.title || `Page ${index}`)} visual fallback"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideCx}" cy="${slideCy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>${editableXml}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function visualSlideRels(index: number) {
  return `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/page${index}.jpg"/></Relationships>`;
}

export async function buildPptxBlob(pages: DashboardPage[]) {
  const sortedPages = visiblePages(pages);
  const pageImages = await renderPageVisualImages(sortedPages, {
    // Hybrid PPTX strategy: keep a visual fallback for charts, image assets,
    // and complex content, then layer cleanly reconstructable elements as
    // editable Office objects.
    includeElement: (element) => !canReconstructElementInPptx(element)
  });
  const slideIds = pageImages.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("");
  const rels = pageImages.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const overrides = pageImages.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const files: Array<{ path: string; content: string | Uint8Array }> = [
    {
      path: "[Content_Types].xml",
      content: `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${overrides}</Types>`
    },
    {
      path: "_rels/.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`
    },
    {
      path: "ppt/presentation.xml",
      content: `${xmlHeader}<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${pageImages.length + 1}"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${slideCx}" cy="${slideCy}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
    },
    {
      path: "ppt/_rels/presentation.xml.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${pageImages.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`
    },
    {
      path: "ppt/slideMasters/slideMaster1.xml",
      content: `${xmlHeader}<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Master"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles/></p:sldMaster>`
    },
    {
      path: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`
    },
    {
      path: "ppt/slideLayouts/slideLayout1.xml",
      content: `${xmlHeader}<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Layout"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`
    }
  ];

  pageImages.forEach((image, index) => {
    const editable = buildEditableSlideReconstruction(sortedPages[index], 3);
    files.push({ path: `ppt/slides/slide${index + 1}.xml`, content: visualSlideXml(image, index + 1, editable.editableXml) });
    files.push({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: visualSlideRels(index + 1) });
    files.push({ path: `ppt/media/page${index + 1}.jpg`, content: dataUrlToBytes(image.dataUrl) });
  });

  return new Blob([buildZip(files)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function pdfObjectIds(pageIndex: number) {
  const base = 3 + pageIndex * 3;
  return {
    image: base,
    content: base + 1,
    page: base + 2
  };
}

function addPdfPart(chunks: Uint8Array[], value: string | Uint8Array) {
  chunks.push(typeof value === "string" ? textEncoder.encode(value) : value);
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
}

export async function buildPdfBlob(pages: DashboardPage[]) {
  const pageImages = await renderPageVisualImages(visiblePages(pages));
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteOffset = 0;

  function push(value: string | Uint8Array) {
    addPdfPart(chunks, value);
    byteOffset += typeof value === "string" ? textEncoder.encode(value).byteLength : value.byteLength;
  }

  function objectStart(id: number) {
    offsets[id] = byteOffset;
    push(`${id} 0 obj\n`);
  }

  function objectEnd() {
    push("\nendobj\n");
  }

  push("%PDF-1.4\n");
  objectStart(1);
  push("<< /Type /Catalog /Pages 2 0 R >>");
  objectEnd();

  const pageIds = pageImages.map((_, index) => pdfObjectIds(index).page);
  objectStart(2);
  push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  objectEnd();

  pageImages.forEach((image, index) => {
    const ids = pdfObjectIds(index);
    const bytes = dataUrlToBytes(image.dataUrl);
    objectStart(ids.image);
    push(`<< /Type /XObject /Subtype /Image /Width ${canvasWidth * 2} /Height ${canvasHeight * 2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.byteLength} >>\nstream\n`);
    push(bytes);
    push("\nendstream");
    objectEnd();

    const stream = `q\n${pdfPageWidth} 0 0 ${pdfPageHeight} 0 0 cm\n/Im${index + 1} Do\nQ`;
    objectStart(ids.content);
    push(`<< /Length ${textEncoder.encode(stream).byteLength} >>\nstream\n${stream}\nendstream`);
    objectEnd();

    objectStart(ids.page);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfPageWidth} ${pdfPageHeight}] /Resources << /XObject << /Im${index + 1} ${ids.image} 0 R >> >> >> /Contents ${ids.content} 0 R >>`);
    objectEnd();
  });

  const maxObjectId = pageImages.length ? Math.max(...pageImages.map((_, index) => pdfObjectIds(index).page)) : 2;
  const xrefOffset = byteOffset;
  push(`xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= maxObjectId; id += 1) {
    push(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const pdfBytes = concatBytes(chunks);
  return new Blob([pdfBytes.buffer], { type: "application/pdf" });
}

function worksheetXml(rows: Array<Array<string | number>>) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const ref = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
      if (typeof cell === "number" && Number.isFinite(cell)) return `<c r="${ref}"><v>${cell}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");

  return `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function safeSheetName(value: string, fallback: string, used: Set<string>) {
  const base = (value || fallback).replace(/[\][*?/\\:]/g, " ").trim().slice(0, 28) || fallback;
  let name = base;
  let index = 2;
  while (used.has(name)) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(name);
  return name;
}

export function buildXlsxBlob(dashboard: DashboardDraft, pages: DashboardPage[]) {
  const sortedPages = visiblePages(pages);
  const usedSheetNames = new Set<string>();
  const sheets: Array<{ name: string; rows: Array<Array<string | number>> }> = [
    {
      name: safeSheetName("Report", "Report", usedSheetNames),
      rows: [
        ["Report", dashboard.title],
        ["Status", dashboard.status],
        ["Version", dashboard.publishMetadata.versionLabel],
        ["Pages", sortedPages.length],
        ["Generated", new Date().toISOString()]
      ]
    }
  ];

  sortedPages.forEach((page) => {
    visibleTiles(page).forEach((tile) => {
      sheets.push({
        name: safeSheetName(`${page.order}-${tile.title || tile.name}`, `Tile ${sheets.length}`, usedSheetNames),
        rows: [
          ["Page", page.title],
          ["Tile", tile.title || tile.name],
          ["Visualization", tile.visualization],
          [],
          ["Row", ...tile.result.columns.map((column) => column.label), "Base"],
          ...tile.result.table.map((row) => [
            row.label,
            ...tile.result.columns.map((column) => row.values[column.id] ?? ""),
            Math.max(...Object.values(row.bases), 0)
          ])
        ]
      });
    });
  });

  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name || `Sheet ${index + 1}`)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files = [
    {
      path: "[Content_Types].xml",
      content: `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`
    },
    {
      path: "_rels/.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    },
    {
      path: "xl/workbook.xml",
      content: `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`
    }
  ];

  sheets.forEach((sheet, index) => {
    files.push({ path: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet.rows) });
  });

  return new Blob([buildZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function exportCoreDocument(dashboard: DashboardDraft, pages: DashboardPage[], target: CoreExportTarget): Promise<CoreExportResult> {
  const baseName = slugifyFileName(dashboard.title);
  const warnings: string[] = [];
  if (target === "json") {
    throw new Error("JSON package export is handled by the legacy package exporter.");
  }
  if (target === "pptx") {
    warnings.push("PPTX uses a hybrid export: simple text and shape elements are editable Office objects, while charts and complex content remain image-backed for visual fidelity.");
    downloadBlob(await buildPptxBlob(pages), `${baseName}-${dashboard.status}.pptx`);
    return { target, fileName: `${baseName}-${dashboard.status}.pptx`, warnings };
  }
  if (target === "pdf") {
    warnings.push("PDF is a visual-fidelity export generated from rendered report-page images.");
    downloadBlob(await buildPdfBlob(pages), `${baseName}-${dashboard.status}.pdf`);
    return { target, fileName: `${baseName}-${dashboard.status}.pdf`, warnings };
  }

  warnings.push("XLSX exports analytical result tables and report metadata; visual-only canvas objects are not represented as spreadsheet objects.");
  downloadBlob(buildXlsxBlob(dashboard, pages), `${baseName}-analysis-${dashboard.status}.xlsx`);
  return { target, fileName: `${baseName}-analysis-${dashboard.status}.xlsx`, warnings };
}
