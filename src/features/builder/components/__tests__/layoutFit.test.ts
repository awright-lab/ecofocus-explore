import { expect, it } from "vitest";
import { fitLayoutBox as fitWithMinimum } from "../layoutFit";
import type { CanvasLayout } from "../../../../../shared/types/dashboard";
const box: CanvasLayout = { x: 20, y: 30, width: 400, height: 250, zIndex: 7 };
const fitLayoutBox = (layout: CanvasLayout, width: number, height: number) => fitWithMinimum(layout, width, height, { width: 0, height: 0 });
it.each([{ x: 1500, y: 0, width: 400, height: 2000 }, { x: 0, y: 0, width: 4000, height: 300 }, { x: 0, y: 0, width: 100, height: 100 }])("refuses a chart box below its rendered minimum: %j", change => {
  const input = Object.freeze({ ...box, ...change });
  expect(() => fitWithMinimum(input, 1280, 760)).toThrow("rendered minimum size (320 × 220)");
  expect(input).toEqual({ ...box, ...change });
});
it("retains the exact chart minimum boundary when relocating", () => expect(fitWithMinimum({ ...box, x: 1500, y: 900, width: 320, height: 220 }, 1280, 760)).toEqual({ x: 960, y: 540, width: 320, height: 220 }));
it("refuses invalid render minima", () => {
  for (const value of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) expect(() => fitWithMinimum(box, 1280, 760, { width: value, height: 0 })).toThrow("geometry");
});
it("leaves an already-contained box and its input unchanged", () => {
  const input = Object.freeze({ ...box });
  expect(fitLayoutBox(input, 1280, 760)).toBeNull();
  expect(input).toEqual(box);
});
it.each([
  [{ x: -100, y: -200 }, { x: 0, y: 0, width: 400, height: 250 }],
  [{ x: 1500, y: 900 }, { x: 880, y: 510, width: 400, height: 250 }],
  [{ x: -50, y: 700, width: 2560, height: 1000 }, { x: 0, y: 260, width: 1280, height: 500 }],
  [{ x: 50, y: 50, width: 600, height: 1520 }, { x: 50, y: 0, width: 300, height: 760 }],
  [{ x: 0, y: 0, width: 2560, height: 1520 }, { x: 0, y: 0, width: 1280, height: 760 }],
  [{ x: -0.25, y: 759.9, width: 0.5, height: 0.25 }, { x: 0, y: 759.75, width: 0.5, height: 0.25 }]
])("fits representative off-page box %j", (change, expected) => {
  const input = Object.freeze({ ...box, ...change });
  expect(fitLayoutBox(input, 1280, 760)).toEqual(expected);
  expect(input.zIndex).toBe(7);
});
it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects unsupported geometry %s", value => {
  for (const key of ["x", "y", "width", "height"] as const) expect(() => fitLayoutBox({ ...box, [key]: value }, 1280, 760)).toThrow("geometry");
  expect(() => fitLayoutBox(box, value, 760)).toThrow("geometry");
  expect(() => fitLayoutBox(box, 1280, value)).toThrow("geometry");
});
it.each([0, -1])("rejects nonpositive dimensions %s", value => {
  expect(() => fitLayoutBox({ ...box, width: value }, 1280, 760)).toThrow();
  expect(() => fitLayoutBox({ ...box, height: value }, 1280, 760)).toThrow();
  expect(() => fitLayoutBox(box, value, 760)).toThrow();
});
it("refuses underflow instead of creating a zero-sized box", () => expect(() => fitLayoutBox({ ...box, width: Number.MIN_VALUE, height: Number.MAX_SAFE_INTEGER }, 1280, 760)).toThrow("represented safely"));
it("normalizes newly clamped zero and is idempotent", () => {
  const next = fitLayoutBox({ ...box, x: -100 }, 1280, 760)!;
  expect(Object.is(next.x, -0)).toBe(false);
  expect(fitLayoutBox({ ...box, ...next }, 1280, 760)).toBeNull();
});
it("contains 500 deterministic boxes without enlargement, layer changes or aspect distortion", () => {
  for (let n = 1; n <= 500; n++) {
    const input = Object.freeze({ x: n * 13.75 - 3000, y: 2000 - n * 7.125, width: n * 11.3, height: (501 - n) * 8.7, zIndex: n });
    const result = { ...input, ...fitLayoutBox(input, 1280, 760) };
    expect(result.x).toBeGreaterThanOrEqual(0); expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.x + result.width).toBeLessThanOrEqual(1280); expect(result.y + result.height).toBeLessThanOrEqual(760);
    expect(result.width).toBeLessThanOrEqual(input.width); expect(result.height).toBeLessThanOrEqual(input.height);
    expect(result.width / result.height).toBeCloseTo(input.width / input.height, 10);
    expect(result.zIndex).toBe(input.zIndex);
    expect(fitLayoutBox(result, 1280, 760)).toBeNull();
  }
});
