import type { ImportedDatasetField } from "../../../shared/types/dashboard";

// Normalize the exact decimal spelling, without rounding the category code to
// binary64 or allocating a power of ten. Null means no supported decimal alias.
function exactDecimalKey(value: string): string | null {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? "";
  const digits = ((match[2] ?? "") + fraction).replace(/^0+/, "");
  if (!digits) return "0";
  const exponent = Number(match[5] ?? "0");
  if (!Number.isSafeInteger(exponent)) return null;
  const significant = digits.replace(/0+$/, "");
  const scale = exponent - fraction.length + digits.length - significant.length;
  if (!Number.isSafeInteger(scale)) return null;
  return `${match[1] === "-" ? "-" : ""}${significant}e${scale}`;
}

export function importedCategoryCode(field: Pick<ImportedDatasetField, "valueLabels">, raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const labels = field.valueLabels ?? {};
  if (Object.hasOwn(labels, value)) return value;
  const numeric = Number(value), candidate = String(numeric);
  if (!Number.isFinite(numeric) || !Object.hasOwn(labels, candidate)) return value;
  const exact = exactDecimalKey(value);
  // Number is only a candidate-key lookup. Exact decimal equality is required
  // before applying its label: underflow, rounding and hex syntax cannot merge
  // a distinct respondent code with a labeled category.
  return exact !== null && exact === exactDecimalKey(candidate) ? candidate : value;
}
