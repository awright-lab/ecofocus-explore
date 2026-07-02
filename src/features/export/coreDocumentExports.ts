import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import { pageSummary, slugifyFileName } from "../builder/components/CanvasRenderers";
import { buildZip } from "./zip";
import type { DashboardDraft, DashboardPage, DashboardTile } from "../../../shared/types/dashboard";

export type CoreExportTarget = "pptx" | "pdf" | "xlsx" | "json";

export interface CoreExportResult {
  target: CoreExportTarget;
  fileName: string;
  warnings: string[];
}

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const slideCx = 12192000;
const slideCy = 7239000;

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapePdf(value: unknown) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function visiblePages(pages: DashboardPage[]) {
  return [...pages].sort((a, b) => a.order - b.order);
}

function visibleTiles(page: DashboardPage) {
  return page.tiles.filter((tile) => !tile.hidden).sort((a, b) => a.layout.zIndex - b.layout.zIndex);
}

function visibleElements(page: DashboardPage) {
  return page.elements.filter((element) => !element.hidden).sort((a, b) => a.layout.zIndex - b.layout.zIndex);
}

function formatCell(value: number | string | undefined) {
  if (typeof value === "number") return Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return value ?? "";
}

function pageSummaryText(page: DashboardPage) {
  const summary = pageSummary(page);
  const topicLabel = summary.primaryTopics.length ? ` Topics: ${summary.primaryTopics.join(", ")}.` : "";
  return `${summary.tileCount} tile${summary.tileCount === 1 ? "" : "s"}, ${summary.elementCount} element${summary.elementCount === 1 ? "" : "s"}, ${summary.chartCount} chart${summary.chartCount === 1 ? "" : "s"}, ${summary.tableCount} table${summary.tableCount === 1 ? "" : "s"}.${topicLabel}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function shapeText(id: number, label: string, x: number, y: number, width: number, height: number, size = 1600) {
  const tx = Math.round((x / canvasWidth) * slideCx);
  const ty = Math.round((y / canvasHeight) * slideCy);
  const cx = Math.round((width / canvasWidth) * slideCx);
  const cy = Math.round((height / canvasHeight) * slideCy);
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(label).slice(0, 40)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${tx}" y="${ty}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="${size}"/><a:t>${escapeXml(label)}</a:t></a:r></a:p></p:txBody></p:sp>`;
}

function tileSummary(tile: DashboardTile) {
  const rows = tile.result.table.slice(0, 4).map((row) => {
    const values = tile.result.columns.slice(0, 3).map((column) => {
      const cell = row.values[column.id];
      return `${column.label}: ${formatCell(cell) || "n/a"}`;
    });
    return `${row.label} - ${values.join(", ")}`;
  });
  return `${tile.title || tile.name} (${tile.visualization})\n${rows.join("\n")}`;
}

function slideXml(page: DashboardPage, index: number) {
  const shapes: string[] = [
    shapeText(2, page.title, 54, 34, 520, 48, 2400),
    shapeText(3, pageSummaryText(page), 56, 82, 660, 34, 1200)
  ];
  let shapeId = 4;
  visibleElements(page).forEach((element) => {
    if (element.type === "text" && element.content.trim()) {
      shapes.push(shapeText(shapeId, element.content, element.layout.x, element.layout.y, element.layout.width, element.layout.height, Math.max(900, element.style.fontSize * 100)));
      shapeId += 1;
    }
  });
  visibleTiles(page).forEach((tile) => {
    shapes.push(shapeText(shapeId, tileSummary(tile), tile.layout.x, tile.layout.y, tile.layout.width, tile.layout.height, 1050));
    shapeId += 1;
  });

  return `${xmlHeader}<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name="Slide ${index}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export function buildPptxBlob(dashboard: DashboardDraft, pages: DashboardPage[]) {
  const sortedPages = visiblePages(pages);
  const slideIds = sortedPages.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("");
  const rels = sortedPages.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  const overrides = sortedPages.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const files = [
    {
      path: "[Content_Types].xml",
      content: `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${overrides}</Types>`
    },
    {
      path: "_rels/.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`
    },
    {
      path: "ppt/presentation.xml",
      content: `${xmlHeader}<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${sortedPages.length + 1}"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${slideCx}" cy="${slideCy}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`
    },
    {
      path: "ppt/_rels/presentation.xml.rels",
      content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sortedPages.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`
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

  sortedPages.forEach((page, index) => {
    files.push({ path: `ppt/slides/slide${index + 1}.xml`, content: slideXml(page, index + 1) });
  });

  return new Blob([buildZip(files)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function buildPdfPageContent(page: DashboardPage) {
  const lines = [page.title, pageSummaryText(page), ""];
  visibleElements(page).forEach((element) => {
    if (element.type === "text" && element.content.trim()) lines.push(element.content.trim());
  });
  visibleTiles(page).forEach((tile) => {
    lines.push(tile.title || tile.name);
    tile.result.table.slice(0, 6).forEach((row) => {
      lines.push(`${row.label}: ${tile.result.columns.slice(0, 4).map((column) => formatCell(row.values[column.id])).join(" | ")}`);
    });
    lines.push("");
  });

  return lines.slice(0, 32);
}

export function buildPdfBlob(dashboard: DashboardDraft, pages: DashboardPage[]) {
  const sortedPages = visiblePages(pages);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  const pageObjectIds: number[] = [];

  sortedPages.forEach((page) => {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageObjectIds.push(pageId);
    const contentLines = buildPdfPageContent(page);
    const stream = [
      "BT",
      "/F1 24 Tf",
      "54 520 Td",
      `(${escapePdf(dashboard.title)}) Tj`,
      "/F1 15 Tf",
      "0 -34 Td",
      ...contentLines.flatMap((line, index) => [
        index === 0 ? "/F1 18 Tf" : "/F1 10 Tf",
        `(${escapePdf(line).slice(0, 112)}) Tj`,
        "0 -17 Td"
      ]),
      "ET"
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 720 540] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;
  const pdfObjects = objects.map((object, index) => `${index + 1} 0 obj\n${object}\nendobj\n`);
  let offset = "%PDF-1.4\n".length;
  const xrefs = ["0000000000 65535 f "];
  pdfObjects.forEach((object) => {
    xrefs.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += object.length;
  });
  const body = pdfObjects.join("");
  const xrefOffset = "%PDF-1.4\n".length + body.length;
  const trailer = `xref\n0 ${objects.length + 1}\n${xrefs.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([`%PDF-1.4\n${body}${trailer}`], { type: "application/pdf" });
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

export function exportCoreDocument(dashboard: DashboardDraft, pages: DashboardPage[], target: CoreExportTarget): CoreExportResult {
  const baseName = slugifyFileName(dashboard.title);
  const warnings: string[] = [];
  if (target === "json") {
    throw new Error("JSON package export is handled by the legacy package exporter.");
  }
  if (target === "pptx") {
    warnings.push("PPTX uses editable text summaries for analytical tiles; charts are not yet reconstructed as native PowerPoint charts.");
    downloadBlob(buildPptxBlob(dashboard, pages), `${baseName}-${dashboard.status}.pptx`);
    return { target, fileName: `${baseName}-${dashboard.status}.pptx`, warnings };
  }
  if (target === "pdf") {
    warnings.push("PDF preserves page sequence and report content as a simplified slide document; exact canvas rendering is a later export refinement.");
    downloadBlob(buildPdfBlob(dashboard, pages), `${baseName}-${dashboard.status}.pdf`);
    return { target, fileName: `${baseName}-${dashboard.status}.pdf`, warnings };
  }

  warnings.push("XLSX exports analytical result tables and report metadata; visual-only canvas objects are not represented as spreadsheet objects.");
  downloadBlob(buildXlsxBlob(dashboard, pages), `${baseName}-analysis-${dashboard.status}.xlsx`);
  return { target, fileName: `${baseName}-analysis-${dashboard.status}.xlsx`, warnings };
}
