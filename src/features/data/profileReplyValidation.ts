import type { ImportedNumericProfile } from "./importedNumericProfile";
import type { ImportedCategoricalProfile } from "./importedCategoricalProfile";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function read(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") && descriptor.enumerable ? descriptor.value : undefined;
}
function count(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function nullableFinite(value: unknown): value is number | null { return value === null || finite(value); }
function dense(value: unknown, maximum: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > maximum) return false;
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return false;
  }
  return true;
}

/** Structural/count consistency only; does not independently recalculate worker statistics. */
export function validNumericProfileReply(value: unknown, rows: number): value is ImportedNumericProfile {
  if (!count(rows, Number.MAX_SAFE_INTEGER) || !record(value) || read(value, "status") !== "ready" || read(value, "rows") !== rows) return false;
  const valid = read(value, "valid"), blank = read(value, "blank"), invalid = read(value, "invalid"), distinct = read(value, "distinct");
  if (!count(valid, rows) || !count(blank, rows) || !count(invalid, rows) || valid + blank + invalid !== rows || !count(distinct, valid)) return false;
  const minimum = read(value, "minimum"), maximum = read(value, "maximum"), median = read(value, "median"), mean = read(value, "mean"), total = read(value, "total");
  const bins = read(value, "distribution"), warnings = read(value, "warnings");
  if (![minimum, maximum, median, mean, total].every(nullableFinite) || !dense(bins, 10) || !dense(warnings, 16) || warnings.some(warning => typeof warning !== "string")) return false;
  if (!valid) return distinct === 0 && bins.length === 0 && [minimum, maximum, median, mean, total].every(statistic => statistic === null);
  if (!finite(minimum) || !finite(maximum) || minimum > maximum || !distinct || (minimum === maximum) !== (distinct === 1) || !bins.length) return false;
  if (median !== null && (!finite(median) || median < minimum || median > maximum)) return false;
  let mass = 0, previousUpper: number | undefined;
  for (let index = 0; index < bins.length; index++) {
    const bin = bins[index]; if (!record(bin)) return false;
    const lower = read(bin, "lower"), upper = read(bin, "upper"), amount = read(bin, "count");
    if (!finite(lower) || !finite(upper) || lower > upper || lower === upper && (bins.length !== 1 || minimum !== maximum) || !count(amount, valid) || read(bin, "includesUpper") !== (index === bins.length - 1)) return false;
    if (index === 0 ? lower !== minimum : lower !== previousUpper) return false;
    mass += amount; if (mass > valid) return false; previousUpper = upper;
  }
  return mass === valid && previousUpper === maximum;
}

export function validCategoricalProfileReply(value: unknown, rows: number): value is ImportedCategoricalProfile {
  if (!count(rows, Number.MAX_SAFE_INTEGER) || !record(value)) return false;
  if (read(value, "status") === "unavailable") return typeof read(value, "reason") === "string";
  if (read(value, "status") !== "ready" || read(value, "rows") !== rows) return false;
  const valid = read(value, "valid"), blank = read(value, "blank"), observed = read(value, "observedCategories"), unused = read(value, "unusedLabels"), omitted = read(value, "omittedCategories"), omittedResponses = read(value, "omittedResponses"), categories = read(value, "categories");
  if (!count(valid, rows) || !count(blank, rows) || valid + blank !== rows || !count(observed, valid) || !count(unused, Number.MAX_SAFE_INTEGER) || !count(omitted, observed) || !count(omittedResponses, valid) || !dense(categories, 10) || categories.length !== Math.min(10, observed) || categories.length + omitted !== observed || (omitted === 0 ? omittedResponses !== 0 : omittedResponses < omitted)) return false;
  const ids = new Set<string>(); let mass = omittedResponses;
  for (const category of categories) {
    if (!record(category)) return false;
    const id = read(category, "id"), label = read(category, "label"), amount = read(category, "count"), share = read(category, "share");
    if (typeof id !== "string" || !id || ids.has(id) || typeof label !== "string" || !count(amount, valid) || amount === 0 || !finite(share) || share < 0 || share > 100 || !valid) return false;
    const expected = amount / valid * 100;
    if (Math.abs(share - expected) > 8 * Number.EPSILON * Math.max(1, Math.abs(expected))) return false;
    ids.add(id); mass += amount; if (mass > valid) return false;
  }
  return mass === valid;
}
