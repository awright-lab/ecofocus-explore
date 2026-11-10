import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { chartFrameMinimum } from "../builderConstants";

export const pageAlignmentActions = [
  { id: "left", axis: "horizontal", text: "Left", label: "Align box left on page" },
  { id: "center", axis: "horizontal", text: "Center", label: "Center box horizontally on page" },
  { id: "right", axis: "horizontal", text: "Right", label: "Align box right on page" },
  { id: "top", axis: "vertical", text: "Top", label: "Align box top on page" },
  { id: "middle", axis: "vertical", text: "Middle", label: "Center box vertically on page" },
  { id: "bottom", axis: "vertical", text: "Bottom", label: "Align box bottom on page" }
] as const;
export type PageAlignment = typeof pageAlignmentActions[number]["id"];

/** One axis only. Box geometry is preserved; visual effects/content are not measured. */
export function pageAlignment(layout: CanvasLayout, direction: PageAlignment, pageWidth: number, pageHeight: number, minimum: Readonly<{ width: number; height: number }> = chartFrameMinimum): Partial<CanvasLayout> | null {
  if ([layout.x, layout.y, layout.width, layout.height, pageWidth, pageHeight, minimum.width, minimum.height].some(value => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
    || layout.width <= 0 || layout.height <= 0 || pageWidth <= 0 || pageHeight <= 0 || minimum.width < 0 || minimum.height < 0) throw Error("The geometry is outside the supported numeric range. Position was kept.");
  if (layout.width < minimum.width || layout.height < minimum.height) throw Error(`The box is below this item's rendered minimum size (${minimum.width} x ${minimum.height}). Adjust its size before aligning; position was kept.`);
  if (!pageAlignmentActions.some(action => action.id === direction)) throw Error("Choose a supported page alignment. Position was kept.");
  const horizontal = direction === "left" || direction === "center" || direction === "right";
  const axis = horizontal ? "x" : "y";
  const space = horizontal ? pageWidth - layout.width : pageHeight - layout.height;
  const raw = direction === "left" || direction === "top" ? 0 : direction === "center" || direction === "middle" ? space / 2 : space;
  const next = raw === 0 ? 0 : raw;
  if (!Number.isFinite(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER) throw Error("The aligned position cannot be represented safely. Position was kept.");
  return layout[axis] === next ? null : { [axis]: next };
}
