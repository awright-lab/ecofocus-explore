// This marker is written only by fresh local ordinary unweighted executions.
// Its absence retains the historical one-decimal result contract.
export const percentageValueMode = "unrounded_ratio_v1" as const;

export function unroundedPercentage(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0 || numerator > denominator || !Number.isSafeInteger(numerator * 100)) {
    throw new Error("Percentage counts exceed the supported exact integer range.");
  }
  return denominator === 0 ? 0 : numerator * 100 / denominator;
}

// Respect authored interior rounding, but never label a stored positive rate
// as zero or a stored partial rate as 100. This cannot recover old rounded data.
export function formatPercentageNumber(value: number, decimals = 0, ceil = false): string {
  if (!Number.isFinite(value)) return "Unavailable";
  const places = Number.isInteger(decimals) && decimals >= 0 && decimals <= 20 ? decimals : 0;
  const factor = 10 ** places;
  const rounded = (ceil ? Math.ceil(value * factor) : Math.round(value * factor)) / factor;
  if (value > 0 && value < 100 && (rounded === 0 || rounded === 100)) return String(value);
  return rounded.toFixed(places);
}

// Guided samples and category profiles historically omit a trailing .0.
export function formatPercentageSample(value: number): string {
  return formatPercentageNumber(value, 1).replace(/\.0$/, "");
}
