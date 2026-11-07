export type ReviewNumberPrecision = "compact" | "full";
const compact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const compactScientific = new Intl.NumberFormat("en-US", { notation: "scientific", maximumSignificantDigits: 5 });
const full = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 21 });
const fullScientific = new Intl.NumberFormat("en-US", { notation: "scientific", maximumSignificantDigits: 21 });
/** Presentation only; never recover precision that a stored result has lost. */
export function formatReviewNumber(value: number | null, unit: "number" | "percent" = "number", precision: ReviewNumberPrecision = "compact"): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const normalized = value === 0 ? 0 : value;
  const scientific = normalized !== 0 && (Math.abs(normalized) < 0.0001 || Math.abs(normalized) >= 1e12);
  const formatter = precision === "full" ? scientific ? fullScientific : full : scientific ? compactScientific : compact;
  return formatter.format(normalized) + (unit === "percent" ? "%" : "");
}
export function formatReviewChange(before: number | null, after: number | null, unit: "number" | "percent", precision: ReviewNumberPrecision = "compact"): string {
  if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)) return "Not comparable";
  const change = after - before;
  if (!Number.isFinite(change)) return "Not comparable";
  return (change > 0 ? "+" : "") + formatReviewNumber(change, "number", precision) + (unit === "percent" ? " percentage points" : "");
}
