import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { chartFrameMinimum } from "../builderConstants";

/** Fits the object's box, never its rendered contents. Never enlarges a box. */
export function fitLayoutBox(layout: CanvasLayout, pageWidth: number, pageHeight: number, minimum: Readonly<{ width: number; height: number }> = chartFrameMinimum): Partial<CanvasLayout> | null {
  if ([layout.x, layout.y, layout.width, layout.height, pageWidth, pageHeight, minimum.width, minimum.height].some(value => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) || layout.width <= 0 || layout.height <= 0 || pageWidth <= 0 || pageHeight <= 0 || minimum.width < 0 || minimum.height < 0) throw Error("The geometry is outside the supported numeric range. The box was kept.");
  let width = layout.width, height = layout.height;
  if (width > pageWidth || height > pageHeight) {
    if (pageWidth / width <= pageHeight / height) {
      width = pageWidth;
      height = layout.height * (pageWidth / layout.width);
    } else {
      height = pageHeight;
      width = layout.width * (pageHeight / layout.height);
    }
  }
  if (width <= 0 || height <= 0 || width > pageWidth || height > pageHeight || !Number.isFinite(width) || !Number.isFinite(height)) throw Error("The fitted box cannot be represented safely. The box was kept.");
  if (width < minimum.width || height < minimum.height) throw Error(`A proportional fit cannot satisfy this item's rendered minimum size (${minimum.width} × ${minimum.height}). Adjust its dimensions manually; the box was kept.`);
  const x = Math.max(0, Math.min(layout.x, pageWidth - width));
  const y = Math.max(0, Math.min(layout.y, pageHeight - height));
  if (x === layout.x && y === layout.y && width === layout.width && height === layout.height) return null;
  return { x, y, width, height };
}
