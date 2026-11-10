import { expect, it } from "vitest";
import { layoutMove } from "../layoutNudge";
import type { CanvasLayout } from "../../../../../shared/types/dashboard";
const source: CanvasLayout = { x: 20.5, y: -30.25, width: 400, height: 250, zIndex: 7 };
it.each([1, 10, 100])("moves by %s page units without altering size/layer or mutating geometry", distance => {
  const before = structuredClone(source);
  expect(layoutMove(source, "right", distance)).toEqual({ x: 20.5 + distance }); expect(layoutMove(source, "left", distance)).toEqual({ x: 20.5 - distance }); expect(layoutMove(source, "up", distance)).toEqual({ y: -30.25 - distance }); expect(layoutMove(source, "down", distance)).toEqual({ y: -30.25 + distance }); expect(source).toEqual(before);
});
it("allows intentional negative positions and normalizes new signed zero", () => { expect(layoutMove(source, "left", 100)).toEqual({ x: -79.5 }); const zero = layoutMove({ ...source, x: -1 }, "right", 1).x!; expect(zero).toBe(0); expect(Object.is(zero, -0)).toBe(false); });
it.each([0, 2, -1, Infinity, "1"])("refuses unsupported distance %s", value => { expect(() => layoutMove(source, "right", value as number)).toThrow(); });
it("refuses unsupported direction", () => expect(() => layoutMove(source, "diagonal" as never, 1)).toThrow());
it.each([{ x: NaN }, { y: Infinity }, { width: 0 }, { height: -1 }, { x: Number.MAX_SAFE_INTEGER + 1 }])("refuses invalid source geometry %j without mutation", change => { const layout = { ...source, ...change }, before = structuredClone(layout); expect(() => layoutMove(layout, "right", 1)).toThrow(); expect(layout).toEqual(before); });
it("refuses overflowing positive and negative moves instead of clamping or writing unsafe coordinates", () => { expect(() => layoutMove({ ...source, x: Number.MAX_SAFE_INTEGER }, "right", 1)).toThrow("supported numeric range"); expect(() => layoutMove({ ...source, y: -Number.MAX_SAFE_INTEGER }, "up", 1)).toThrow("supported numeric range"); expect(layoutMove({ ...source, x: Number.MAX_SAFE_INTEGER }, "left", 1)).toEqual({ x: Number.MAX_SAFE_INTEGER - 1 }); });
