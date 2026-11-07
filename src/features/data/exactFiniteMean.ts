/** Exact binary64-input mean, rounded once to nearest/ties-to-even.
 * Only used to recover a bounded profile whose ordinary total is unavailable.
 * Inputs are already parsed observations, not decimal-source exact arithmetic.
 */
export const exactMeanLimit = 50_000;
export type ExactMean = { value: number; reason?: never } | { value: null; reason: "limit" | "invalid" | "underflow" };
export function exactFiniteMean(values: readonly number[]): ExactMean {
  if (!values.length || values.length > exactMeanLimit) return { value: null, reason: "limit" };
  const view = new DataView(new ArrayBuffer(8));
  const fractionMask = (1n << 52n) - 1n;
  let sum = 0n;
  for (const value of values) {
    if (!Number.isFinite(value)) return { value: null, reason: "invalid" };
    view.setFloat64(0, value, false);
    const bits = view.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n), fraction = bits & fractionMask;
    // Every finite binary64 number is an integer multiple of 2^-1074.
    const magnitude = exponent === 0 ? fraction : ((1n << 52n) | fraction) << BigInt(exponent - 1);
    sum += bits >> 63n ? -magnitude : magnitude;
  }
  if (sum === 0n) return { value: 0 };
  const negative = sum < 0n, magnitude = negative ? -sum : sum, count = BigInt(values.length);
  let power = magnitude.toString(2).length - count.toString(2).length;
  if (power >= 0 && magnitude < (count << BigInt(power))) power -= 1;
  // Subnormal spacing is one unit; normal spacing retains 53 significant bits.
  const shift = Math.max(0, power - 52), denominator = count << BigInt(shift);
  let rounded = magnitude / denominator;
  const remainder = magnitude % denominator;
  if (remainder * 2n > denominator || remainder * 2n === denominator && (rounded & 1n) !== 0n) rounded += 1n;
  if (rounded === 0n) return { value: null, reason: "underflow" };
  const value = Number(rounded) * 2 ** (shift - 1074);
  if (!Number.isFinite(value) || value === 0) return { value: null, reason: "invalid" };
  return { value: negative ? -value : value };
}
