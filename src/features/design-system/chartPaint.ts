import type { DashboardTile, TileAppearance } from "../../../shared/types/dashboard";
import { paletteColor } from "./reportColors";
import { normalizeGradientStops, svgLinearGradientVector } from "../builder/builderHelpers";
export function getBarStyle(appearance: TileAppearance, id: string, fallbackColor: string, role?: "rows" | "columns") {
  const bindings = appearance.reportColorSlots;
  const map = role ? bindings?.[role] : bindings?.rows && Object.hasOwn(bindings.rows,id) ? bindings.rows : bindings?.columns;
  const semantic = map && Object.hasOwn(map,id) ? bindings?.styles?.[String(map[id])] : undefined;
  const override = appearance.reportColorsEnabled && bindings ? semantic : Object.hasOwn(appearance.barStyles, id) ? appearance.barStyles[id] : undefined;
  const defaultColor = appearance.barFillMode === "gradient" && !appearance.reportColorsEnabled ? appearance.primaryColor : fallbackColor;
  return { color: override?.color ?? defaultColor, fillMode: override?.fillMode ?? appearance.barFillMode,
    gradientTo: override?.gradientTo ?? appearance.barGradientTo, gradientType: override?.gradientType ?? appearance.barGradientType,
    gradientAngle: override?.gradientAngle ?? appearance.barGradientAngle, gradientStops: override?.gradientStops ?? appearance.barGradientStops,
    radius: override?.radius ?? appearance.barRadius };
}
export function chartPaint(tile: DashboardTile, role: "rows" | "columns", id: string, index: number) {
  return getBarStyle(tile.appearance, id, paletteColor(tile.appearance, role, id, index), role);
}
export function chartGradientId(tileId: string, key: string) {
  return "gradient_" + Array.from(JSON.stringify([tileId, key]), char => char.codePointAt(0)!.toString(16)).join("_");
}
export function barGradient(style: ReturnType<typeof getBarStyle>, orientation: "vertical" | "horizontal") {
  return { radial: style.gradientType === "radial", vector: svgLinearGradientVector(style.gradientAngle ?? (orientation === "horizontal" ? 90 : 180)),
    stops: normalizeGradientStops(style.color, style.gradientTo, style.gradientStops) };
}

export function chartHasConicFill(tile: DashboardTile) {
  if (!["vertical_bar", "horizontal_bar", "grouped_bar", "stacked_bar"].includes(tile.visualization)) return false;
  const rows = tile.visualization === "vertical_bar" || tile.visualization === "horizontal_bar";
  const paints = rows ? tile.result.table.map((row,index) => chartPaint(tile,"rows",row.optionId,index))
    : tile.result.columns.map((column,index) => chartPaint(tile,"columns",column.id,index));
  return paints.some(paint => paint.fillMode === "gradient" && paint.gradientType === "conic");
}
