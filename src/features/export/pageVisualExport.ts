import { canvasHeight, canvasWidth } from "../builder/builderConstants";
import type { DashboardCanvasElement, DashboardPage, DashboardTile } from "../../../shared/types/dashboard";

export interface PageVisualImage {
  pageId: string;
  title: string;
  dataUrl: string;
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatValue(value: number | undefined) {
  if (typeof value !== "number") return "";
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function wrapLines(value: string, maxChars: number, maxLines = 3) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function textLines(lines: string[], x: number, y: number, size: number, color: string, weight = 700, anchor: "start" | "middle" | "end" = "start") {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * size * 1.24}" fill="${escapeXml(color)}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(line)}</text>`
  )).join("");
}

function elementSvg(element: DashboardCanvasElement) {
  const { x, y, width, height } = element.layout;
  if (element.type === "text") {
    const lines = wrapLines(element.content, Math.max(12, Math.floor(width / Math.max(element.style.fontSize * 0.48, 6))), 8);
    const anchor = element.style.textAlign === "center" ? "middle" : element.style.textAlign === "right" ? "end" : "start";
    const textX = element.style.textAlign === "center" ? x + width / 2 : element.style.textAlign === "right" ? x + width - element.style.padding : x + element.style.padding;
    return textLines(lines, textX, y + element.style.padding + element.style.fontSize, element.style.fontSize, element.style.textColor, Number(element.style.fontWeight) || 700, anchor);
  }
  if (element.type === "circle") {
    return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="${escapeXml(element.style.fill)}" stroke="${escapeXml(element.style.borderColor)}" stroke-width="${element.style.borderWidth}" opacity="${element.style.opacity}"/>`;
  }
  if (element.type === "image") {
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${element.style.borderRadius}" fill="#eef3f6" stroke="#d8e3ea"/><text x="${x + width / 2}" y="${y + height / 2}" fill="#60717c" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" text-anchor="middle">Image</text>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${element.style.borderRadius}" fill="${escapeXml(element.style.fill)}" stroke="${escapeXml(element.style.borderColor)}" stroke-width="${element.style.borderWidth}" opacity="${element.style.opacity}"/>`;
}

function chartArea(tile: DashboardTile) {
  const pad = 22;
  return {
    x: tile.layout.x + pad,
    y: tile.layout.y + 58,
    width: Math.max(80, tile.layout.width - pad * 2),
    height: Math.max(80, tile.layout.height - 88)
  };
}

function barChartSvg(tile: DashboardTile) {
  const area = chartArea(tile);
  const rows = tile.result.table.slice(0, 8);
  const columns = tile.result.columns.slice(0, tile.visualization === "grouped_bar" ? 3 : 1);
  const values = rows.flatMap((row) => columns.map((column) => row.values[column.id] ?? 0));
  const max = Math.max(1, ...values);
  const groupWidth = area.width / Math.max(rows.length, 1);
  const palette = tile.appearance.palette.length ? tile.appearance.palette : ["#008b89", "#4f7fe8", "#6557c8"];
  const axisY = area.y + area.height;
  const bars = rows.map((row, rowIndex) => {
    const barGap = 5;
    const barWidth = Math.max(8, (groupWidth - 14) / columns.length - barGap);
    const rowBars = columns.map((column, columnIndex) => {
      const value = row.values[column.id] ?? 0;
      const height = (value / max) * (area.height - 28);
      const x = area.x + rowIndex * groupWidth + 7 + columnIndex * (barWidth + barGap);
      const y = axisY - height;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="4" fill="${palette[columnIndex % palette.length]}"/><text x="${x + barWidth / 2}" y="${y - 6}" fill="#172033" font-size="10" font-family="Inter, Arial" font-weight="800" text-anchor="middle">${formatValue(value)}</text>`;
    }).join("");
    return `${rowBars}<text x="${area.x + rowIndex * groupWidth + groupWidth / 2}" y="${axisY + 18}" fill="#5e6b75" font-size="9" font-family="Inter, Arial" text-anchor="middle">${escapeXml(row.label.slice(0, 16))}</text>`;
  }).join("");
  return `<line x1="${area.x}" y1="${axisY}" x2="${area.x + area.width}" y2="${axisY}" stroke="#9aa7b1" stroke-width="1"/>${bars}`;
}

function lineChartSvg(tile: DashboardTile) {
  const area = chartArea(tile);
  const rows = tile.result.table.slice(0, 8);
  const columns = tile.result.columns.slice(0, 4);
  const values = rows.flatMap((row) => columns.map((column) => row.values[column.id] ?? 0));
  const max = Math.max(1, ...values);
  const palette = tile.appearance.palette.length ? tile.appearance.palette : ["#008b89", "#4f7fe8", "#6557c8"];
  return columns.map((column, columnIndex) => {
    const points = rows.map((row, rowIndex) => {
      const x = area.x + (rowIndex / Math.max(rows.length - 1, 1)) * area.width;
      const y = area.y + area.height - ((row.values[column.id] ?? 0) / max) * (area.height - 20);
      return `${x},${y}`;
    }).join(" ");
    return `<polyline points="${points}" fill="none" stroke="${palette[columnIndex % palette.length]}" stroke-width="3"/><text x="${area.x + area.width - 6}" y="${area.y + 14 + columnIndex * 16}" fill="${palette[columnIndex % palette.length]}" font-size="11" font-family="Inter, Arial" font-weight="800" text-anchor="end">${escapeXml(column.label)}</text>`;
  }).join("");
}

function donutSegment(cx: number, cy: number, r: number, start: number, end: number, color: string) {
  const startRad = (start - 90) * Math.PI / 180;
  const endRad = (end - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const large = end - start > 180 ? 1 : 0;
  return `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}"/>`;
}

function gradientDefinition(page: DashboardPage) {
  const stops = page.gradientStops.length
    ? [...page.gradientStops].sort((a, b) => a.position - b.position)
    : [
      { id: "from", color: page.gradientFrom, position: 0, opacity: 100 },
      { id: "to", color: page.gradientTo, position: 100, opacity: 100 }
    ];
  const stopXml = stops.map((stop) => `<stop offset="${stop.position}%" stop-color="${escapeXml(stop.color)}" stop-opacity="${Math.max(0, Math.min(100, stop.opacity)) / 100}"/>`).join("");
  if (page.gradientType === "radial") {
    return `<radialGradient id="pageGradient" cx="50%" cy="50%" r="75%">${stopXml}</radialGradient>`;
  }
  return `<linearGradient id="pageGradient" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${page.gradientAngle || 0} 0.5 0.5)">${stopXml}</linearGradient>`;
}

function donutSvg(tile: DashboardTile) {
  const area = chartArea(tile);
  const rows = tile.result.table.slice(0, 5);
  const column = tile.result.columns[0];
  const total = Math.max(1, rows.reduce((sum, row) => sum + Math.max(0, row.values[column.id] ?? 0), 0));
  const palette = tile.appearance.palette.length ? tile.appearance.palette : ["#008b89", "#6557c8", "#ff6b60", "#4f7fe8"];
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const r = Math.min(area.width, area.height) * 0.32;
  let angle = 0;
  const segments = rows.map((row, index) => {
    const next = angle + ((row.values[column.id] ?? 0) / total) * 360;
    const segment = donutSegment(cx, cy, r, angle, next, palette[index % palette.length]);
    angle = next;
    return segment;
  }).join("");
  return `${segments}<circle cx="${cx}" cy="${cy}" r="${r * 0.54}" fill="#ffffff"/><text x="${cx}" y="${cy + 4}" fill="#172033" font-family="Inter, Arial" font-size="15" font-weight="900" text-anchor="middle">${escapeXml(column.label)}</text>`;
}

function tableSvg(tile: DashboardTile) {
  const area = chartArea(tile);
  const rows = tile.result.table.slice(0, 8);
  const columns = tile.result.columns.slice(0, 4);
  const rowHeight = Math.min(28, area.height / Math.max(rows.length + 1, 1));
  const firstWidth = area.width * 0.32;
  const colWidth = (area.width - firstWidth) / Math.max(columns.length, 1);
  const header = `<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${rowHeight}" fill="#f4f7f9"/><text x="${area.x + 8}" y="${area.y + 18}" fill="#243343" font-size="10" font-family="Inter, Arial" font-weight="900">Row</text>${columns.map((column, index) => `<text x="${area.x + firstWidth + index * colWidth + 8}" y="${area.y + 18}" fill="#243343" font-size="10" font-family="Inter, Arial" font-weight="900">${escapeXml(column.label.slice(0, 14))}</text>`).join("")}`;
  const body = rows.map((row, rowIndex) => {
    const y = area.y + rowHeight * (rowIndex + 1);
    return `<rect x="${area.x}" y="${y}" width="${area.width}" height="${rowHeight}" fill="${rowIndex % 2 ? "#ffffff" : "#fbfcfd"}" stroke="#edf1f4"/><text x="${area.x + 8}" y="${y + 18}" fill="#263443" font-size="10" font-family="Inter, Arial">${escapeXml(row.label.slice(0, 18))}</text>${columns.map((column, index) => `<text x="${area.x + firstWidth + index * colWidth + 8}" y="${y + 18}" fill="#172033" font-size="10" font-family="Inter, Arial" font-weight="800">${formatValue(row.values[column.id])}</text>`).join("")}`;
  }).join("");
  return header + body;
}

function tileSvg(tile: DashboardTile) {
  const { x, y, width, height } = tile.layout;
  const background = tile.appearance.background || "#ffffff";
  const border = tile.appearance.borderColor || "#dfe7ef";
  const title = tile.title || tile.name;
  const chart =
    tile.visualization === "donut" ? donutSvg(tile)
      : tile.visualization === "line_chart" ? lineChartSvg(tile)
        : tile.visualization === "table" ? tableSvg(tile)
          : barChartSvg(tile);
  const metadata = `${tile.result.metric.label} · ${tile.result.weighting.applied ? tile.result.weighting.label : "Unweighted"}`;
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${tile.appearance.borderRadius || 12}" fill="${escapeXml(background)}" stroke="${escapeXml(border)}" stroke-width="1.2"/><text x="${x + 18}" y="${y + 28}" fill="#172033" font-family="Inter, Arial" font-size="16" font-weight="900">${escapeXml(title)}</text><text x="${x + 18}" y="${y + 47}" fill="#63717d" font-family="Inter, Arial" font-size="11" font-weight="700">${escapeXml(metadata)}</text>${chart}</g>`;
}

function pageBackgroundSvg(page: DashboardPage) {
  const hasGradient = page.backgroundMode === "gradient" || page.backgroundMode === "pattern";
  const baseFill = hasGradient ? "url(#pageGradient)" : page.background;
  const definitions = hasGradient ? gradientDefinition(page) : "";
  const patternDefinition = page.backgroundPattern !== "none"
    ? `<pattern id="pagePattern" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="transparent"/><path d="M36 0H0V36" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/></pattern>`
    : "";
  const defs = definitions || patternDefinition ? `<defs>${definitions}${patternDefinition}</defs>` : "";
  if (page.backgroundPattern !== "none") {
    return `${defs}<rect width="${canvasWidth}" height="${canvasHeight}" fill="${escapeXml(baseFill)}"/><rect width="${canvasWidth}" height="${canvasHeight}" fill="url(#pagePattern)"/>`;
  }
  return `${defs}<rect width="${canvasWidth}" height="${canvasHeight}" fill="${escapeXml(baseFill)}"/>`;
}

export function buildPageVisualSvg(page: DashboardPage) {
  const objects = [
    ...page.elements.filter((element) => !element.hidden).map((element) => ({ z: element.layout.zIndex, svg: elementSvg(element) })),
    ...page.tiles.filter((tile) => !tile.hidden).map((tile) => ({ z: tile.layout.zIndex, svg: tileSvg(tile) }))
  ].sort((a, b) => a.z - b.z);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">${pageBackgroundSvg(page)}${objects.map((object) => object.svg).join("")}</svg>`;
}

export async function renderPageVisualImages(pages: DashboardPage[]): Promise<PageVisualImage[]> {
  const sortedPages = [...pages].sort((a, b) => a.order - b.order);
  const images = await Promise.all(sortedPages.map(async (page) => {
    const svg = buildPageVisualSvg(page);
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error(`Unable to render page ${page.title}`));
        nextImage.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth * 2;
      canvas.height = canvasHeight * 2;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is not available for export.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return {
        pageId: page.id,
        title: page.title,
        dataUrl: canvas.toDataURL("image/jpeg", 0.92)
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }));
  return images;
}

export function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
