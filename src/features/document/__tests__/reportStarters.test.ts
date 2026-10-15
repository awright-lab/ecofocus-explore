import { describe, expect, it } from "vitest";
import { initialDashboard } from "../documentSeeds";
import {
  createExampleReport,
  createNewReportFromSeed,
} from "../workspacePersistence";
import { validateAnalyticsQuery } from "../../../../shared/analytics/validation";
import { runMockAnalyticsQuery } from "../../../../shared/mock/analytics";
import type { DashboardWorkspace } from "../../../../shared/types/dashboard";

function workspace(): DashboardWorkspace {
  return {
    id: "workspace",
    label: "Workspace",
    activeReportId: initialDashboard.id,
    reports: [
      {
        id: initialDashboard.id,
        title: initialDashboard.title,
        draft: structuredClone(initialDashboard),
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        lastOpenedAt: "2026-01-01",
      },
    ],
    importedDatasets: [],
    datasetConnections: [],
    liveDatasetSources: [],
    publishedSnapshots: [],
  };
}

describe("report starters", () => {
  it("starts new reports with an empty canvas and reusable libraries", () => {
    const original = workspace();
    const before = structuredClone(original);
    const { report, workspace: updated } = createNewReportFromSeed(original);
    expect(report.draft.pages).toHaveLength(1);
    expect(report.draft.pages[0].elements).toEqual([]);
    expect(report.draft.pages[0].tiles).toEqual([]);
    expect(report.draft.analysisLibrary.variableSets.length).toBeGreaterThan(0);
    expect(report.draft.designLibrary.pageTemplates.length).toBeGreaterThan(0);
    expect(report.id).not.toBe(initialDashboard.id);
    expect(updated.reports).toHaveLength(2);
    expect(original).toEqual(before);
  });
  it("adds an independent editable example without replacing saved reports", () => {
    const original = workspace();
    const { report, workspace: updated } = createExampleReport(original);
    expect(updated.reports[1]).toEqual(original.reports[0]);
    expect(report.draft.pages[0].tiles).toHaveLength(2);
    report.draft.pages[0].tiles[0].title = "Edited example";
    expect(initialDashboard.pages[0].tiles[0].title).not.toBe("Edited example");
    expect(report.draft.publishMetadata.publishCount).toBe(0);
  });
  it("backs each example chart with a valid, reproducible analytics query", () => {
    for (const page of initialDashboard.pages)
      for (const tile of page.tiles) {
        expect(validateAnalyticsQuery(tile.query)).toEqual([]);
        expect(tile.result).toEqual(runMockAnalyticsQuery(tile.query));
        expect(tile.query.chartType).toBe(tile.visualization);
        expect(tile.layout.x + tile.layout.width).toBeLessThanOrEqual(1280);
        expect(tile.layout.y + tile.layout.height).toBeLessThanOrEqual(760);
      }
  });
});
