import type { CanvasLayout } from "../../../../shared/types/dashboard";
import { chartFrameMinimum } from "../builderConstants";

export const boxScalePercentages = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400] as const;
/** Stored box size only; does not measure, scale or move rendered content. */
export function proportionalBoxSize(layout: CanvasLayout, percentage: number, minimum: Readonly<{ width: number; height: number }> = chartFrameMinimum): Pick<CanvasLayout, "width" | "height"> | null {
  if (!boxScalePercentages.some(value => value === percentage)) throw Error("Choose a listed box-size percentage. The box was kept.");
  if ([layout.x, layout.y, layout.width, layout.height, minimum.width, minimum.height].some(value => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) || layout.width <= 0 || layout.height <= 0 || minimum.width < 0 || minimum.height < 0) throw Error("The box geometry is outside the supported numeric range. Its size was kept.");
  if (layout.width < minimum.width || layout.height < minimum.height) throw Error(`The stored box is below this item's rendered minimum (${minimum.width} x ${minimum.height}). Correct its size before proportional resizing.`);
  const factor = percentage / 100, width = layout.width * factor, height = layout.height * factor;
  if ([width, height].some(value => !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER)) throw Error("The proposed size cannot be represented within the supported numeric range. The box was kept.");
  if (width < minimum.width || height < minimum.height) throw Error(`The proposed box is below this item's rendered minimum (${minimum.width} x ${minimum.height}). Choose a larger percentage.`);
  return width === layout.width && height === layout.height ? null : { width, height };
}
