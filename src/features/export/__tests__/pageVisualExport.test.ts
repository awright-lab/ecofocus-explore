import { describe, expect, it } from "vitest";
import { initialDashboard } from "../../document/documentSeeds";
import { buildPageVisualSvg } from "../pageVisualExport";

function donutPage() {
  const page = structuredClone(initialDashboard.pages[0]);
  page.elements = [];
  page.tiles = page.tiles.filter((tile) => tile.visualization === "donut");
  return page;
}

describe("donut visual exports", () => {
  it("includes every category and its analytical value", () => {
    const page = donutPage();
    const svg = buildPageVisualSvg(page);
    for (const row of page.tiles[0].result.table) {
      expect(svg).toContain(row.label);
      expect(svg).toContain(`${row.values.summary}%`);
    }
  });
  it("preserves display labels and percentage precision", () => {
    const page = donutPage();
    page.tiles[0].appearance.axisLabelOverrides.trust_a_lot = "High & clear";
    page.tiles[0].appearance.labelPercentDecimals = 1;
    const svg = buildPageVisualSvg(page);
    expect(svg).toContain("High &amp; clear");
    expect(svg).toContain("20.0%");
  });
  it("keeps category labels when value labels are switched off", () => {
    const page = donutPage();
    page.tiles[0].appearance.showValueLabels = false;
    const svg = buildPageVisualSvg(page);
    expect(svg).toContain("Trust somewhat");
    expect(svg).not.toContain("42%");
  });
});
