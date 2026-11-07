import { describe, expect, it } from "vitest";
import { parseImportedNumber } from "../importedNumericValue";
import { importDatasetBuffer } from "../datasetImportModel";
import { runImportedDatasetQuery } from "../importedDatasetAnalytics";
import { inferenceSafetyMessage, withSafeInference } from "../../../../shared/analytics/inferenceSafety";

describe("imported numeric values", () => {
  it("keeps large finite summaries finite and refuses aggregate overflow", async () => {
    const parsed = await importDatasetBuffer(new TextEncoder().encode("Segment,Spend\nCore,1e308\nCore,1e308").buffer, "synthetic-large-values.csv");
    const dataset = parsed.dataset!;
    const config = { dataset: { ...dataset, rows: dataset.rows.slice(0, 1), rowCount: 1 }, field: dataset.fields[0], measureField: dataset.fields[1], metric: "sum" as const, chartType: "table" as const };
    expect(runImportedDatasetQuery(config).table[0].values.summary).toBe(1e308);
    expect(() => runImportedDatasetQuery({ ...config, dataset })).toThrow("supported number range");
  });
  it.each([["0", 0], [" -1,234.50 ", -1234.5], ["$1,234.50", 1234.5], ["-$20", -20], ["2.5e2", 250], [".5", .5], ["25%", 25]] as const)("reads the complete value %s", (text, expected) => {
    expect(parseImportedNumber(text)).toBe(expected);
  });
  it.each(["", " ", "12oops", "12,34", "1.2.3", "0x10", "Infinity", "1e309", "$", "1%2", "12 34"])("rejects ambiguous or incomplete numeric text %j", (text) => {
    expect(parseImportedNumber(text)).toBeNull();
  });
  it("uses the same interpretation for imported currency metadata and actual summaries", async () => {
    const csv = 'Segment,Spend\nCore,"$1,200.50"\nCore,$20\nGrowth,$5';
    const result = await importDatasetBuffer(new TextEncoder().encode(csv).buffer, "synthetic-currency.csv");
    const dataset = result.dataset!;
    const field = dataset.fields.find((item) => item.sourceColumn === "Segment")!;
    const measureField = dataset.fields.find((item) => item.sourceColumn === "Spend")!;
    expect(measureField.type).toBe("numeric");
    const summary = runImportedDatasetQuery({ dataset, field, measureField, metric: "sum", chartType: "table" });
    expect(summary.table.find((row) => row.label === "Core")?.values.summary).toBe(1220.5);
    expect(summary.table.find((row) => row.label === "Growth")?.values.summary).toBe(5);
    expect(summary.warnings).toEqual([]);
    const safe = withSafeInference({ ...summary, warnings: [inferenceSafetyMessage("inference_precision_unverified")] });
    expect(safe.statistics.significance.reasonCodes).toEqual(["summary_only"]);
    expect(safe.warnings).toContain("Significance is unavailable for this imported summary. No statistical test was performed.");
    expect(safe.warnings.join(" ")).not.toContain("Rerun");
    expect(dataset.rows[0].Spend).toBe("$1,200.50");
  });
});
