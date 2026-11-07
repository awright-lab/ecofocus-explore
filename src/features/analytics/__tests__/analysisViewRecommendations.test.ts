import { describe, expect, it } from "vitest";
import { analysisViewRecommendations } from "../analysisViewRecommendations";
import { importDatasetBuffer } from "../../data/datasetImportModel";
import { runImportedDatasetQuery } from "../../data/importedDatasetAnalytics";

async function data(text = "Answer,Group,Spend\nYes,Core,10\nNo,Growth,20\nYes,Growth,30\n") {
  const parsed = await importDatasetBuffer(new TextEncoder().encode(text).buffer, "fabricated.csv");
  if (!parsed.dataset) throw Error(parsed.error);
  return parsed.dataset;
}
describe("result-grounded view advice", () => {
  it("makes a response distribution readable without modifying its values or query", async () => {
    const dataset = await data(), result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "percent_selected", chartType: "table" });
    const before = structuredClone(result), advice = analysisViewRecommendations(result);
    expect(advice.map(item => item.chartType)).toEqual(["vertical_bar", "table"]);
    expect(advice[0].rationale).toContain("2 answers"); expect(result).toEqual(before);
    expect(result.table.map(row => row.values.summary)).toEqual([200/3, 100/3]);
  });
  it("uses actual label length rather than field names to suggest readable horizontal bars", async () => {
    const dataset = await data("Choice\nThis answer contains a long but useful research statement\nShort\n");
    expect(analysisViewRecommendations(runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "count", chartType: "table" }))[0]).toMatchObject({ chartType: "horizontal_bar", rationale: expect.stringContaining("Long answer labels") });
  });
  it("compares exact groups without claiming nominal categories are time ordered", async () => {
    const dataset = await data(), result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], bannerField: dataset.fields[1], metric: "percent_selected", chartType: "table" });
    const advice = analysisViewRecommendations(result);
    expect(advice.map(item => item.chartType)).toEqual(["grouped_bar", "table"]);
    expect(advice[0].rationale).toContain("2 groups"); expect(advice[0].rationale).toContain("does not imply a time sequence");
    expect(advice.some(item => ["line_chart", "stacked_bar", "donut"].includes(item.chartType))).toBe(false);
  });
  it.each(["average", "sum"] as const)("keeps %s measures out of part-to-whole recommendations", async metric => {
    const dataset = await data(), result = runImportedDatasetQuery({ dataset, field: dataset.fields[1], measureField: dataset.fields[2], metric, chartType: "table" });
    const advice = analysisViewRecommendations(result);
    expect(advice.map(item => item.chartType)).toEqual(["vertical_bar", "table"]);
    expect(advice[0].rationale).toContain(result.metric.label.toLowerCase());
    expect(result.metric.id).toBe(metric);
  });
  it("recommends a table for a genuinely dense result without silently dropping answers", async () => {
    const dataset = await data("Answer\n" + Array.from({ length: 15 }, (_, i) => `Answer ${i}`).join("\n"));
    const result = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "count", chartType: "table" });
    expect(analysisViewRecommendations(result)).toEqual([expect.objectContaining({ chartType: "table", rationale: expect.stringContaining("15 answers") })]);
    expect(result.table).toHaveLength(15);
  });
  it("does not chart unavailable or ambiguous cells", async () => {
    const dataset = await data(), original = runImportedDatasetQuery({ dataset, field: dataset.fields[0], metric: "count", chartType: "table" });
    const missing = structuredClone(original); delete missing.table[0].values.summary;
    const ambiguous = structuredClone(original); ambiguous.table[1].optionId = ambiguous.table[0].optionId;
    for (const result of [missing, ambiguous]) expect(analysisViewRecommendations(result)).toEqual([expect.objectContaining({ chartType: "table", rationale: expect.stringContaining("unavailable or ambiguous") })]);
    expect(analysisViewRecommendations(null)).toEqual([]);
  });
});
