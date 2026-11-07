import { expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { findAnalysisPlacement, resolveAnalysisPage } from "../analysisPlacement";

function page() { const value = structuredClone(initialDashboard.pages[0]); value.tiles = []; value.elements = []; return value; }
it("keeps the familiar position on an empty page", () => {
  expect(findAnalysisPlacement(page())).toMatchObject({ x: 48, y: 72, width: 760, height: 460 });
});
it("reports a full page rather than stacking another full-size result over existing research", () => {
  const value = page(); value.tiles = [{ ...structuredClone(initialDashboard.pages[0].tiles[0]), layout: { x: 48, y: 72, width: 760, height: 460, zIndex: 2 } }];
  const before = structuredClone(value); expect(findAnalysisPlacement(value)).toBeNull(); expect(value).toEqual(before);
});
it("finds an exact fit beside custom-sized objects and retains a clear gap", () => {
  const value = page(); value.tiles = [{ ...structuredClone(initialDashboard.pages[0].tiles[0]), layout: { x: 24, y: 24, width: 420, height: 680, zIndex: 5 } }];
  expect(findAnalysisPlacement(value)).toMatchObject({ x: 468, y: 24, zIndex: 6 });
});
it("accounts for narrative objects and fits below a header without moving it", () => {
  const value = page(); value.elements = [{ ...structuredClone(initialDashboard.pages[0].elements[0]), layout: { x: 24, y: 24, width: 1232, height: 170, zIndex: 3 } }];
  const before = structuredClone(value); expect(findAnalysisPlacement(value)).toMatchObject({ x: 24, y: 218 }); expect(value).toEqual(before);
});
it("does not create off-page space from an invalid preferred position", () => {
  expect(findAnalysisPlacement(page(), { x: 2000, y: -10 })).toMatchObject({ x: 24, y: 24 });
});
it("follows multiple undone analysis pages back to their original later page and supports each Redo", () => {
  const first = { ...page(), id: "first" }, origin = { ...page(), id: "origin" }, a = { ...page(), id: "a" }, b = { ...page(), id: "b" };
  const origins = new Map([[JSON.stringify(["report", "b"]), "a"], [JSON.stringify(["report", "a"]), "origin"]]);
  expect(resolveAnalysisPage([first, origin], "b", "report", origins)).toBe(origin);
  expect(resolveAnalysisPage([first, origin, a], "b", "report", origins)).toBe(a);
  expect(resolveAnalysisPage([first, origin, a, b], "b", "report", origins)).toBe(b);
});
it("bounds stale origin cycles and keeps report identifiers separate", () => {
  const first = { ...page(), id: "first" }, other = { ...page(), id: "other" };
  const origins = new Map([[JSON.stringify(["report", "a"]), "b"], [JSON.stringify(["report", "b"]), "a"], [JSON.stringify(["report:a", "b"]), "other"]]);
  expect(resolveAnalysisPage([first, other], "a", "report", origins)).toBe(first);
  expect(resolveAnalysisPage([first, other], "b", "report:a", origins)).toBe(other);
  expect(resolveAnalysisPage([first, other], "a:b", "report", origins)).toBe(first);
});
