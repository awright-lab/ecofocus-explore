import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import type { DashboardCanvasElement, DashboardPage } from "../../../shared/types/dashboard";

export interface PptxEditableSlideReconstruction {
  editableXml: string;
  reconstructedCount: number;
  fallbackCount: number;
}

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

function hexColor(value: string, fallback = "FFFFFF") {
  const normalized = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) return normalized.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) return normalized.split("").map((part) => part + part).join("").toUpperCase();
  return fallback;
}

function toSlideX(value: number) {
  return Math.round((value / canvasWidth) * slideCx);
}

function toSlideY(value: number) {
  return Math.round((value / canvasHeight) * slideCy);
}

function toSlideWidth(value: number) {
  return Math.round((value / canvasWidth) * slideCx);
}

function toSlideHeight(value: number) {
  return Math.round((value / canvasHeight) * slideCy);
}

function pptTextAlign(align: DashboardCanvasElement["style"]["textAlign"]) {
  if (align === "center") return "ctr";
  if (align === "right") return "r";
  return "l";
}

function fillXml(element: DashboardCanvasElement) {
  if (element.style.fill === "transparent" || element.style.opacity <= 0) return "<a:noFill/>";
  return `<a:solidFill><a:srgbClr val="${hexColor(element.style.fill)}"/></a:solidFill>`;
}

function lineXml(element: DashboardCanvasElement) {
  if (element.style.borderStyle === "none" || element.style.borderWidth <= 0) return "<a:ln><a:noFill/></a:ln>";
  const dash = element.style.borderStyle === "dashed" ? "<a:prstDash val=\"dash\"/>" : element.style.borderStyle === "dotted" ? "<a:prstDash val=\"dot\"/>" : "";
  return `<a:ln w="${Math.max(1, Math.round(element.style.borderWidth * 12700))}"><a:solidFill><a:srgbClr val="${hexColor(element.style.borderColor, "D9E2EA")}"/></a:solidFill>${dash}</a:ln>`;
}

function textBodyXml(element: DashboardCanvasElement) {
  if (!element.content.trim()) return "";
  const fontSize = Math.max(700, Math.round(element.style.fontSize * 75));
  const isBold = Number(element.style.fontWeight) >= 600 || element.style.fontWeight === "bold";
  const italic = element.style.fontStyle === "italic" ? " i=\"1\"" : "";
  const underline = element.style.textDecoration === "underline" ? " u=\"sng\"" : "";
  const lines = element.content.split("\n").map((line) => line.trim()).filter(Boolean);
  const paragraphs = (lines.length ? lines : [element.content]).map((line) => (
    `<a:p><a:pPr algn="${pptTextAlign(element.style.textAlign)}"/><a:r><a:rPr lang="en-US" sz="${fontSize}" b="${isBold ? 1 : 0}"${italic}${underline}><a:solidFill><a:srgbClr val="${hexColor(element.style.textColor, "162033")}"/></a:solidFill><a:latin typeface="${escapeXml(element.style.fontFamily || "Inter")}"/></a:rPr><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
  )).join("");
  return `<p:txBody><a:bodyPr wrap="square" lIns="${Math.round(element.style.padding * 9000)}" tIns="${Math.round(element.style.padding * 9000)}" rIns="${Math.round(element.style.padding * 9000)}" bIns="${Math.round(element.style.padding * 9000)}"/><a:lstStyle/>${paragraphs}</p:txBody>`;
}

export function canReconstructElementInPptx(element: DashboardCanvasElement) {
  if (element.hidden) return false;
  return element.type === "text" || element.type === "rectangle" || element.type === "circle";
}

function editableElementXml(element: DashboardCanvasElement, shapeId: number) {
  const { x, y, width, height } = element.layout;
  const preset = element.type === "circle" ? "ellipse" : "rect";
  const textBox = element.type === "text" ? " txBox=\"1\"" : "";
  const noTextBody = element.content.trim() ? textBodyXml(element) : "";

  return `<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="${escapeXml(element.name || element.type)}"/><p:cNvSpPr${textBox}/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${toSlideX(x)}" y="${toSlideY(y)}"/><a:ext cx="${toSlideWidth(width)}" cy="${toSlideHeight(height)}"/></a:xfrm><a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>${fillXml(element)}${lineXml(element)}</p:spPr>${noTextBody}</p:sp>`;
}

export function buildEditableSlideReconstruction(page: DashboardPage, firstShapeId: number): PptxEditableSlideReconstruction {
  const editableElements = page.elements
    .filter(canReconstructElementInPptx)
    .sort((a, b) => a.layout.zIndex - b.layout.zIndex);
  const fallbackElements = page.elements.filter((element) => !element.hidden && !canReconstructElementInPptx(element));
  const editableXml = editableElements.map((element, index) => editableElementXml(element, firstShapeId + index)).join("");

  return {
    editableXml,
    reconstructedCount: editableElements.length,
    fallbackCount: fallbackElements.length + page.tiles.filter((tile) => !tile.hidden).length
  };
}
