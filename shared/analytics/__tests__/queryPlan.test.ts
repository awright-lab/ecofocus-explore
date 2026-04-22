import { describe, expect, it } from "vitest";
import { createAnalyticsQueryPlan } from "../queryPlan";
import type { AnalyticsQueryRequest } from "../../types/analytics";

describe("createAnalyticsQueryPlan", () => {
  it("maps a saved variable set query to provider-neutral source columns", () => {
    const query: AnalyticsQueryRequest = {
      dataset: "ecofocus_2025",
      question: "Q15_TOP2_BRAND_PRIORITIES",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "percent_selected",
      chartType: "vertical_bar"
    };

    expect(createAnalyticsQueryPlan(query)).toMatchObject({
      rows: {
        id: "Q15_TOP2_BRAND_PRIORITIES",
        type: "multi_binary_set",
        sourceColumn: "Q15_TOP2",
        sourceVariables: ["Q15r1", "Q15r2", "Q15r7", "Q15r8", "Q15r9"]
      },
      columns: {
        id: "SUMMARY",
        sourceColumn: "__summary"
      },
      metric: {
        id: "percent_selected",
        valueFormat: "percent"
      },
      weight: {
        id: "weightvar",
        sourceColumn: "weightvar"
      }
    });
  });
});
