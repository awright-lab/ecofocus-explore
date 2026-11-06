import type { DashboardTile } from "../../../shared/types/dashboard";
import { barGradient, chartGradientId, chartPaint } from "../design-system/chartPaint";
function escape(value: string) { return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
export function barPaintSvg(tile: DashboardTile, role: "rows" | "columns", id: string, index: number) {
  const style = chartPaint(tile, role, id, index);
  if (style.fillMode !== "gradient") return { fill: style.color, definition: "" };
  const key = chartGradientId(tile.id, JSON.stringify([role, id])), gradient = barGradient(style, tile.visualization === "horizontal_bar" ? "horizontal" : "vertical");
  const stops = gradient.stops.map(stop => {
    if (!Number.isFinite(stop.position) || !Number.isFinite(stop.opacity)) throw new Error("A chart gradient has invalid stops. Review its styling before exporting.");
    return `<stop offset="${stop.position}%" stop-color="${escape(stop.color)}" stop-opacity="${stop.opacity / 100}"/>`;
  }).join("");
  const vector = gradient.vector;
  const definition = gradient.radial ? `<radialGradient id="${key}">${stops}</radialGradient>` : `<linearGradient id="${key}" x1="${vector.x1}" y1="${vector.y1}" x2="${vector.x2}" y2="${vector.y2}">${stops}</linearGradient>`;
  return { fill: `url(#${key})`, definition };
}
export function chartNeedsGradientFallback(tile: DashboardTile) {
  const rows = tile.visualization === "vertical_bar" || tile.visualization === "horizontal_bar";
  return rows ? tile.result.table.some((row,index) => chartPaint(tile,"rows",row.optionId,index).fillMode === "gradient")
    : tile.result.columns.some((column,index) => chartPaint(tile,"columns",column.id,index).fillMode === "gradient");
}
