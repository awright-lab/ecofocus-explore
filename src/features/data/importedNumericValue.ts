// Imported numeric text uses a decimal point and optional comma thousands
// groups. Percentages remain percentage points; no unit conversion is implied.
export function parseImportedNumber(raw: string): number | null {
  const text = raw.trim().replace(/^([+-]?)\$\s*/, "$1").replace(/%$/, "").trim();
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const normalized = text.replace(/,/g, "");
  const value = Number(normalized);
  // A nonzero decimal coefficient can round all the way to binary64 zero.
  // Treat that range failure like overflow, not an observed zero response.
  const underflow = value === 0 && /[1-9]/.test(normalized.split(/[eE]/,1)[0]);
  return Number.isFinite(value) && !underflow ? value : null;
}
