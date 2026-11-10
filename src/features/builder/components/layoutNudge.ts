import type { CanvasLayout } from "../../../../shared/types/dashboard";

export const layoutMoveDistances = [1, 10, 100] as const;
export type LayoutMoveDirection = "left" | "right" | "up" | "down";
export function layoutMove(layout: CanvasLayout, direction: LayoutMoveDirection, distance: number): Partial<CanvasLayout> {
  if (!layoutMoveDistances.some(value => value === distance) || !["left", "right", "up", "down"].includes(direction)) throw Error("Choose a supported direction and move distance. Position was kept.");
  if ([layout.x, layout.y, layout.width, layout.height].some(value => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) || layout.width <= 0 || layout.height <= 0) throw Error("The current geometry is outside the supported numeric range. Position was kept.");
  const coordinate = direction === "left" || direction === "right" ? "x" : "y", sign = direction === "left" || direction === "up" ? -1 : 1;
  const next = layout[coordinate] + sign * distance;
  if (!Number.isFinite(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER || next === layout[coordinate]) throw Error("That move exceeds the supported numeric range. Position was kept.");
  return { [coordinate]: next === 0 ? 0 : next };
}
