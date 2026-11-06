import { barPaintSvg } from "./chartPaintExport";
import { chartColor } from "../design-system/reportColors";
import { analyticalCell } from "../../../shared/analytics/resultCells";
import type { DashboardTile } from "../../../shared/types/dashboard";
import { formatValue, supportsDonutResult } from "../builder/components/CanvasRenderers";
import { importedMeasureBasesNeedRefresh } from "../data/importedDatasetAnalytics";
import { analysisContextRows } from "./exportIntegrity";

export function xmlText(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r/g, "&#13;");
}

export function completeLines(text: string, chars: number, maximum: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const chunks = Array.from(word);
      while (chunks.length > chars) {
        if (current) { lines.push(current); current = ""; }
        lines.push(chunks.splice(0, chars).join(""));
      }
      const part = chunks.join("");
      if (current && current.length + part.length + 1 > chars) { lines.push(current); current = ""; }
      current = current ? `${current} ${part}` : part;
    }
    lines.push(current);
  }
  if (lines.length > maximum) throw new Error("Export text cannot fit without truncation. Enlarge the object or use Excel/JSON.");
  return lines;
}

function text(value: string, x: number, y: number, size = 10, anchor = "start", color = "#243343") {
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" text-anchor="${anchor}" fill="${xmlText(color)}">${xmlText(value)}</text>`;
}
function label(tile: DashboardTile, id: string, source: string) { return tile.appearance.axisLabelOverrides[id] ?? source; }
function value(tile: DashboardTile, amount: number | null) {
  return formatValue(amount, tile.result.metric.valueFormat, tile.result.metric.id, { percentDecimals: tile.appearance.labelPercentDecimals, percentRounding: tile.appearance.labelPercentRounding });
}
function base(tile: DashboardTile, amount: number) { return `${tile.result.weighting.applied ? "W" : tile.result.query.weight ? "base (weight unconfirmed)" : "n"}=${amount}`; }

function color(tile: DashboardTile, id: string, index: number, role: "rows" | "columns" = "columns") { return chartColor(tile, role, id, index); }

export function analysisVisualLayout(tile: DashboardTile) {
  const { x, y, width, height } = tile.layout;
  const titleSize = tile.appearance.titleFontSize;
  const titleX = tile.appearance.titleX, titleY = tile.appearance.titleY, titleWidth = Math.min(tile.appearance.titleWidth, width - titleX - 18);
  if (![titleSize,titleX,titleY,titleWidth].every(Number.isFinite) || titleSize <= 0 || titleX < 0 || titleY < 0 || titleWidth <= 0) throw new Error("The chart title has invalid placement or type size. Review its styling before exporting.");
  const title = completeLines(tile.title || tile.name, Math.max(1, Math.floor(titleWidth / (titleSize * 0.62))), 3);
  const titleBottom = titleY + title.length * titleSize * 1.24;
  const rows = new Map(analysisContextRows(tile));
  const context = [
    `Dataset: ${rows.get("Dataset")}; Field: ${rows.get("Question or grouping")}`,
    `Metric: ${rows.get("Metric")}; Number: ${rows.get("Numeric measure")}; Breakout: ${rows.get("Breakout")}`,
    `Filter: ${rows.get("Filter")}`,
    `Weight: ${rows.get("Weighting")}; ${rows.get("Base scope")}`,
    `Inference: ${rows.get("Inference")}`,
    `Rendering: reconstructed analytical view${tile.visualization === "line_chart" ? "; straight line segments" : ""}`,
    ...(rows.get("Result warnings") ? [`Warnings: ${rows.get("Result warnings")}`] : [])
  ].flatMap(line => completeLines(line, Math.max(12, Math.floor((width - 40) / 5.8)), 12));
  const contextTop = titleBottom + 10;
  const top = contextTop + context.length * 11 + 12;
  const area = { x: x + 22, y: y + top, width: width - 44, height: height - top - 18 };
  if (area.width < 120 || area.height < 90) throw new Error(`"${tile.title}" is too small to export all analysis context. Enlarge it or use Excel/JSON.`);
  return { title, context, area, titleSize, titleX, titleY, titleWidth, contextTop };
}

function check(tile: DashboardTile) {
  if (importedMeasureBasesNeedRefresh(tile.result)) throw new Error(`Refresh "${tile.title}" before exporting its numeric sample bases.`);
  for (const row of tile.result.table) for (const column of tile.result.columns) {
    if (["invalid", "rerun_required"].includes(analyticalCell(tile.result,row,column.id).status) || !Number.isFinite(row.bases[column.id]) || row.bases[column.id] < 0) throw new Error(`"${tile.title}" has missing or invalid export values/bases.`);
  }
  if (!tile.result.table.length || !tile.result.columns.length) throw new Error(`"${tile.title}" has no analytical cells to export.`);
}

function table(tile: DashboardTile) {
  const { area } = analysisVisualLayout(tile), columns = tile.result.columns, rows = tile.result.table;
  const first = area.width * 0.29, cell = (area.width - first) / columns.length;
  if (cell < 70) throw new Error(`"${tile.title}" has too many columns for a readable table. Enlarge it or use Excel/JSON.`);
  const headers = columns.map(column => completeLines(label(tile, column.id, column.label), Math.max(4, Math.floor(cell / 6)), 3));
  const headerHeight = Math.max(...headers.map(lines => lines.length), 1) * 12 + 12;
  const rowHeight = Math.min(32, (area.height - headerHeight) / rows.length);
  if (rowHeight < 24) throw new Error(`"${tile.title}" has too many rows for this page. Enlarge it or use Excel/JSON; no rows were omitted.`);
  let svg = `<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${headerHeight}" fill="#edf2f5"/>${text("Response", area.x + 6, area.y + 16)}`;
  headers.forEach((lines, index) => lines.forEach((line, n) => { svg += text(line, area.x + first + index * cell + 6, area.y + 14 + n * 12); }));
  rows.forEach((row, rowIndex) => {
    const y = area.y + headerHeight + rowIndex * rowHeight;
    const lines = completeLines(label(tile, row.optionId, row.label), Math.max(4, Math.floor(first / 6)), Math.floor(rowHeight / 12));
    svg += `<g data-row="${xmlText(row.optionId)}"><rect x="${area.x}" y="${y}" width="${area.width}" height="${rowHeight}" fill="${rowIndex % 2 ? "#fff" : "#f6f9fb"}" stroke="#dce3e9"/>`;
    lines.forEach((line, n) => { svg += text(line, area.x + 6, y + 12 + n * 12); });
    columns.forEach((column, index) => {
      const formatted = value(tile, analyticalCell(tile.result,row,column.id).value), sample = base(tile, row.bases[column.id]);
      if (Math.max(formatted.length, sample.length) * Math.max(6,tile.appearance.labelFontSize * 0.62) > cell - 10) throw new Error("An export cell label cannot fit. Enlarge the table or use Excel/JSON.");
      svg += `<g data-row="${xmlText(row.optionId)}" data-column="${xmlText(column.id)}" data-value="${analyticalCell(tile.result,row,column.id).value ?? ""}" data-base="${row.bases[column.id]}">${text(formatted, area.x + first + index * cell + 6, y + 11)}${text(sample, area.x + first + index * cell + 6, y + 22, 8)}</g>`;
    });
    svg += "</g>";
  });
  return svg;
}

function legend(tile: DashboardTile, area: ReturnType<typeof analysisVisualLayout>["area"]) {
  const width = Math.max(50, ...tile.result.columns.map(column => label(tile, column.id, column.label).length * 6 + 20));
  const perRow = Math.max(1, Math.floor(area.width / width));
  if (width > area.width) throw new Error("A complete legend label cannot fit. Enlarge the chart or shorten its display alias.");
  return { height: Math.ceil(tile.result.columns.length / perRow) * 15,
    svg: tile.result.columns.map((column, index) => `<rect x="${area.x + index % perRow * width}" y="${area.y + Math.floor(index / perRow) * 15}" width="8" height="8" fill="${xmlText(tile.visualization === "line_chart" ? color(tile,column.id,index) : barPaintSvg(tile,"columns",column.id,index).fill)}"/>${text(label(tile, column.id, column.label), area.x + index % perRow * width + 12, area.y + Math.floor(index / perRow) * 15 + 8, tile.appearance.axisFontSize, "start", tile.appearance.labelColor)}`).join("") };
}

function numericExtent(amounts: number[]) {
  const low = Math.min(0, ...amounts);
  const maximum = Math.max(0, ...amounts);
  const high = low === maximum ? 1 : maximum;
  if (!Number.isFinite(low) || !Number.isFinite(high) || !Number.isFinite(high - low) || high <= low) {
    throw new Error("This chart's numeric range cannot be rendered safely. Rescale the source values before exporting.");
  }
  return { low, high };
}

function bars(tile: DashboardTile) {
  const { area } = analysisVisualLayout(tile), rows = tile.result.table, columns = tile.result.columns;
  const horizontal = tile.visualization === "horizontal_bar", stacked = tile.visualization === "stacked_bar";
  if ((horizontal || tile.visualization === "vertical_bar") && columns.length !== 1) throw new Error("Use grouped or stacked bars to export multiple columns; no series were omitted.");
  const key = horizontal || tile.visualization === "vertical_bar" ? { height: 0, svg: "" } : legend(tile, area);
  const plot = { x: area.x + (horizontal ? area.width * 0.25 : 45), y: area.y + key.height + 25,
    width: horizontal ? area.width * 0.75 - 85 : area.width - 55, height: area.height - key.height - 85 };
  if (plot.height < 55) throw new Error("Chart/legend cannot fit completely. Enlarge the object or use Excel/JSON.");
  const extents = stacked ? rows.flatMap(row => [columns.reduce((sum, column) => sum + Math.max(0, analyticalCell(tile.result,row,column.id).value ?? 0), 0), columns.reduce((sum, column) => sum + Math.min(0, analyticalCell(tile.result,row,column.id).value ?? 0), 0)]) : rows.flatMap(row => columns.map(column => analyticalCell(tile.result,row,column.id).value).filter((amount): amount is number => amount !== null));
  const { low, high } = numericExtent(extents), span = high - low;
  const coordinate = (amount: number) => horizontal ? plot.x + (amount - low) / span * plot.width : plot.y + (high - amount) / span * plot.height;
  const slot = (horizontal ? plot.height : plot.width) / rows.length;
  const barWidth = slot * 0.82 / (stacked ? 1 : columns.length);
  if (horizontal && slot < (tile.appearance.showBases && tile.appearance.showValueLabels ? 30 : 18)) throw new Error("All horizontal labels cannot fit. Enlarge the chart or turn off labels.");
  if (barWidth < (horizontal ? 14 : 10)) throw new Error("All bars cannot fit readably. Enlarge the chart or use a table/Excel/JSON.");
  let svg = key.svg + (horizontal ? `<line x1="${coordinate(0)}" x2="${coordinate(0)}" y1="${plot.y}" y2="${plot.y + plot.height}" stroke="${xmlText(tile.appearance.gridColor)}"/>` : `<line x1="${plot.x}" x2="${plot.x + plot.width}" y1="${coordinate(0)}" y2="${coordinate(0)}" stroke="${xmlText(tile.appearance.gridColor)}"/>`);
  svg += horizontal
    ? text(value(tile, low), plot.x, plot.y + plot.height + 17, tile.appearance.axisFontSize, "start", tile.appearance.xAxisTextColor) + text(value(tile, high), plot.x + plot.width, plot.y + plot.height + 17, tile.appearance.axisFontSize, "end", tile.appearance.xAxisTextColor)
    : text(value(tile, high), plot.x - 7, plot.y + 4, tile.appearance.axisFontSize, "end", tile.appearance.yAxisTextColor) + text(value(tile, low), plot.x - 7, plot.y + plot.height + 3, tile.appearance.axisFontSize, "end", tile.appearance.yAxisTextColor);
  rows.forEach((row, rowIndex) => {
    let positive = 0, negative = 0;
    const names = completeLines(label(tile, row.optionId, row.label), Math.max(4, Math.floor((horizontal ? area.width * 0.25 - 8 : slot) / 6)), horizontal ? Math.floor(slot / 11) : 3);
    names.forEach((name, n) => { svg += horizontal ? text(name, area.x, plot.y + rowIndex * slot + 11 + n * 11, tile.appearance.axisFontSize, "start", tile.appearance.yAxisTextColor) : text(name, plot.x + (rowIndex + 0.5) * slot, plot.y + plot.height + 32 + n * 11, tile.appearance.axisFontSize, "middle", tile.appearance.xAxisTextColor); });
    columns.forEach((column, columnIndex) => {
      const amount = analyticalCell(tile.result,row,column.id).value;
      if (amount === null) return;
      const paint = horizontal || tile.visualization === "vertical_bar" ? barPaintSvg(tile,"rows",row.optionId,rowIndex) : barPaintSvg(tile,"columns",column.id,columnIndex);
      const start = stacked ? amount >= 0 ? positive : negative : 0, end = start + amount;
      if (stacked) { if (amount >= 0) positive = end; else negative = end; }
      const a = coordinate(start), b = coordinate(end), position = (horizontal ? plot.y : plot.x) + rowIndex * slot + slot * 0.09 + (stacked ? 0 : columnIndex * barWidth);
      svg += `<g data-row="${xmlText(row.optionId)}" data-column="${xmlText(column.id)}" data-value="${amount}" data-base="${row.bases[column.id]}"><rect x="${horizontal ? Math.min(a, b) : position}" y="${horizontal ? position : Math.min(a, b)}" width="${horizontal ? Math.abs(b - a) : barWidth - 2}" height="${horizontal ? barWidth - 2 : Math.abs(b - a)}" fill="${xmlText(paint.fill)}"/>`;
      if (tile.appearance.showValueLabels) {
        if (stacked && amount !== 0 && Math.abs(b - a) < Math.max(24,tile.appearance.labelFontSize * (tile.appearance.showBases ? 2.4 : 1.4))) throw new Error("Stacked value/base labels cannot fit. Enlarge the chart or turn off value labels; no values were omitted.");
        if (!horizontal && Math.max(value(tile, amount).length, tile.appearance.showBases ? base(tile, row.bases[column.id]).length : 0) * Math.max(5.8,tile.appearance.labelFontSize * 0.62) > barWidth) throw new Error("All value/base labels cannot fit across the bars. Enlarge the chart or turn off value labels.");
        const x = horizontal ? plot.x + plot.width + 8 : position + barWidth / 2;
        const y = horizontal ? position + barWidth / 2 : stacked ? (a + b) / 2 : amount >= 0 ? b - 15 : b + 12;
        const anchor = horizontal ? "start" : "middle";
        svg += text(value(tile, amount), x, y, tile.appearance.labelFontSize, anchor, tile.appearance.labelColor);
        if (tile.appearance.showBases) svg += text(base(tile, row.bases[column.id]), x, y + 10, Math.max(8,tile.appearance.labelFontSize - 1), anchor, tile.appearance.labelColor);
      }
      svg += "</g>";
    });
  });
  return svg;
}

function lines(tile: DashboardTile) {
  const { area } = analysisVisualLayout(tile), key = legend(tile, area), rows = tile.result.table, columns = tile.result.columns;
  const top = area.y + key.height + 30, height = area.height - key.height - 75, slot = (area.width - 100) / Math.max(1, rows.length - 1);
  if (height < 55 || slot < 32) throw new Error("All line points/labels cannot fit. Enlarge the chart or use a table/Excel/JSON.");
  const amounts = rows.flatMap(row => columns.map(column => analyticalCell(tile.result,row,column.id).value).filter((amount): amount is number => amount !== null)), { low, high } = numericExtent(amounts);
  const x = (index: number) => area.x + 50 + index * slot, y = (amount: number) => top + (high - amount) / (high - low) * height;
  if (tile.appearance.showValueLabels && (columns.length > 1 || slot < 70)) throw new Error("Line value labels need more space. Enlarge the chart or turn off value labels; no points were omitted.");
  let svg = key.svg + `<line x1="${x(0)}" x2="${x(0)}" y1="${top}" y2="${top + height}" stroke="${xmlText(tile.appearance.gridColor)}"/>` + text(value(tile, high), x(0) - 7, top + 4, tile.appearance.axisFontSize, "end", tile.appearance.yAxisTextColor) + text(value(tile, low), x(0) - 7, top + height + 3, tile.appearance.axisFontSize, "end", tile.appearance.yAxisTextColor);
  columns.forEach((column, index) => {
    let run: string[] = [];
    const flush = () => { if (run.length > 1) svg += `<polyline data-series="${xmlText(column.id)}" points="${run.join(" ")}" fill="none" stroke="${xmlText(color(tile,column.id,index))}" stroke-width="2"/>`; run = []; };
    rows.forEach((row,n) => {
      const amount = analyticalCell(tile.result,row,column.id).value;
      if (amount === null) { flush(); return; }
      run.push(`${x(n)},${y(amount)}`);
      svg += `<circle data-row="${xmlText(row.optionId)}" data-column="${xmlText(column.id)}" data-value="${amount}" data-base="${row.bases[column.id]}" cx="${x(n)}" cy="${y(amount)}" r="3" fill="${xmlText(color(tile,column.id,index))}"/>`;
      if (tile.appearance.showValueLabels) { svg += text(value(tile,amount),x(n),y(amount)-18,tile.appearance.labelFontSize,"middle",tile.appearance.labelColor); if(tile.appearance.showBases) svg += text(base(tile,row.bases[column.id]),x(n),y(amount)-8,Math.max(8,tile.appearance.labelFontSize-1),"middle",tile.appearance.labelColor); }
    });
    flush();
  });
  rows.forEach((row, n) => completeLines(label(tile, row.optionId, row.label), Math.max(4, Math.floor(Math.min(slot, 80) / 6)), 3).forEach((name, line) => { svg += text(name, x(n), top + height + 15 + line * 11, tile.appearance.axisFontSize, "middle", tile.appearance.xAxisTextColor); }));
  return svg;
}

function donut(tile: DashboardTile) {
  if (!supportsDonutResult(tile.result)) throw new Error("Donut export requires a complete, mutually exclusive whole. Use a bar chart or table.");
  const { area } = analysisVisualLayout(tile), rows = tile.result.table, column = tile.result.columns[0], total = rows.reduce((sum, row) => sum + row.values[column.id], 0);
  const rowHeight = area.height / rows.length;
  if (rowHeight < 24) throw new Error("All donut legend values/bases cannot fit. Enlarge it or use Excel/JSON.");
  const cx = area.x + area.width * 0.22, cy = area.y + area.height / 2, radius = Math.min(area.width * 0.20, area.height * 0.44);
  let angle = -Math.PI / 2, svg = "";
  rows.forEach((row, index) => {
    const amount = row.values[column.id], next = angle + amount / total * 2 * Math.PI;
    if (amount > 0) svg += amount / total >= 0.999999 ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${xmlText(color(tile, row.optionId, index, "rows"))}"/>` : `<path data-row="${xmlText(row.optionId)}" data-value="${amount}" d="M ${cx} ${cy} L ${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)} A ${radius} ${radius} 0 ${next - angle > Math.PI ? 1 : 0} 1 ${cx + radius * Math.cos(next)} ${cy + radius * Math.sin(next)} Z" fill="${xmlText(color(tile, row.optionId, index, "rows"))}"/>`;
    angle = next;
    const names = completeLines(label(tile, row.optionId, row.label), Math.max(4, Math.floor((area.width * 0.52 - 80) / 6)), Math.floor((rowHeight - 10) / 11));
    svg += `<rect x="${area.x + area.width * 0.46}" y="${area.y + index * rowHeight + 5}" width="8" height="8" fill="${xmlText(color(tile, row.optionId, index, "rows"))}"/>`;
    names.forEach((name, line) => { svg += text(name, area.x + area.width * 0.46 + 14, area.y + index * rowHeight + 13 + line * 11, 10); });
    if (tile.appearance.showValueLabels) svg += text(value(tile, amount), area.x + area.width, area.y + index * rowHeight + 13, 10, "end");
    if (tile.appearance.showBases) svg += text(base(tile, row.bases[column.id]), area.x + area.width, area.y + index * rowHeight + 24, 8, "end");
  });
  return svg + `<circle cx="${cx}" cy="${cy}" r="${radius * 0.67}" fill="${xmlText(tile.appearance.chartBackground || "#fff")}"/>`;
}

export function analysisTileSvg(tile: DashboardTile, includeBody = true) {
  check(tile);
  const layout = analysisVisualLayout(tile), { x, y, width, height } = tile.layout;
  let svg = `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${tile.appearance.borderRadius || 0}" fill="${xmlText(tile.appearance.background || "#fff")}" stroke="${xmlText(tile.appearance.borderColor || "#dce3e9")}"/>`;
  const titleAnchor = tile.appearance.titleTextAlign === "center" ? "middle" : tile.appearance.titleTextAlign === "right" ? "end" : "start";
  const titleOffset = titleAnchor === "middle" ? layout.titleWidth / 2 : titleAnchor === "end" ? layout.titleWidth : 0;
  layout.title.forEach((line,n) => { svg += text(line,x + layout.titleX + titleOffset,y + layout.titleY + layout.titleSize + n * layout.titleSize * 1.24,layout.titleSize,titleAnchor,"#38513b"); });
  layout.context.forEach((line,n) => { svg += text(line,x + 20,y + layout.contextTop + n * 11,9); });
  if (["vertical_bar","horizontal_bar","grouped_bar","stacked_bar"].includes(tile.visualization)) {
    const rows = tile.visualization === "vertical_bar" || tile.visualization === "horizontal_bar";
    const paints = rows ? tile.result.table.map((row,index) => barPaintSvg(tile,"rows",row.optionId,index)) : tile.result.columns.map((column,index) => barPaintSvg(tile,"columns",column.id,index));
    svg += `<defs>${[...new Set(paints.map(paint => paint.definition))].join("")}</defs>`;
  }
  const hasValues = tile.result.table.some(row=>tile.result.columns.some(column=>analyticalCell(tile.result,row,column.id).status === "available"));
  if (includeBody && !hasValues && tile.visualization !== "table") svg += text(tile.result.metric.valueFormat === "percent" ? "Unavailable: no valid percentage denominator." : "Unavailable: no valid numeric observations.",layout.area.x,layout.area.y+24,12);
  else if (includeBody) svg += tile.visualization === "table" ? table(tile) : tile.visualization === "donut" ? donut(tile) : tile.visualization === "line_chart" ? lines(tile) : bars(tile);
  return svg + "</g>";
}
