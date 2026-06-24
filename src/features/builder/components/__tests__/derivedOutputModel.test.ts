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
    const config = {
      rowId: "neutral",
      comparedRowId: "distrust",
      columnId: "millennial"
    };
    const rowDifferenceView = buildDerivedOutputViews(sourceTile, config).find((view) => view.kind === "row_difference");
    const response = buildDerivedOutputResponse(sourceTile, "row_difference", config);
    const metadata = buildDerivedOutputMetadata(sourceTile, "row_difference", config);
    const definition = buildDerivedDefinitionFromTile(sourceTile, "row_difference", config);

    expect(rowDifferenceView).toMatchObject({
      canCreate: true,
      label: "Row-difference metric",
      rowLabel: "Neither trust nor distrust minus Distrust",
      columnLabel: "Millennial",
      valueLabel: "6%",
      selectedRowId: "neutral",
      selectedComparedRowId: "distrust",
      selectedColumnId: "millennial",
      metricPreview: {
        formulaLabel: "Neither trust nor distrust - Distrust",
        columnLabel: "Millennial",
        leftValueLabel: "Neither trust nor distrust: 18%",
        rightValueLabel: "Distrust: 12%",
        resultLabel: "Difference: 6%",
        baseContextLabel: "Bases: 428 vs 428 (metric uses 428)"
      }
    });
    expect(rowDifferenceView?.rowOptions?.map((item) => item.id)).toEqual(["trust_a_lot", "trust_somewhat", "neutral", "distrust"]);
    expect(rowDifferenceView?.columnOptions?.map((item) => item.id)).toEqual(["gen_z", "millennial", "gen_x", "boomer_plus"]);
    expect(response?.table).toEqual([
      expect.objectContaining({
        optionId: "row_difference",
        label: "Neither trust nor distrust minus Distrust",
        values: { millennial: 6 },
        bases: { millennial: 428 },
        presentation: {
          rowKind: "net",
          emphasis: "summary"
        }
      })
    ]);
    expect(metadata).toMatchObject({
      kind: "row_difference",
      rowId: "neutral",
      rowLabel: "Neither trust nor distrust",
      comparedRowId: "distrust",
      comparedRowLabel: "Distrust",
      columnId: "millennial",
      valueLabel: "6%"
    });
    expect(definition).toMatchObject({
      definitionType: "metric",
      outputKind: "row_difference",
      metricKind: "row_difference",
      summary: {
        outputLabel: "Row difference metric",
        structureLabel: "Neither trust nor distrust minus Distrust in Millennial"
      },
      spec: {
        rowId: "neutral",
        comparedRowId: "distrust",
        columnId: "millennial"
      }
    });
  });

  it("builds a reusable row-average metric through the same configurable pipeline", () => {
    const sourceTile = tileFromResult(runMockAnalyticsQuery(breakoutQuery));
    const config = {
      rowId: "trust_a_lot",
      comparedRowId: "distrust",
      columnId: "boomer_plus"
    };
    const rowAverageView = buildDerivedOutputViews(sourceTile, config).find((view) => view.kind === "row_average");
    const response = buildDerivedOutputResponse(sourceTile, "row_average", config);
    const metadata = buildDerivedOutputMetadata(sourceTile, "row_average", config);
    const definition = buildDerivedDefinitionFromTile(sourceTile, "row_average", config);
    const libraryItems = buildDerivedDefinitionLibraryItems(definition ? [definition] : [], {
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

    expect(rowAverageView).toMatchObject({
      canCreate: true,
      label: "Row-average metric",
      rowLabel: "Average of Trust a lot and Distrust",
      columnLabel: "Boomer+",
      valueLabel: "17.5%",
      selectedRowId: "trust_a_lot",
      selectedComparedRowId: "distrust",
      selectedColumnId: "boomer_plus",
      metricPreview: {
        formulaLabel: "Average of Trust a lot and Distrust",
        columnLabel: "Boomer+",
        leftValueLabel: "Trust a lot: 14%",
        rightValueLabel: "Distrust: 21%",
        resultLabel: "Average: 17.5%",
        baseContextLabel: "Bases: 365 vs 365 (metric uses 365)"
      }
    });
    expect(response?.table).toEqual([
      expect.objectContaining({
        optionId: "row_average",
        label: "Average of Trust a lot and Distrust",
        values: { boomer_plus: 17.5 },
        bases: { boomer_plus: 365 },
        presentation: {
          rowKind: "net",
          emphasis: "summary"
        }
      })
    ]);
    expect(metadata).toMatchObject({
      kind: "row_average",
      rowId: "trust_a_lot",
      comparedRowId: "distrust",
      columnId: "boomer_plus",
      valueLabel: "17.5%"
    });
    expect(definition).toMatchObject({
      definitionType: "metric",
      outputKind: "row_average",
      metricKind: "row_average",
      summary: {
        outputLabel: "Row average metric",
        structureLabel: "Average of Trust a lot and Distrust in Boomer+"
      },
      spec: {
        rowId: "trust_a_lot",
        comparedRowId: "distrust",
        columnId: "boomer_plus"
      }
    });
    expect(libraryItems[0]).toMatchObject({
      label: "Row average metric",
      structuralSummary: "Average of Trust a lot and Distrust in Boomer+",
      detailSummary: "Average of Trust a lot and Distrust · Boomer+",
      readinessStatus: "ready",
      canCreate: true,
      outputKind: "row_average"
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
      detailSummary: "Trust a lot - Trust somewhat · Gen Z",
      readinessStatus: "ready",
      canCreate: true,
      outputKind: "row_difference"
    });
    expect(items[0].chips).toEqual(expect.arrayContaining(["Row difference metric", "Ready to recreate"]));
  });
});
