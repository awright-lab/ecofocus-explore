import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import type { DashboardTile } from "../../../shared/types/dashboard";

export interface PptxNativeChartDescriptor {
  chartId: number;
  tileId: string;
  slideRelationshipId: string;
  chartPath: string;
  chartXml: string;
  graphicFrameXml: string;
}

const slideCx = 12192000;
const slideCy = 7239000;
const supportedNativeChartTypes = new Set(["vertical_bar", "grouped_bar", "stacked_bar"]);

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hexColor(value: string, fallback = "008B89") {
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

function num(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : "0";
}

function categoryCache(categories: string[]) {
  return `<c:strLit><c:ptCount val="${categories.length}"/>${categories.map((category, index) => `<c:pt idx="${index}"><c:v>${escapeXml(category)}</c:v></c:pt>`).join("")}</c:strLit>`;
}

function valueCache(values: number[]) {
  return `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${num(value)}</c:v></c:pt>`).join("")}</c:numLit>`;
}

function seriesXml(tile: DashboardTile, categories: string[]) {
  const columns = tile.visualization === "vertical_bar"
    ? tile.result.columns.slice(0, 1)
    : tile.result.columns.slice(0, 8);
  const palette = tile.appearance.palette.length ? tile.appearance.palette : [tile.appearance.primaryColor, "#4F7FE8", "#6557C8", "#FF6B60"];

  return columns.map((column, index) => {
    const values = tile.result.table.map((row) => row.values[column.id] ?? 0);
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${escapeXml(column.label)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${hexColor(palette[index % palette.length])}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:cat>${categoryCache(categories)}</c:cat><c:val>${valueCache(values)}</c:val></c:ser>`;
  }).join("");
}

function chartTitleXml(tile: DashboardTile) {
  const title = tile.title || tile.name;
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1400" b="1"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>`;
}

function chartXml(tile: DashboardTile) {
  const categories = tile.result.table.map((row) => row.label);
  const grouping = tile.visualization === "stacked_bar" ? "stacked" : "clustered";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:lang val="en-US"/><c:chart>${chartTitleXml(tile)}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${seriesXml(tile, categories)}<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:gapWidth val="140"/><c:overlap val="${tile.visualization === "stacked_bar" ? "100" : "0"}"/><c:axId val="100001"/><c:axId val="100002"/></c:barChart><c:catAx><c:axId val="100001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="100002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="100002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="100001"/><c:crosses val="autoZero"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function graphicFrameXml(tile: DashboardTile, shapeId: number, relationshipId: string) {
  const { x, y, width, height } = tile.layout;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${shapeId}" name="${escapeXml(tile.title || tile.name)} native chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${toSlideX(x)}" y="${toSlideY(y)}"/><a:ext cx="${toSlideWidth(width)}" cy="${toSlideHeight(height)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relationshipId}"/></a:graphicData></a:graphic></p:graphicFrame>`;
}

export function canReconstructTileAsNativePptxChart(tile: DashboardTile) {
  if (tile.hidden || !supportedNativeChartTypes.has(tile.visualization)) return false;
  return tile.result.table.length > 0 && tile.result.columns.length > 0;
}

export function buildNativePptxChartDescriptor(tile: DashboardTile, chartId: number, shapeId: number, relationshipId: string): PptxNativeChartDescriptor {
  return {
    chartId,
    tileId: tile.id,
    slideRelationshipId: relationshipId,
    chartPath: `ppt/charts/chart${chartId}.xml`,
    chartXml: chartXml(tile),
    graphicFrameXml: graphicFrameXml(tile, shapeId, relationshipId)
  };
}
