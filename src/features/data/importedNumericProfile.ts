import { ImportedSourceColumnAmbiguityError } from "./importedRawValue";
import { exactFiniteMean, type ExactMean } from "./exactFiniteMean";
import { FiniteNumericSum } from "./finiteNumericSum";
import type { ImportedDatasetField, ImportedDatasetRecord } from "../../../shared/types/dashboard";
import { importedRawFieldValue } from "./importedDatasetAnalytics";
import { parseImportedNumber } from "./importedNumericValue";

export interface NumericDistributionBin {
  lower: number;
  upper: number;
  count: number;
  includesUpper: boolean;
}

function numericDistribution(sortedValues: number[]): NumericDistributionBin[] {
  if (!sortedValues.length) return [];
  const lower = sortedValues[0], upper = sortedValues[sortedValues.length - 1];
  if (lower === upper) return [{ lower, upper, count: sortedValues.length, includesUpper: true }];
  const requested = Math.min(10, Math.ceil(Math.sqrt(sortedValues.length)));
  const span = upper - lower;
  const edges = Array.from({ length: requested + 1 }, (_, index) => {
    if (index === 0) return lower;
    if (index === requested) return upper;
    const fraction = index / requested;
    // A convex blend handles opposite extreme values whose difference overflows.
    return Number.isFinite(span) ? lower + span * fraction : lower * (1 - fraction) + upper * fraction;
  });
  // Adjacent representable values can collapse intermediate floating-point
  // boundaries. Merge them rather than describe impossible empty-width ranges.
  const distinctEdges = [...new Set(edges.filter(Number.isFinite))];
  const bins = distinctEdges.slice(0, -1).map((edge, index) => ({ lower: edge, upper: distinctEdges[index + 1], count: 0, includesUpper: index === distinctEdges.length - 2 }));
  for (const value of sortedValues) {
    let index = 0;
    while (index < bins.length - 1 && value >= bins[index].upper) index += 1;
    bins[index].count += 1;
  }
  return bins;
}

export type ImportedNumericProfile =
  | { status: "unavailable"; reason: string }
  | { status: "ready"; rows: number; valid: number; blank: number; invalid: number; distinct: number;
      minimum: number | null; maximum: number | null; mean: number | null; median: number | null; total: number | null; distribution: NumericDistributionBin[]; warnings: string[] };

export function buildImportedNumericProfile(dataset: ImportedDatasetRecord, field: ImportedDatasetField): ImportedNumericProfile {
  const rows = dataset.rows.length ? dataset.rows : dataset.previewRows;
  if (rows.length < dataset.rowCount) return { status: "unavailable", reason: "Complete respondent rows are unavailable in this browser. A partial preview cannot establish this field's study-wide statistics." };
  try { return buildNumericProfileFromValues(rows.map(row => importedRawFieldValue(row, field))); }
  catch(error) {
    if(error instanceof ImportedSourceColumnAmbiguityError)return {status:"unavailable",reason:error.message};
    throw error;
  }
}

// Shared by the small synchronous path and the isolated browser worker.
export function buildNumericProfileFromValues(rawValues: readonly string[]): ImportedNumericProfile {
  const values: number[] = [];
  let blank = 0, invalid = 0;
  const accumulator = new FiniteNumericSum();
  for (const raw of rawValues) {
    if (!raw.trim()) { blank += 1; continue; }
    const value = parseImportedNumber(raw);
    if (value === null || !Number.isFinite(value)) { invalid += 1; continue; }
    values.push(value);
    accumulator.add(value);
  }
  values.sort((a, b) => a - b);
  const valid = values.length;
  const total = accumulator.value();
  const middle = Math.floor(valid / 2);
  const middleSum = valid && valid % 2 === 0 ? values[middle - 1] + values[middle] : 0;
  let median = valid ? valid % 2 ? values[middle] : Number.isFinite(middleSum) ? middleSum / 2 : values[middle - 1] / 2 + values[middle] / 2 : null;
  // Avoid approximate online cancellation after total overflow. Keep the cheap
  // exact cases, then recover only a bounded exact binary64-input mean.
  let mean: number | null = valid && total !== null ? total / valid : null;
  let recovered: ExactMean | undefined;
  if (valid && total === null) {
    if (values[0] === values[valid - 1]) mean = values[0];
    else if (values.every((value, index) => value === -values[valid - 1 - index])) mean = 0;
    else { recovered = exactFiniteMean(values); mean = recovered.value; }
  }
  const meanUnderflow = valid > 0 && total !== null && total !== 0 && mean === 0 || recovered?.reason === "underflow";
  const unverifiedOverflowMean = valid > 0 && total === null && mean === null && !meanUnderflow;
  const medianUnderflow = valid > 0 && valid % 2 === 0 && Number.isFinite(middleSum) && middleSum !== 0 && median === 0;
  if (medianUnderflow) median = null;
  const warnings: string[] = [];
  if (valid && total === null) warnings.push("The total could not be represented safely and is unavailable.");
  if (mean !== null && !Number.isFinite(mean)) warnings.push("The mean exceeds the supported numeric range and is unavailable.");
  if (meanUnderflow) warnings.push("The nonzero mean is below the supported numeric range and is unavailable.");
  if (unverifiedOverflowMean) warnings.push("The mean cannot be verified after total overflow and is unavailable. Rescale the source values before interpreting this mean.");
  if (medianUnderflow) warnings.push("The nonzero midpoint median is below the supported numeric range and is unavailable.");
  return { status: "ready", rows: rawValues.length, valid, blank, invalid, distinct: new Set(values).size,
    minimum: valid ? values[0] : null, maximum: valid ? values[valid - 1] : null,
    mean: mean !== null && Number.isFinite(mean) && !meanUnderflow ? mean : null, median,
    total: valid && total !== null ? total : null, distribution: numericDistribution(values), warnings };
}
