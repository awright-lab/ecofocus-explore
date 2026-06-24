import { describe, expect, it } from "vitest";
import { runMockAnalyticsQuery } from "../../../../../shared/mock/analytics";
import type { AnalyticsQueryRequest, AnalyticsQueryResponse } from "../../../../../shared/types/analytics";
import type { DashboardTile } from "../../../../../shared/types/dashboard";
import {
  buildDerivedDefinitionFromTile,
  buildDerivedDefinitionLibraryItems,
  buildDerivedOutputMetadata,
  buildDerivedOutputResponse,
  buildDerivedOutputViews
} from "../derivedOutputModel";

const breakoutQuery: AnalyticsQueryRequest = {
  dataset: "ecofocus_2025",
  question: "Q_PACKAGING_TRUST",
  breakBy: "GENERATION",
  filters: [],
  weight: "weightvar",
  metric: "column_percent",
  chartType: "table",
  confidenceLevel: 0.95
};

function tileFromResult(result: AnalyticsQueryResponse): DashboardTile {
  return {
    id: "tile_source",
    name: "Trust by generation",
    title: "Trust by generation",
    source: {
      kind: "question",
      id: result.query.question,
      label: "Packaging trust"
    },
    locked: false,
    hidden: false,
    layout: {
      x: 0,
      y: 0,
      width: 760,
      height: 460,
      zIndex: 1
    },
    query: result.query,
    visualization: "table",
    appearance: {} as DashboardTile["appearance"],
    result
  };
}

describe("derived output row-difference metric scaffold", () => {
  it("builds a reusable row-difference metric view, response, metadata, and definition", () => {
    const sourceTile = tileFromResult(runMockAnalyticsQuery(breakoutQuery));
    const rowDifferenceView = buildDerivedOutputViews(sourceTile).find((view) => view.kind === "row_difference");
    const response = buildDerivedOutputResponse(sourceTile, "row_difference");
    const metadata = buildDerivedOutputMetadata(sourceTile, "row_difference");
    const definition = buildDerivedDefinitionFromTile(sourceTile, "row_difference");

    expect(rowDifferenceView).toMatchObject({
      canCreate: true,
      label: "Row-difference metric",
      rowLabel: "Trust a lot minus Trust somewhat",
      columnLabel: "Gen Z",
      valueLabel: "-26%"
    });
    expect(response?.table).toEqual([
      expect.objectContaining({
        optionId: "row_difference",
        label: "Trust a lot minus Trust somewhat",
        values: { gen_z: -26 },
        bases: { gen_z: 312 },
        presentation: {
          rowKind: "net",
          emphasis: "summary"
        }
      })
    ]);
    expect(metadata).toMatchObject({
      kind: "row_difference",
      rowId: "trust_a_lot",
      rowLabel: "Trust a lot",
      comparedRowId: "trust_somewhat",
      comparedRowLabel: "Trust somewhat",
      columnId: "gen_z",
      valueLabel: "-26%"
    });
    expect(definition).toMatchObject({
      definitionType: "metric",
      outputKind: "row_difference",
      metricKind: "row_difference",
      summary: {
        outputLabel: "Row difference metric",
        structureLabel: "Trust a lot minus Trust somewhat in Gen Z"
      },
      spec: {
        rowId: "trust_a_lot",
        comparedRowId: "trust_somewhat",
        columnId: "gen_z"
      }
    });
  });

  it("surfaces saved row-difference definitions as metric artifacts in the library model", () => {
    const sourceTile = tileFromResult(runMockAnalyticsQuery(breakoutQuery));
    const definition = buildDerivedDefinitionFromTile(sourceTile, "row_difference");
    const items = buildDerivedDefinitionLibraryItems(definition ? [definition] : [], {
      id: "page_one",
      title: "Page one",
      order: 1,
      showCanvasGrid: false,
      snapToGrid: false,
      gridSize: 20,
      background: "#ffffff",
      backgroundMode: "solid",
      backgroundImage: "",
      backgroundImageFit: "cover",
      gradientFrom: "#ffffff",
      gradientTo: "#ffffff",
      gradientType: "linear",
      gradientAngle: 0,
      gradientStops: [],
      elements: [],
      tiles: [sourceTile]
    });

    expect(items[0]).toMatchObject({
      label: "Row difference metric",
      structuralSummary: "Trust a lot minus Trust somewhat in Gen Z",
      readinessStatus: "ready",
      canCreate: true,
      outputKind: "row_difference"
    });
    expect(items[0].chips).toEqual(expect.arrayContaining(["Row difference metric", "Ready to recreate"]));
  });
});
