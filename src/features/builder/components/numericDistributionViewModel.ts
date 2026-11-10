import { unroundedPercentage } from "../../../../shared/analytics/percentagePrecision";
import type { NumericDistributionBin } from "../../data/importedNumericProfile";

export type DistributionView = "count" | "percent" | "cumulative";
export interface DistributionRange extends NumericDistributionBin { percentage: number; cumulativeCount: number; cumulativePercentage: number }
export type DistributionViewModel = { status: "ready"; ranges: DistributionRange[]; valid: number } | { status: "unavailable"; reason: string };
const own = (value: object, key: string) => Object.getOwnPropertyDescriptor(value, key);
/** Derived descriptive views of complete bin counts; never estimates missing bins or weights. */
export function buildNumericDistributionView(bins: NumericDistributionBin[], valid: number): DistributionViewModel {
  if (!Number.isSafeInteger(valid) || valid <= 0 || !Number.isSafeInteger(valid * 100) || !Array.isArray(bins) || !bins.length || bins.length > 10) return { status: "unavailable", reason: "Complete, valid numeric range counts are required to show this distribution." };
  const ranges: DistributionRange[] = []; let cumulative = 0;
  for (let index = 0; index < bins.length; index++) {
    const slot = own(bins, String(index));
    if (!slot || !Object.hasOwn(slot, "value") || !slot.value || typeof slot.value !== "object") return { status: "unavailable", reason: "Numeric range counts are incomplete. Refresh the numeric summary." };
    const bin = slot.value as NumericDistributionBin;
    const fields = ["lower", "upper", "count", "includesUpper"].map(key => own(bin, key));
    if (fields.some(field => !field || !Object.hasOwn(field, "value") || !field.enumerable)) return { status: "unavailable", reason: "Numeric range metadata is unavailable. Refresh the numeric summary." };
    const [lower, upper, count, includesUpper] = fields.map(field => field!.value) as [number, number, number, boolean];
    if (typeof lower !== "number" || typeof upper !== "number" || !Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper || lower === upper && bins.length !== 1 || !Number.isSafeInteger(count) || count < 0 || count > valid || includesUpper !== (index === bins.length - 1) || index > 0 && lower !== ranges[index - 1].upper) return { status: "unavailable", reason: "Numeric ranges or counts are inconsistent. Refresh the numeric summary." };
    cumulative += count;
    if (!Number.isSafeInteger(cumulative) || cumulative > valid) return { status: "unavailable", reason: "Numeric range totals do not match the valid response base. Refresh the numeric summary." };
    ranges.push({ lower, upper, count, includesUpper, percentage: unroundedPercentage(count, valid), cumulativeCount: cumulative, cumulativePercentage: unroundedPercentage(cumulative, valid) });
  }
  if (cumulative !== valid) return { status: "unavailable", reason: "Numeric range totals do not match the valid response base. Refresh the numeric summary." };
  return { status: "ready", ranges, valid };
}
export function distributionRangeLabel(bin: NumericDistributionBin) {
  if (bin.lower === bin.upper) return `All values equal ${bin.lower}`;
  return `${bin.lower} to ${bin.includesUpper ? "" : "less than "}${bin.upper}${bin.includesUpper ? " (inclusive)" : ""}`;
}
