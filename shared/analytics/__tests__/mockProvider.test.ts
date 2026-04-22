import { describe, expect, it } from "vitest";
import { mockAnalyticsProvider } from "../providers/mockProvider";
import type { AnalyticsQueryRequest } from "../../types/analytics";

describe("mockAnalyticsProvider", () => {
  it("returns normalized table-first output for Q15 Top 2", async () => {
    const query: AnalyticsQueryRequest = {
      dataset: "ecofocus_2025",
      question: "Q15_TOP2_BRAND_PRIORITIES",
      breakBy: "SUMMARY",
      filters: [],
      weight: "weightvar",
      metric: "percent_selected",
      chartType: "vertical_bar"
    };

    const result = await mockAnalyticsProvider.runQuery(query);

    expect(result.columns).toEqual([{ id: "summary", label: "Summary" }]);
    expect(result.table).toHaveLength(5);
    expect(result.table[0]).toMatchObject({
      optionId: "Q15r1",
      values: { summary: 53 },
      bases: { summary: 3125 }
    });
    expect(result.weighting).toEqual({
      applied: true,
      id: "weightvar",
      label: "EcoFocus respondent weight"
    });
    expect(result.annotations).toEqual(
      expect.arrayContaining([
        { rowId: "Q15r8", columnId: "summary", direction: "down", confidence: 0.95 },
        { rowId: "Q15r9", columnId: "summary", direction: "up", confidence: 0.95 }
      ])
    );
  });
});
