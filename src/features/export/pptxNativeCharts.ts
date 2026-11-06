import { chartNeedsGradientFallback } from "./chartPaintExport";
import { chartColor } from "../design-system/reportColors";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import type { DashboardTile } from "../../../shared/types/dashboard";
import { analysisVisualLayout } from "./analysisVisualExport";
import { formatValue } from "../builder/components/CanvasRenderers";

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

function valueCache(values: Array<number | null>) {
  return `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((value, index) => value === null ? "" : `<c:pt idx="${index}"><c:v>${num(value)}</c:v></c:pt>`).join("")}</c:numLit>`;
}

function seriesXml(tile: DashboardTile, categories: string[]) {
  const columns = tile.result.columns;

  return columns.map((column, index) => {
    const values = tile.result.table.map((row) => analyticalCell(tile.result,row,column.id).value);
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${escapeXml(tile.appearance.axisLabelOverrides[column.id] ?? column.label)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${hexColor(chartColor(tile, "columns", column.id, index))}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>${tile.visualization === "vertical_bar" ? tile.result.table.map((row, rowIndex) => `<c:dPt><c:idx val="${rowIndex}"/><c:spPr><a:solidFill><a:srgbClr val="${hexColor(chartColor(tile, "rows", row.optionId, rowIndex))}"/></a:solidFill></c:spPr></c:dPt>`).join("") : ""}${nativeLabels(tile, column.id)}<c:cat>${categoryCache(categories)}</c:cat><c:val>${valueCache(values)}</c:val></c:ser>`;
  }).join("");
}

function nativeLabels(tile: DashboardTile, columnId: string) {
  if (!tile.appearance.showValueLabels) return "";
  return `<c:dLbls>${tile.result.table.map((row, index) => {
    const amount = analyticalCell(tile.result,row,columnId).value;
    if (amount === null) return "";
    const label = formatValue(amount, tile.result.metric.valueFormat, tile.result.metric.id,
      { percentDecimals: tile.appearance.labelPercentDecimals, percentRounding: tile.appearance.labelPercentRounding });
    const base = tile.appearance.showBases ? ` (${tile.result.weighting.applied ? "W" : "n"}=${row.bases[columnId]})` : "";
    return `<c:dLbl><c:idx val="${index}"/><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="${Math.max(100,Math.round(tile.appearance.labelFontSize * 75))}"><a:solidFill><a:srgbClr val="${hexColor(tile.appearance.labelColor)}"/></a:solidFill><a:latin typeface="Inter"/></a:rPr><a:t>${escapeXml(label + base)}</a:t></a:r></a:p></c:rich></c:tx><c:dLblPos val="${tile.visualization === "stacked_bar" ? "ctr" : "outEnd"}"/></c:dLbl>`;
  }).join("")}<c:showLegendKey val="0"/><c:showVal val="0"/></c:dLbls>`;
}

function chartTextProperties(size: number, color: string) {
  return `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${Math.max(100,Math.round(size * 75))}"><a:solidFill><a:srgbClr val="${hexColor(color)}"/></a:solidFill><a:latin typeface="Inter"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
}

function chartTitleXml(tile: DashboardTile) {
  const title = tile.title || tile.name;
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1400" b="1"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>`;
}

function chartXml(tile: DashboardTile) {
  const categories = tile.result.table.map((row) => tile.appearance.axisLabelOverrides[row.optionId] ?? row.label);
  const grouping = tile.visualization === "stacked_bar" ? "stacked" : "clustered";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:lang val="en-US"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${seriesXml(tile, categories)}<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls><c:gapWidth val="140"/><c:overlap val="${tile.visualization === "stacked_bar" ? "100" : "0"}"/><c:axId val="100001"/><c:axId val="100002"/></c:barChart><c:catAx><c:axId val="100001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${chartTextProperties(tile.appearance.axisFontSize,tile.appearance.xAxisTextColor)}<c:crossAx val="100002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="100002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>${tile.appearance.showGrid ? `<c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="${hexColor(tile.appearance.gridColor)}"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>` : ""}<c:numFmt formatCode="${tile.result.metric.valueFormat === "percent" ? "0&quot;%&quot;" : "General"}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${chartTextProperties(tile.appearance.axisFontSize,tile.appearance.yAxisTextColor)}<c:crossAx val="100001"/><c:crosses val="autoZero"/></c:valAx></c:plotArea>${tile.visualization === "vertical_bar" ? "" : `<c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/>${chartTextProperties(tile.appearance.axisFontSize,tile.appearance.labelColor)}</c:legend>`}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/></c:chart><c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings></c:chartSpace>`;
}

function graphicFrameXml(tile: DashboardTile, shapeId: number, relationshipId: string) {
  const { x, y, width, height } = analysisVisualLayout(tile).area;
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${shapeId}" name="${escapeXml(tile.title || tile.name)} native chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${toSlideX(x)}" y="${toSlideY(y)}"/><a:ext cx="${toSlideWidth(width)}" cy="${toSlideHeight(height)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relationshipId}"/></a:graphicData></a:graphic></p:graphicFrame>`;
}

export function canReconstructTileAsNativePptxChart(tile: DashboardTile) {
  if (tile.hidden || !supportedNativeChartTypes.has(tile.visualization) || chartNeedsGradientFallback(tile)) return false;
  return tile.result.table.some(row=>tile.result.columns.some(column=>analyticalCell(tile.result,row,column.id).status === "available"));
}

export function buildNativePptxChartDescriptor(tile: DashboardTile, chartId: number, shapeId: number, relationshipId: string): PptxNativeChartDescriptor {
  if (chartNeedsGradientFallback(tile)) throw new Error("Gradient charts require the complete visual PowerPoint fallback; no solid replacement was created.");
  return {
    chartId,
    tileId: tile.id,
    slideRelationshipId: relationshipId,
    chartPath: `ppt/charts/chart${chartId}.xml`,
    chartXml: chartXml(tile),
    graphicFrameXml: graphicFrameXml(tile, shapeId, relationshipId)
  };
}
