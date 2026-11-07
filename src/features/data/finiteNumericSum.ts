/** Binary64 summation with retained rounding remainders; no decimal conversion.
 * The expansion/final tie correction follows the algorithm documented by
 * Python's math.fsum: https://docs.python.org/3/library/math.html#math.fsum
 * Unsupported intermediate overflow is sticky, including later cancellation.
 */
export class FiniteNumericSum {
  private parts: number[] = [];
  private unavailable = false;

  add(value: number): boolean {
    if (this.unavailable || !Number.isFinite(value)) {
      this.unavailable = true;
      return false;
    }
    let carry = value;
    let retained = 0;
    for (const part of this.parts) {
      const larger = Math.abs(carry) >= Math.abs(part) ? carry : part;
      const smaller = larger === carry ? part : carry;
      const combined = larger + smaller;
      if (!Number.isFinite(combined)) {
        this.unavailable = true;
        return false;
      }
      const remainder = smaller - (combined - larger);
      if (remainder !== 0) this.parts[retained++] = remainder;
      carry = combined;
    }
    this.parts.length = retained;
    if (carry !== 0) this.parts.push(carry);
    return true;
  }

  value(): number | null {
    if (this.unavailable) return null;
    let index = this.parts.length - 1;
    let result = this.parts[index--] ?? 0;
    let remainder = 0;
    while (index >= 0) {
      const part = this.parts[index--];
      const combined = result + part;
      if (!Number.isFinite(combined)) return null;
      remainder = part - (combined - result);
      result = combined;
      if (remainder !== 0) break;
    }
    // A smaller remainder of the same sign can put a halfway result just over
    // the rounding boundary. Apply only an exactly representable correction.
    if (index >= 0 && Math.sign(remainder) === Math.sign(this.parts[index])) {
      const correction = 2 * remainder;
      const candidate = result + correction;
      if (Number.isFinite(candidate) && candidate - result === correction) result = candidate;
    }
    return result;
  }
}
