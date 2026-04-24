import { describe, expect, it } from "vitest";
import { applyVariableSetRows } from "../variableSets";
import { runMockAnalyticsQuery } from "../../mock/analytics";
import type { SavedVariableSet } from "../../types/dashboard";

describe("applyVariableSetRows", () => {
  it("applies authored row order, visibility, and summary rows", () => {
    const response = runMockAnalyticsQuery({
      dataset: "ecofocus_2025",
      question: "Q15_TOP2_BRAND_PRIORITIES",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "percent_selected",
      chartType: "table",
      confidenceLevel: 0.95
    });

    const variableSet: SavedVariableSet = {
      id: "test_set",
      datasetId: "ecofocus_2025",
      label: "Brand priority highlights",
      description: "",
      topic: "Brand Sustainability Perceptions",
      questionIds: ["Q15_TOP2_BRAND_PRIORITIES"],
      primaryQuestionId: "Q15_TOP2_BRAND_PRIORITIES",
      rowMode: "authored",
      rows: [
        {
          id: "top_box",
          label: "Top 2 box",
          kind: "topbox",
          sourceOptionIds: ["Q15r1", "Q15r2"],
          rowOrder: 1,
          visible: true,
          emphasis: "summary"
        },
        {
          id: "Q15r1",
          label: "Education",
          kind: "option",
          sourceOptionIds: ["Q15r1"],
          rowOrder: 2,
          visible: true,
          emphasis: "detail"
        },
        {
          id: "Q15r2",
          label: "Charity",
          kind: "option",
          sourceOptionIds: ["Q15r2"],
          rowOrder: 3,
          visible: false,
          emphasis: "detail"
        }
      ],
      breakBy: "SUMMARY",
      metric: "percent_selected",
      chartType: "table",
      weight: "weightvar",
      filterField: null,
      filterValue: "all"
    };

    const result = applyVariableSetRows(response, variableSet);

    expect(result.table.map((row) => row.optionId)).toEqual(["top_box", "Q15r1"]);
    expect(result.table[0]).toMatchObject({
      label: "Top 2 box",
      values: { summary: 100 },
      bases: { summary: 3125 },
      presentation: {
        rowKind: "topbox",
        emphasis: "summary"
      }
    });
    expect(result.table[1]).toMatchObject({
      presentation: {
        rowKind: "option",
        emphasis: "detail"
      }
    });
    expect(result.notes[result.notes.length - 1]).toContain("Summary rows: Top 2 box");
    expect(result.notes[result.notes.length - 1]).toContain("Hidden rows: Charity");
  });
});
