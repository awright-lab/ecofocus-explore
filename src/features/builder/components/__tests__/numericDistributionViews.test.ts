import { expect, it } from "vitest";
import { buildNumericDistributionView } from "../numericDistributionViewModel";
import { buildNumericProfileFromValues } from "../../../data/importedNumericProfile";
import type { NumericDistributionBin } from "../../../data/importedNumericProfile";
const bins = (): NumericDistributionBin[] => [{ lower: 0, upper: 5, count: 1, includesUpper: false }, { lower: 5, upper: 10, count: 2, includesUpper: true }];
it("derives unrounded percentages and count-based cumulative totals without changing input", () => {
 const input = bins(), before = structuredClone(input), result = buildNumericDistributionView(input, 3); expect(result.status).toBe("ready"); if (result.status !== "ready") throw Error(result.reason);
 expect(result.ranges.map(bin => [bin.count, bin.percentage, bin.cumulativeCount, bin.cumulativePercentage])).toEqual([[1, 100 / 3, 1, 100 / 3], [2, 200 / 3, 3, 100]]); expect(input).toEqual(before);
});
it("retains one in fifty thousand and a nearly complete range without early rounding", () => {
 const input = bins(); input[1].count = 49999; const result = buildNumericDistributionView(input, 50000); expect(result.status).toBe("ready"); if (result.status !== "ready") throw Error(result.reason); expect(result.ranges[0].percentage).toBe(0.002); expect(result.ranges[1].percentage).toBe(99.998); expect(result.ranges[1].cumulativePercentage).toBe(100);
});
it("counts the last inclusive endpoint and complete constant samples correctly", () => {
 for (const values of [["0", "5", "10"], ["5", "5", "5"]]) { const profile = buildNumericProfileFromValues(values); if (profile.status !== "ready") throw Error("profile"); const result = buildNumericDistributionView(profile.distribution, profile.valid); expect(result.status).toBe("ready"); if (result.status !== "ready") throw Error(result.reason); expect(result.ranges.at(-1)!.cumulativeCount).toBe(3); expect(result.ranges.at(-1)!.cumulativePercentage).toBe(100); }
});
it("keeps zero-count gaps and never counts blank or invalid inputs in its denominator", () => {
 const profile = buildNumericProfileFromValues(["0", "100", "", "invalid"]); if (profile.status !== "ready") throw Error("profile"); const result = buildNumericDistributionView(profile.distribution, profile.valid); expect(result.status).toBe("ready"); if (result.status !== "ready") throw Error(result.reason); expect(result.valid).toBe(2); expect(result.ranges.map(bin => bin.percentage)).toEqual([50, 50]);
 const input = [{ lower: 0, upper: 1, count: 1, includesUpper: false }, { lower: 1, upper: 2, count: 0, includesUpper: false }, { lower: 2, upper: 3, count: 1, includesUpper: true }]; const gap = buildNumericDistributionView(input, 2); if (gap.status !== "ready") throw Error(gap.reason); expect(gap.ranges.map(bin => bin.cumulativePercentage)).toEqual([50, 50, 100]);
});
it.each(["missing mass", "extra mass", "fractional", "negative", "nonfinite bounds", "gap", "wrong endpoint", "sparse", "unsafe base"])("withholds misleading distributions: %s", kind => {
 let input = bins(), valid = 3;
 if (kind === "missing mass") input[1].count = 1;
 if (kind === "extra mass") input[1].count = 3;
 if (kind === "fractional") input[0].count = 0.5;
 if (kind === "negative") input[0].count = -1;
 if (kind === "nonfinite bounds") input[0].lower = -Infinity;
 if (kind === "gap") input[1].lower = 6;
 if (kind === "wrong endpoint") input[0].includesUpper = true;
 if (kind === "sparse") input = Array(2) as NumericDistributionBin[];
 if (kind === "unsafe base") valid = Number.MAX_SAFE_INTEGER;
 expect(buildNumericDistributionView(input, valid).status).toBe("unavailable");
});
it("does not invoke accessor metadata to derive chart values", () => {
 const input = bins(); let reads = 0; Object.defineProperty(input[0], "count", { enumerable: true, get() { reads++; return 1; } }); expect(buildNumericDistributionView(input, 3).status).toBe("unavailable"); expect(reads).toBe(0);
});
